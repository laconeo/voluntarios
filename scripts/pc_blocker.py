
import sys
import platform
import logging
from typing import Optional
from datetime import datetime, timezone

# PySide6 imports
# pyre-ignore[21]: PySide6 imports not found by linter
from PySide6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QLabel, QStackedWidget
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtCore import QUrl, QTimer, Qt, Slot
from PySide6.QtGui import QIcon, QKeySequence, QShortcut, QFont

import requests # pyre-ignore[21]

# ================= CONFIGURACIÓN =================
SUPABASE_URL = "https://apmykrlvahdllakrjdbp.supabase.co" 
SUPABASE_KEY = "sb_publishable_sbG7mEBN9__P-JnZlwnjng_tbbuNMnT"
APP_URL = "http://localhost:3005" # Cambiar por URL real si es necesario

# ================= REST CLIENT =================
class ApiClient:
    def __init__(self, pc_id: int):
        self.pc_id = pc_id
        self.headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }

    def check_supabase_connection(self):
        try:
            requests.get(f"{SUPABASE_URL}/rest/v1/", headers=self.headers, timeout=5)
            logging.info("Conexión a Supabase exitosa.")
        except Exception as e:
            logging.error(f"Error de conexión a Supabase: {e}")
            sys.exit(1)

    def get_pc_status(self) -> Optional[dict]:
        try:
            url = f"{SUPABASE_URL}/rest/v1/pcs_status?select=*&id=eq.{self.pc_id}"
            response = requests.get(url, headers=self.headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                return data[0] if data else None
            return None
        except Exception as e:
            logging.error(f"Error checking PC status: {e}")
            return None

    def register_pc(self):
        try:
            url = f"{SUPABASE_URL}/rest/v1/pcs_status"
            requests.post(url, headers=self.headers, json={"id": self.pc_id})
        except Exception as e:
            logging.error(f"Error registering PC: {e}")

# ================= KIOSK WINDOW =================
class PCBlockerKiosk(QMainWindow):
    def __init__(self, pc_id: int):
        super().__init__()
        self.pc_id = pc_id
        self.api = ApiClient(pc_id)
        self.is_minimized_by_logic = False # Track if we minimized it intentionally
        self.is_blocking = True # Start assuming we should block
        
        self.setup_ui()
        self.setup_shortcuts()
        self.setup_timer()
        
        # Check connection once at startup
        self.api.check_supabase_connection()

    def setup_ui(self):
        self.setWindowTitle(f"Control PC {self.pc_id}")
        
        # Central widget with layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Stacked Widget to switch between WebView and Message
        self.stack = QStackedWidget()
        layout.addWidget(self.stack)

        # 1. WebView (Index 0)
        self.webview = QWebEngineView()
        initial_url = f"{APP_URL}/#/pc-overlay/{self.pc_id}"
        self.webview.setUrl(QUrl(initial_url))
        self.stack.addWidget(self.webview)

        # 2. Message Label (Index 1)
        self.message_label = QLabel()
        self.message_label.setText("Espere un momento que estamos preparando todo\npara que puedas seguir sirviendo")
        self.message_label.setAlignment(Qt.AlignCenter)
        self.message_label.setStyleSheet("background-color: #f9fafb; color: #1f2937; padding: 20px;")
        font = QFont("Arial", 24, QFont.Bold)
        self.message_label.setFont(font)
        self.stack.addWidget(self.message_label)

        # Set window flags for Kiosk mode (Fullscreen, On Top, No Frame)
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool) 
        
        # Start in fullscreen showing webview
        self.stack.setCurrentIndex(0)
        self.showFullScreen()

    def setup_shortcuts(self):
        # Ctrl+Q to quit
        self.quit_shortcut = QShortcut(QKeySequence("Ctrl+Q"), self)
        self.quit_shortcut.setContext(Qt.ApplicationShortcut)
        self.quit_shortcut.activated.connect(QApplication.instance().quit)

    def setup_timer(self):
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.check_status)
        self.timer.start(5000) # Check every 5 seconds

    @Slot()
    def check_status(self):
        pc_data = self.api.get_pc_status()
        
        if not pc_data:
            # If not found, register and stay blocking (default safe state)
            self.api.register_pc()
            self.set_blocking_mode(True)
            return

        status = pc_data.get('estado', 'disponible')
        limit_str = pc_data.get('tiempo_limite')
        
        should_block = True
            
        if status == 'ocupada':
            if limit_str:
                try:
                    limit_dt = datetime.fromisoformat(limit_str.replace('Z', '+00:00'))
                    now_dt = datetime.now(timezone.utc)
                    remaining = (limit_dt - now_dt).total_seconds()
                    
                    if remaining > 0:
                        should_block = False # User still has time
                except ValueError:
                    logging.error("Invalid date format from API")
        
        self.set_blocking_mode(should_block)

    def set_blocking_mode(self, should_block: bool):
        if should_block:
            # SHOW BLOCKER
            # Ensure we are blocking. If we were not blocking, or minimized, restore.
            if not self.is_blocking or self.isMinimized() or not self.isVisible():
                self.is_blocking = True
                self.stack.setCurrentIndex(0) # Show WebView
                self.showNormal() # Restore first
                self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint)
                self.showFullScreen()
                self.webview.reload() # Reload to ensure fresh state
                self.activateWindow()
                self.raise_()
        else:
            # HIDE BLOCKER (Allow usage)
            # If we were blocking, we handle the transition.
            if self.is_blocking:
                self.is_blocking = False
                
                # Show "Wait a moment" message
                self.stack.setCurrentIndex(1)
                self.showFullScreen() # Ensure visible
                
                # Wait 3 seconds then minimize
                QTimer.singleShot(3000, self.minimize_window)

    def minimize_window(self):
        # Only minimize if we are still supposed to be unblocked
        if not self.is_blocking:
            self.showMinimized()
            self.stack.setCurrentIndex(0) # Reset to webview for next time
            # We can't easily rely on just showMinimized() to keep it hidden if user alt-tabs back.
            # But normally user clicks on something else.
            # Ideally we would hide(), but we want the app to keep running.
            # self.hide()

# ================= MAIN =================
def main():
    logging.basicConfig(level=logging.INFO)
    
    if len(sys.argv) < 2:
        print("Uso: python pc_blocker.py <PC_ID>")
        sys.exit(1)
        
    try:
        pc_id = int(sys.argv[1])
    except ValueError:
        print("El ID de PC debe ser un entero.")
        sys.exit(1)

    app = QApplication(sys.argv)
    
    window = PCBlockerKiosk(pc_id)
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
