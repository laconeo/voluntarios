"""
Genera los íconos PNG de la extensión Chrome usando solo la librería estándar de Python.
No requiere instalaciones adicionales.
Ejecutar: python generate_icons.py
"""
import struct, zlib, os, math

def make_png(size):
    """Genera un PNG cuadrado de 'size' x 'size' pixeles con el ícono de la extensión."""
    
    pixels = []
    for y in range(size):
        row = []
        for x in range(size):
            r, g, b, a = draw_pixel(x, y, size)
            row.append((r, g, b, a))
        pixels.append(row)
    
    return encode_png(pixels, size)

def draw_pixel(x, y, size):
    """Dibuja el ícono pixel a pixel."""
    cx, cy = size / 2, size / 2
    
    # Márgenes de la caja (todo el ícono)
    margin = size * 0.04
    corner_r = size * 0.18
    
    # --- Background con esquinas redondeadas ---
    in_bg = rounded_rect_contains(x, y, margin, margin, size - 2*margin, size - 2*margin, corner_r)
    
    if not in_bg:
        return 0, 0, 0, 0  # Transparente
    
    # Gradiente de fondo: azul oscuro
    t = (x + y) / (size * 2)
    bg_r = int(lerp(26, 15, t))
    bg_g = int(lerp(26, 52, t))
    bg_b = int(lerp(46, 96, t))
    
    # --- Laptop body ---
    lw = size * 0.64   # ancho laptop
    lh = size * 0.42   # alto pantalla
    lx = (size - lw) / 2
    ly = size * 0.14
    
    laptop_screen = rounded_rect_contains(x, y, lx, ly, lw, lh, size * 0.05)
    
    if laptop_screen:
        # Interior de pantalla (azul)
        pad = size * 0.045
        inner = rounded_rect_contains(x, y, lx + pad, ly + pad, lw - 2*pad, lh - 2*pad, size * 0.03)
        if inner:
            # Reloj en el centro de la pantalla
            scx = lx + lw / 2
            scy = ly + lh / 2
            cr = lh * 0.28
            dist = math.sqrt((x - scx)**2 + (y - scy)**2)
            
            if abs(dist - cr) < size * 0.025:  # Borde del reloj
                return 255, 255, 255, 255
            
            # Manecilla vertical (12 a 6)
            if dist < cr and abs(x - scx) < size * 0.025 and y < scy:
                return 255, 255, 255, 255
            # Manecilla horizontal (12 a 3)
            if dist < cr and abs(y - scy) < size * 0.025 and x > scx:
                return 255, 255, 255, 255
            
            return 59, 130, 246, 255  # Azul pantalla
        else:
            return 220, 230, 245, 255  # Borde de pantalla blanco
    
    # Teclado (base del laptop)
    base_y = ly + lh + size * 0.04
    base_h = lh * 0.12
    base_x = lx - lw * 0.04
    base_w = lw * 1.08
    
    in_base = rounded_rect_contains(x, y, base_x, base_y, base_w, base_h, size * 0.03)
    if in_base:
        return 220, 230, 245, 255
    
    # Soporte inferior
    stand_w = lw * 0.35
    stand_h = lh * 0.1
    stand_x = (size - stand_w) / 2
    stand_y = base_y + base_h
    
    in_stand = rounded_rect_contains(x, y, stand_x, stand_y, stand_w, stand_h, size * 0.02)
    if in_stand:
        return 220, 230, 245, 255
    
    return bg_r, bg_g, bg_b, 255

def rounded_rect_contains(px, py, rx, ry, rw, rh, r):
    """Verifica si el punto (px, py) está dentro de un rectángulo con esquinas redondeadas."""
    # Clamp el radio para que no supere la mitad del lado menor
    r = min(r, rw / 2, rh / 2)
    # Distancia al centro más cercano del rectángulo
    dx = max(rx + r - px, 0, px - (rx + rw - r))
    dy = max(ry + r - py, 0, py - (ry + rh - r))
    return dx * dx + dy * dy <= r * r

def lerp(a, b, t):
    return a + (b - a) * t

def encode_png(pixels, size):
    """Codifica los píxeles en formato PNG válido."""
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        crc = zlib.crc32(name + data) & 0xffffffff
        return c + struct.pack('>I', crc)
    
    # Header PNG
    header = b'\x89PNG\r\n\x1a\n'
    
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    # Color type 6 = RGBA
    ihdr_data = struct.pack('>II', size, size) + bytes([8, 6, 0, 0, 0])
    ihdr = chunk(b'IHDR', ihdr_data)
    
    # IDAT
    raw_rows = []
    for row in pixels:
        raw_row = b'\x00'  # filter type None
        for (r, g, b, a) in row:
            raw_row += bytes([r, g, b, a])
        raw_rows.append(raw_row)
    
    raw_data = b''.join(raw_rows)
    compressed = zlib.compress(raw_data, 9)
    idat = chunk(b'IDAT', compressed)
    
    # IEND
    iend = chunk(b'IEND', b'')
    
    return header + ihdr + idat + iend

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(script_dir, 'icons')
    os.makedirs(icons_dir, exist_ok=True)
    
    sizes = [16, 48, 128]
    for sz in sizes:
        print(f"Generando icon{sz}.png ({sz}x{sz})...", end=' ', flush=True)
        png_data = make_png(sz)
        path = os.path.join(icons_dir, f'icon{sz}.png')
        with open(path, 'wb') as f:
            f.write(png_data)
        print(f"✅ ({len(png_data):,} bytes)")
    
    print("\n¡Íconos generados correctamente en la carpeta icons/!")

if __name__ == '__main__':
    main()
