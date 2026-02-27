import React, { useState } from 'react';
import { Chrome, Download, Info, Check, Copy, AlertTriangle, Wifi, Monitor, Zap, ChevronDown, ChevronUp, Clock, Shield, Layers, Calendar, Package } from 'lucide-react';
import { toast } from 'react-hot-toast';

// ---- Componentes base -----------------------------------------------

interface StepProps {
    number: number;
    color: string;
    title: string;
    children: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ number, color, title, children }) => (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${color} flex items-center justify-center font-bold text-lg`}>
                {number}
            </div>
            <div className="flex-1 w-full min-w-0">
                <h2 className="text-xl font-semibold mb-3">{title}</h2>
                {children}
            </div>
        </div>
    </section>
);

interface CodeBlockProps { code: string; copyText?: string; }
const CodeBlock: React.FC<CodeBlockProps> = ({ code, copyText }) => (
    <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-300 flex items-center justify-between gap-4">
        <span className="break-all">{code}</span>
        <button
            onClick={() => { navigator.clipboard.writeText(copyText ?? code); toast.success("Copiado"); }}
            className="flex-shrink-0 p-1.5 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-white"
            title="Copiar"
        >
            <Copy size={16} />
        </button>
    </div>
);

// Burbuja de flujo A→B→C→D
const FlowStep: React.FC<{ letter: string; color: string; title: string; desc: string }> = ({ letter, color, title, desc }) => (
    <div className="flex gap-3">
        <div className={`flex-shrink-0 w-7 h-7 rounded-full ${color} flex items-center justify-center text-xs font-bold`}>{letter}</div>
        <div>
            <p className="font-semibold text-gray-800 text-sm">{title}</p>
            <p className="text-sm text-gray-600">{desc}</p>
        </div>
    </div>
);

// ---- Componente principal -------------------------------------------

const PCSetupInstructions: React.FC = () => {
    const [showTroubleshooting, setShowTroubleshooting] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">

            {/* ---- HEADER ---- */}
            <header className="bg-white border-b border-gray-200 mb-2">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Chrome size={28} className="text-[#8CB83E]" />
                        <h1 className="text-3xl font-bold text-gray-900">PC Stand — Modo Kiosk</h1>
                    </div>
                    <p className="text-gray-500 text-base">
                        Extensión de Chrome para el stand de FamilySearch · Integración con el SGV
                    </p>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">

                {/* ---- VENTAJAS ---- */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-start gap-3">
                        <Layers size={20} className="text-primary-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-primary-800">
                            <strong>Multi-OS:</strong> Windows, ChromeOS Flex y Mac. Solo necesitás Chrome instalado.
                        </div>
                    </div>
                    <div className="bg-[#eef5f9] border border-[#cce1f0] rounded-xl p-4 flex items-start gap-3">
                        <Package size={20} className="text-fs-blue flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-fs-blue">
                            <strong>Fácil distribución:</strong> Descargá el ZIP, descomprimilo y cargalo en Chrome. Sin instaladores.
                        </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
                        <Calendar size={20} className="text-gray-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-gray-700">
                            <strong>Multi-evento:</strong> Elegís a qué evento pertenece cada PC al configurarla.
                        </div>
                    </div>
                </div>

                {/* ---- AVISO PRE-REQUISITO ---- */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                        <strong>Antes de empezar:</strong> El administrador debe haber creado el evento en el SGV (
                        <a href="https://laconeo.github.io/voluntarios/" target="_blank" rel="noopener noreferrer"
                            className="underline text-amber-900">laconeo.github.io/voluntarios</a>
                        ) y asignado un número de PC a cada computadora (ej: PC 1, PC 2…).
                    </div>
                </div>

                {/* ---- PASO 1: DESCARGAR ---- */}
                <Step number={1} color="bg-[#8CB83E] text-white" title="Descargar la Extensión">
                    <p className="text-gray-600 mb-4">
                        Descargá el archivo ZIP de la extensión ya empaquetada y lista para usar:
                    </p>

                    {/* Botón de descarga */}
                    <a
                        href="/voluntarios/chrome-extension/pc-stand-modo-kiosk.zip"
                        download="pc-stand-modo-kiosk.zip"
                        className="inline-flex items-center gap-2 bg-[#8CB83E] hover:bg-[#7cb342] text-white font-semibold px-6 py-3 rounded-full transition-colors text-sm uppercase tracking-wide mb-4"
                    >
                        <Download size={16} />
                        Descargar pc-stand-modo-kiosk.zip
                    </a>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-2">
                        <p className="text-sm font-semibold text-gray-700 mb-2">El ZIP contiene:</p>
                        <ul className="text-sm text-gray-600 space-y-1 font-mono">
                            <li>📄 <span className="text-blue-700">manifest.json</span> — Configuración</li>
                            <li>⚙️ <span className="text-blue-700">background.js</span> — Motor de sesión + Supabase</li>
                            <li>🖥️ <span className="text-blue-700">content.js</span> — Overlay, timer y menú flotante</li>
                            <li>🪟 <span className="text-blue-700">popup.html / popup.js</span> — Panel de control</li>
                            <li>🖼️ <span className="text-blue-700">icons/</span> — Íconos</li>
                        </ul>
                    </div>

                    <div className="mt-3 bg-[#eef5f9] border border-[#cce1f0] rounded-lg p-3 text-sm text-fs-blue">
                        💡 También podés copiar la carpeta <code className="bg-[#d5e7f5] border border-[#cce1f0] px-1 rounded">chrome-extension/</code> desde un pendrive si ya la tenés disponible.
                    </div>
                </Step>

                {/* ---- PASO 2: INSTALAR EN CHROME ---- */}
                <Step number={2} color="bg-[#8CB83E] text-white" title="Instalar la Extensión en Chrome">
                    <p className="text-gray-600 mb-4">
                        Hacé esto en <strong>cada PC del stand</strong>:
                    </p>
                    <ol className="list-decimal list-inside space-y-4 text-sm text-gray-700">
                        <li>
                            <strong>Descomprimí</strong> el archivo ZIP en una carpeta local (ej: <code className="bg-gray-100 px-1 rounded">Escritorio\pc-stand\</code>).
                        </li>
                        <li>
                            Abrí Chrome y navegá a:
                            <div className="mt-1"><CodeBlock code="chrome://extensions" /></div>
                        </li>
                        <li>
                            Activá el <strong>"Modo desarrollador"</strong> desde el toggle en la <strong>esquina superior derecha</strong>.
                        </li>
                        <li>
                            Hacé clic en <strong>"Cargar extensión sin empaquetar"</strong> y seleccioná la carpeta descomprimida.
                        </li>
                        <li>
                            La extensión aparece con el nombre <strong>"PC Stand — Modo Kiosk"</strong> ✅
                        </li>
                    </ol>
                    <div className="mt-4 bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm text-primary-800">
                        ✅ El ícono 💻 aparece en la barra de Chrome. Si no lo ves, buscalo en el menú de extensiones 🧩 y fijalo con el pin 📌.
                    </div>
                </Step>

                {/* ---- PASO 3: CONFIGURAR ---- */}
                <Step number={3} color="bg-[#8CB83E] text-white" title="Configurar Evento y Número de PC">
                    <p className="text-gray-600 mb-4">
                        Al hacer clic en el ícono 💻 de la extensión, aparece el panel de configuración:
                    </p>
                    <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
                        <li>
                            En el campo <strong>"Evento"</strong>, seleccioná el evento al que pertenece esta PC.
                            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-500">
                                La lista se carga automáticamente desde el SGV. Si está vacía, verificá la conexión a internet.
                            </div>
                        </li>
                        <li>
                            En el campo <strong>"Número de PC"</strong>, ingresá el número asignado (ej: <code className="bg-gray-100 px-1 rounded">1</code>).
                        </li>
                        <li>
                            Hacé clic en <strong>"Guardar"</strong>.
                        </li>
                    </ol>
                    <div className="mt-4 bg-[#f1f8e9] border border-[#c5e1a5] rounded-lg p-3 text-sm text-[#33691e]">
                        🎉 ¡Listo! La extensión se activa inmediatamente. La pantalla se bloqueará mostrando el formulario de login para el primer voluntario.
                    </div>
                </Step>

                {/* ---- PASO 4: USO DIARIO ---- */}
                <Step number={4} color="bg-[#8CB83E] text-white" title="Flujo de Uso (día del evento)">
                    <div className="space-y-4">
                        <FlowStep
                            letter="A" color="bg-primary-100 text-primary-800"
                            title="PC Disponible → Login"
                            desc='La extensión bloquea la pantalla y muestra el selector de voluntario. El voluntario elige su nombre y hace clic en "Iniciar Sesión — 20 min".'
                        />
                        <FlowStep
                            letter="B" color="bg-[#eef5f9] text-fs-blue"
                            title="Sesión Activa → Timer flotante"
                            desc="El overlay desaparece. Un badge verde en la esquina inferior derecha muestra el tiempo restante. Al hacer clic se abre el menú de accesos rápidos a actividades de FamilySearch."
                        />
                        <FlowStep
                            letter="C" color="bg-amber-100 text-amber-700"
                            title="Tiempo Expirado → Reporte o Prórroga"
                            desc='La extensión vuelve a bloquear la pantalla con el formulario de reporte. El voluntario puede pedir "+5 minutos" o completar el reporte y liberar la PC.'
                        />
                        <FlowStep
                            letter="D" color="bg-gray-100 text-gray-700"
                            title="Reporte Enviado → PC Libre"
                            desc="La PC queda disponible para el siguiente voluntario y el ciclo comienza de nuevo."
                        />
                    </div>

                    {/* Widget flotante */}
                    <div className="mt-5 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">🕐 Menú flotante durante la sesión:</p>
                        <div className="text-sm text-gray-600 space-y-1">
                            <p>→ Badge verde con el timer en la <strong>esquina inferior derecha</strong></p>
                            <p>→ Al hacer clic en el badge se abre el panel con accesos directos:</p>
                            <ul className="ml-4 mt-1 space-y-0.5 text-xs font-mono text-gray-500">
                                <li>🌳 Crear Árbol · 🎁 Regalo · 📖 Apellido · 📷 Rincón de tus Abuelos · ❓ Ayuda</li>
                            </ul>
                            <p>→ El badge cambia a <span className="text-orange-500 font-medium">naranja</span> cuando quedan 5 min y a <span className="text-red-500 font-medium">rojo</span> cuando queda 1 min</p>
                        </div>
                    </div>
                </Step>

                {/* ---- TROUBLESHOOTING ---- */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
                    <button
                        onClick={() => setShowTroubleshooting(prev => !prev)}
                        className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertTriangle size={18} className="text-red-600" />
                            </div>
                            <span className="text-xl font-semibold">Solución de Problemas</span>
                        </div>
                        {showTroubleshooting ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                    </button>
                    {showTroubleshooting && (
                        <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-5">

                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1">❌ El ícono no aparece en Chrome</h3>
                                <p className="text-sm text-gray-600">Buscalo en el menú 🧩 y fijalo con el pin 📌 al lado de "PC Stand — Modo Kiosk".</p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1">❌ El selector de evento está vacío</h3>
                                <p className="text-sm text-gray-600">La PC no tiene acceso a internet o no hay eventos activos en el SGV. Verificá la conexión y que el evento esté en estado "Activo" en el panel de administración.</p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1">❌ El overlay no aparece en la PC</h3>
                                <p className="text-sm text-gray-600">Verificá que la extensión esté activa en <code className="bg-gray-100 px-1 rounded">chrome://extensions</code> y que hayas guardado el evento y número de PC en el popup.</p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1">❌ Los voluntarios no aparecen en el dropdown</h3>
                                <p className="text-sm text-gray-600">Si seleccionaste un evento, la extensión busca voluntarios con inscripción confirmada en ese evento. Si nadie se inscribió aún, mostrará todos los usuarios activos como fallback.</p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1">❌ El timer se congela o se detiene</h3>
                                <p className="text-sm text-gray-600">La extensión usa <code className="bg-gray-100 px-1 rounded">chrome.alarms</code> para sobrevivir a la suspensión del navegador. Hacé clic en "🔄 Actualizar" en el popup para forzar una sincronización.</p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1">❌ Necesito desactivar la extensión de urgencia</h3>
                                <p className="text-sm text-gray-600">
                                    Navegá a <code className="bg-gray-100 px-1 rounded">chrome://extensions</code> y desactivá "PC Stand — Modo Kiosk", o usá el popup → "⚙️ Cambiar PC" para resetear la configuración.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1">❌ ChromeOS Flex bloquea la instalación</h3>
                                <p className="text-sm text-gray-600">
                                    En ChromeOS administrado, el modo desarrollador puede estar restringido. En ese caso, pedile al administrador del dominio que la publique en la Chrome Web Store privada del Google Workspace.
                                </p>
                            </div>
                        </div>
                    )}
                </section>

                {/* ---- RESUMEN RÁPIDO ---- */}
                <section className="bg-[#f1f8e9] border border-[#c5e1a5] rounded-xl p-6 mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap size={18} className="text-[#558b2f]" />
                        <h3 className="font-semibold text-[#33691e]">Checklist rápida (PC ya instalada)</h3>
                    </div>
                    <p className="text-sm text-[#33691e] mb-3">Si la extensión ya estaba configurada de una sesión anterior, verificá:</p>
                    <ol className="list-decimal list-inside text-sm text-[#33691e] space-y-1">
                        <li>Chrome está abierto</li>
                        <li>La extensión está activa en <code className="bg-[#dcedc8] px-1 rounded">chrome://extensions</code></li>
                        <li>El <strong>evento seleccionado</strong> es el correcto (verificar en popup 💻)</li>
                        <li>El <strong>número de PC</strong> es el asignado para este stand</li>
                        <li>La PC tiene conexión a internet</li>
                    </ol>
                </section>

            </main>
        </div>
    );
};

export default PCSetupInstructions;
