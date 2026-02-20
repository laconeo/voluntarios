/**
 * Genera los íconos PNG de la extensión usando el módulo canvas.
 * Ejecutar con: node generate-icons.js
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

const sizes = [16, 48, 128];

sizes.forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background: dark blue rounded rect
    const r = size * 0.2;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#0f3460');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Laptop shape (white)
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const s = size * 0.55;
    const ox = (size - s) / 2;
    const oy = size * 0.25;

    // Screen
    const screenH = s * 0.55;
    const screenW = s;
    roundRect(ctx, ox, oy, screenW, screenH, s * 0.08);
    ctx.fill();

    // Screen content (blue)
    ctx.fillStyle = '#3b82f6';
    roundRect(ctx, ox + s * 0.06, oy + s * 0.06, screenW - s * 0.12, screenH - s * 0.12, s * 0.04);
    ctx.fill();

    // Clock on screen (white)
    if (size >= 48) {
        const cx = ox + screenW / 2;
        const cy = oy + screenH / 2;
        const cr = screenH * 0.3;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = size * 0.025;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.stroke();
        // Clock hands
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - cr * 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + cr * 0.45, cy);
        ctx.stroke();
    } else {
        // For 16px just a dot
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ox + screenW / 2, oy + screenH / 2, size * 0.06, 0, Math.PI * 2);
        ctx.fill();
    }

    // Base / keyboard
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    roundRect(ctx, ox - s * 0.05, oy + screenH + s * 0.04, s * 1.1, s * 0.1, s * 0.05);
    ctx.fill();

    // Bottom stand
    roundRect(ctx, size / 2 - s * 0.2, oy + screenH + s * 0.14, s * 0.4, s * 0.07, s * 0.03);
    ctx.fill();

    const buffer = canvas.toBuffer('image/png');
    const outPath = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`✅ Creado: icon${size}.png (${size}x${size})`);
});

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
