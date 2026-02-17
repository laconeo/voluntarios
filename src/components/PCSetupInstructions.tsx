import React, { useState } from 'react';
import { Terminal, Download, Play, Info, Check, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';

const PCSetupInstructions: React.FC = () => {
    const [copied, setCopied] = useState(false);

    const scriptContent = `import sys
from typing import Optional, Dict
import tkinter as tk
from tkinter import ttk, messagebox
import webbrowser
from datetime import datetime, timedelta, timezone
import requests
# from supabase import create_client, Client # Removing supabase dependency due to build issues on Windows/Py3.14

# ================= CONFIGURACIÓN =================
SUPABASE_URL = "https://apmykrlvahdllakrjdbp.supabase.co" 
SUPABASE_KEY = "sb_publishable_sbG7mEBN9__P-JnZlwnjng_tbbuNMnT"
APP_URL = "http://localhost:5173" # Cambiar por la URL de producción (ej: https://tudominio.com)

# ================= LÓGICA =================

class PCBlockerApp:
    def __init__(self, root: tk.Tk, pc_id: int):
        self.root = root
        self.pc_id = pc_id
        self.root.title(f"Control PC {pc_id}")
        
        # Window Setup
        # Configure window to be somewhat blocking (fullscreen, top)
        self.root.attributes("-fullscreen", True)
        self.root.attributes("-topmost", True)
        self.root.overrideredirect(True) # Remove title bar
        self.root.configure(bg="#f0f0f0")
        
        # UI Setup
        # Container
        self.container = tk.Frame(self.root, bg="#f0f0f0")
        self.container.place(relx=0.5, rely=0.5, anchor="center")

        # Header
        self.header_label = tk.Label(self.container, text=f"PC {self.pc_id}", font=("Segoe UI", 32, "bold"), bg="#f0f0f0", fg="#333")
        self.header_label.pack(pady=20)

        # Status
        self.status_label = tk.Label(self.container, text="Iniciando...", font=("Segoe UI", 16), bg="#f0f0f0", fg="#666")
        self.status_label.pack(pady=10)

        # Login Frame (Hidden by default)
        self.login_frame = tk.Frame(self.container, bg="#f0f0f0")
        self.volunteers_combo = ttk.Combobox(self.login_frame, state="readonly", width=40, font=("Segoe UI", 12))
        self.volunteers_combo.pack(pady=10)
        
        self.start_btn = tk.Button(self.login_frame, text="Iniciar Sesión (20 min)", command=self.start_session, 
                                   bg="#8CB83E", fg="white", font=("Segoe UI", 14, "bold"), padx=20, pady=10, relief="flat")
        self.start_btn.pack(pady=20)

        # Blocked Frame
        self.blocked_frame = tk.Frame(self.container, bg="#f0f0f0")
        self.blocked_msg = tk.Label(self.blocked_frame, text="Esta PC está bloqueada.", font=("Segoe UI", 24), bg="#f0f0f0", fg="#d32f2f")
        self.blocked_msg.pack(pady=20)
        
        self.volunteer_map: Dict[str, str] = {}
        
        # Connect to Supabase (Check connection)
        try:
            # Simple check to see if we can reach Supabase
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}"
            }
            response = requests.get(f"{SUPABASE_URL}/rest/v1/", headers=headers, timeout=5)
            # 404 is expected for root, or 200 for health check depending on config, 
            # but usually we just want to ensure we don't get a connection error.
            
            if self.status_label:
                self.status_label.config(text="Conectado a la base de datos...")
        except Exception as e:
            messagebox.showerror("Error de Conexión", f"No se pudo conectar a Supabase: {e}")
            sys.exit(1)

        # Start Polling
        self.check_status()

    def show_view(self, view_name):
        self.login_frame.pack_forget()
        self.blocked_frame.pack_forget()
        
        if view_name == "login":
            self.login_frame.pack()
            self.root.deiconify()
        elif view_name == "blocked":
            self.blocked_frame.pack()
            self.root.deiconify()
        elif view_name == "hidden":
            self.root.withdraw()

    def load_volunteers(self):
        try:
            # Fetch active bookings ideally. Here fetching all users for demo.
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            }
            # REST: GET /users?select=id,full_name&status=eq.active
            url = f"{SUPABASE_URL}/rest/v1/users?select=id,full_name&status=eq.active"
            
            response = requests.get(url, headers=headers)
            if response.status_code != 200:
                print(f"Error fetching users: {response.text}")
                return

            users = response.json()
            # Sort by name
            users.sort(key=lambda x: x.get('full_name') or "")
            self.volunteer_map = {u['full_name']: u['id'] for u in users if u.get('full_name')}
            
            if self.volunteers_combo:
                 self.volunteers_combo['values'] = list(self.volunteer_map.keys())
        except Exception as e:
            print("Error loading volunteers:", e)

    def start_session(self):
        selected_name = self.volunteers_combo.get()
        if not selected_name:
            messagebox.showwarning("Atención", "Por favor selecciona tu nombre.")
            return
            
        user_id = self.volunteer_map[selected_name]
        
        # Calculate times (UTC)
        now = datetime.now(timezone.utc)
        limit = now + timedelta(minutes=20)
        
        try:
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            }
            # REST: PATCH /pcs_status?id=eq.{pc_id}
            url = f"{SUPABASE_URL}/rest/v1/pcs_status?id=eq.{self.pc_id}"
            
            data = {
                "estado": "ocupada",
                "voluntario_id": user_id,
                "inicio_sesion": now.isoformat(),
                "tiempo_limite": limit.isoformat()
            }
            
            response = requests.patch(url, headers=headers, json=data)
            if response.status_code not in [200, 204]:
                raise Exception(f"API Error: {response.text}")
            
            # Hide window immediately
            self.show_view("hidden")
            
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo iniciar sesión: {e}")

    def check_status(self):
        try:
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json"
            }
            # REST: GET /pcs_status?select=*&id=eq.{pc_id}
            url = f"{SUPABASE_URL}/rest/v1/pcs_status?select=*&id=eq.{self.pc_id}"
            
            response = requests.get(url, headers=headers)
            if response.status_code != 200:
                print(f"Error checking status: {response.text}")
                # Retry later
                self.root.after(5000, self.check_status)
                return

            data = response.json()
            pc_data = data[0] if data else None
            
            if not pc_data:
                # If PC doesn't exist in DB, insert it
                # REST: POST /pcs_status
                insert_url = f"{SUPABASE_URL}/rest/v1/pcs_status"
                requests.post(insert_url, headers=headers, json={"id": self.pc_id})
                return

            status = pc_data.get('estado', 'disponible')
            
            if status == 'disponible':
                if not self.login_frame.winfo_viewable() or self.root.state() == 'withdrawn':
                    self.load_volunteers()
                    self.show_view("login")
                    self.status_label.config(text="PC Disponible")

            elif status == 'ocupada':
                limit_str = pc_data.get('tiempo_limite')
                if limit_str:
                    limit_dt = datetime.fromisoformat(limit_str.replace('Z', '+00:00'))
                    now_dt = datetime.now(timezone.utc)
                    
                    remaining = (limit_dt - now_dt).total_seconds()
                    
                    if remaining <= 0:
                        # Time is UP!
                        # We should show the React Overlay URL
                        # Check if we already launched it? Hard to know. 
                        # We can just show a blocking message here pointing to the browser.
                        if self.root.state() == 'withdrawn':
                           webbrowser.open(f"{APP_URL}/#/pc-overlay/{self.pc_id}")
                           self.show_view("blocked")
                           self.blocked_msg.config(text="¡Tiempo Terminado!\\nPor favor completa el reporte en el navegador.")
                    elif remaining < 120:
                         # Warning logic could go here (e.g. system notification)
                         self.show_view("hidden")
                    else:
                        self.show_view("hidden")
                else:
                    self.show_view("hidden")

            elif status in ['bloqueada', 'mantenimiento']:
                self.show_view("blocked")
                self.blocked_msg.config(text=f"PC {status.capitalize()}")

        except Exception as e:
            print(f"Error checking status: {e}")
        
        # Check again in 5 seconds
        self.root.after(5000, self.check_status)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python pc_blocker.py <PC_ID>")
        sys.exit(1)
        
    pc_id = int(sys.argv[1])
    
    root = tk.Tk()
    app = PCBlockerApp(root, pc_id)
    root.mainloop()
`;

    const handleCopy = () => {
        navigator.clipboard.writeText(scriptContent);
        setCopied(true);
        toast.success("Script copiado al portapapeles");
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadScript = () => {
        const element = document.createElement("a");
        const file = new Blob([scriptContent], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        element.download = "pc_blocker.py";
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <h1 className="text-3xl font-bold text-gray-900">Configuración de Puesto de Trabajo</h1>
                    <p className="mt-2 text-gray-600">Guía técnica para instalar y configurar el script de control de PC.</p>
                </div>
            </header>

            <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">

                {/* Paso 1: Python */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                            1
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-semibold mb-2">Instalar Python</h2>
                            <p className="text-gray-600 mb-4">
                                Asegúrate de tener Python instalado en la computadora. Se recomienda la versión 3.10 o superior.
                                Al instalar, marca la opción "Add Python to PATH".
                            </p>
                            <a
                                href="https://www.python.org/downloads/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Descargar Python <span className="ml-1">&rarr;</span>
                            </a>
                        </div>
                    </div>
                </section>

                {/* Paso 2: Dependencias */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
                            2
                        </div>
                        <div className="flex-1 w-full">
                            <h2 className="text-xl font-semibold mb-2">Instalar Dependencias</h2>
                            <p className="text-gray-600 mb-4">
                                Abre una terminal (CMD o PowerShell) y ejecuta el siguiente comando para instalar las librerías necesarias:
                            </p>
                            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-300 flex items-center justify-between group">
                                <span>pip install requests</span>
                                <button
                                    onClick={() => { navigator.clipboard.writeText("pip install requests"); toast.success("Copiado"); }}
                                    className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-white"
                                    title="Copiar comando"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                                <Info size={16} />
                                <span>Nota: 'tkinter' suele venir instalado por defecto con Python.</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Paso 3: Script */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-lg">
                            3
                        </div>
                        <div className="flex-1 w-full overflow-hidden">
                            <h2 className="text-xl font-semibold mb-2">Descargar Script</h2>
                            <p className="text-gray-600 mb-4">
                                Descarga el script <code>pc_blocker.py</code> o copia el código fuente a un archivo con ese nombre.
                            </p>

                            <div className="flex gap-4 mb-4">
                                <button
                                    onClick={downloadScript}
                                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                                >
                                    <Download size={18} className="mr-2" />
                                    Descargar Archivo .py
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className={`inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm ${copied ? 'text-green-600 border-green-300' : ''}`}
                                >
                                    {copied ? <Check size={18} className="mr-2" /> : <Copy size={18} className="mr-2" />}
                                    {copied ? 'Copiado!' : 'Copiar Código'}
                                </button>
                            </div>

                            <details className="border rounded-lg bg-gray-50">
                                <summary className="p-3 cursor-pointer font-medium text-gray-700 hover:text-gray-900 select-none">Ver código fuente</summary>
                                <div className="p-4 bg-gray-900 overflow-x-auto border-t border-gray-200">
                                    <pre className="text-gray-300 font-mono text-sm leading-relaxed">
                                        {scriptContent}
                                    </pre>
                                </div>
                            </details>
                        </div>
                    </div>
                </section>

                {/* Paso 4: Ejecutar */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-lg">
                            4
                        </div>
                        <div className="flex-1 w-full">
                            <h2 className="text-xl font-semibold mb-2">Ejecutar Script</h2>
                            <p className="text-gray-600 mb-4">
                                Para iniciar el bloqueo, ejecuta el script pasando el ID de la PC como argumento.
                                <br />Reemplaza <code>&lt;ID&gt;</code> por el número de la PC (ej: 1, 2, 3..).
                            </p>
                            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-300 flex items-center justify-between group">
                                <span>python pc_blocker.py &lt;ID&gt;</span>
                                <button
                                    onClick={() => { navigator.clipboard.writeText("python pc_blocker.py "); toast.success("Copiado parcial"); }}
                                    className="p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-white"
                                    title="Copiar comando"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                            <div className="mt-4 p-4 bg-yellow-50 text-yellow-800 rounded-lg flex items-start gap-3 text-sm">
                                <Terminal size={18} className="mt-0.5 flex-shrink-0" />
                                <div>
                                    <strong>Tip Pro:</strong> Crea un acceso directo en el escritorio y edita sus propiedades para agregar el ID al final de la linea "Destino".
                                    <br />Ejemplo: <code>python.exe C:\Ruta\pc_blocker.py 1</code>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

            </main>
        </div>
    );
};

export default PCSetupInstructions;
