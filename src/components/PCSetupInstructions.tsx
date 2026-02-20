import React, { useState } from 'react';
import { Chrome, Download, Info, Check, Copy, AlertTriangle, Wifi, Monitor, Zap, ChevronDown, ChevronUp, Clock, Shield, Layers } from 'lucide-react';
import { toast } from 'react-hot-toast';

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

interface CodeBlockProps {
    code: string;
    copyText?: string;
}

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

const PCSetupInstructions: React.FC = () => {
    const [showTroubleshooting, setShowTroubleshooting] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <header className="bg-white border-b border-gray-200 mb-2">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Chrome size={28} className="text-blue-600" />
                        <h1 className="text-3xl font-bold text-gray-900">Configuración de PC del Stand</h1>
                    </div>
                    <p className="text-gray-500 text-base">
                        Instalación de la Extensión de Chrome — Sin Python, sin dependencias.
                    </p>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">

                {/* Ventajas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                        <Layers size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <strong>Funciona en todo:</strong> Windows, ChromeOS Flex y Mac. Solo necesitás Chrome.
                        </div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                        <Zap size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-green-800">
                            <strong>Sin instalaciones:</strong> Solo copiá la carpeta del pendrive y cargala en Chrome.
                        </div>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
                        <Clock size={20} className="text-purple-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-purple-800">
                            <strong>Timer visible:</strong> El voluntario ve el tiempo restante en todo momento.
                        </div>
                    </div>
                </div>

                {/* Nota sobre PC ID */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                        <strong>¿Qué número de PC usar?</strong> El administrador del evento asigna un ID único a cada computadora (ej: PC 1, PC 2, PC 3...). Consultalo antes de continuar — lo vas a necesitar en el Paso 3.
                    </div>
                </div>

                {/* Paso 1: Copiar la carpeta */}
                <Step number={1} color="bg-blue-100 text-blue-600" title="Obtener la Extensión">
                    <p className="text-gray-600 mb-3">
                        La extensión ya está lista para usar. Copiá la carpeta <code className="bg-gray-100 px-1 rounded">chrome-extension/</code> a un <strong>pendrive USB</strong> o accedé a ella directamente desde la red si las PCs tienen acceso compartido.
                    </p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">La carpeta contiene:</p>
                        <ul className="text-sm text-gray-600 space-y-1 font-mono">
                            <li>📄 <span className="text-blue-700">manifest.json</span> — Configuración de la extensión</li>
                            <li>⚙️ <span className="text-blue-700">background.js</span> — Control de sesión y Supabase</li>
                            <li>🖥️ <span className="text-blue-700">content.js / content.css</span> — Overlay y timer flotante</li>
                            <li>🪟 <span className="text-blue-700">popup.html / popup.js</span> — Panel de control</li>
                            <li>🖼️ <span className="text-blue-700">icons/</span> — Íconos de la extensión</li>
                        </ul>
                    </div>
                </Step>

                {/* Paso 2: Cargar en Chrome */}
                <Step number={2} color="bg-indigo-100 text-indigo-600" title="Cargar la Extensión en Chrome">
                    <p className="text-gray-600 mb-4">
                        En cada PC del stand, seguí estos pasos para instalar la extensión:
                    </p>
                    <ol className="list-decimal list-inside space-y-4 text-sm text-gray-700">
                        <li>
                            Abrí Chrome y navegá a:
                            <div className="mt-1">
                                <CodeBlock code="chrome://extensions" />
                            </div>
                        </li>
                        <li>
                            Activá el <strong>"Modo desarrollador"</strong> usando el toggle en la <strong>esquina superior derecha</strong> de la página.
                        </li>
                        <li>
                            Hacé clic en el botón <strong>"Cargar extensión sin empaquetar"</strong> que aparece a la izquierda.
                        </li>
                        <li>
                            Navegá hasta la carpeta <code className="bg-gray-100 px-1 rounded">chrome-extension/</code> y hacé clic en <strong>"Seleccionar carpeta"</strong>.
                        </li>
                        <li>
                            La extensión aparece en la lista con el nombre <strong>"PC Stand Controller"</strong>. ✅
                        </li>
                    </ol>
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                        ✅ El ícono 💻 de la extensión aparece en la barra de herramientas de Chrome (puede estar dentro del menú de extensiones 🧩).
                    </div>
                </Step>

                {/* Paso 3: Configurar PC ID */}
                <Step number={3} color="bg-green-100 text-green-600" title="Configurar el Número de PC">
                    <p className="text-gray-600 mb-4">
                        Una vez instalada, ingresá el número de PC que el administrador te asignó:
                    </p>
                    <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
                        <li>
                            Hacé clic en el ícono 💻 de la extensión en la barra de Chrome (o en el menú 🧩).
                        </li>
                        <li>
                            Aparece el panel de control. En el campo <strong>"Número de PC"</strong>, ingresá el número asignado (ej: <code className="bg-gray-100 px-1 rounded">1</code>).
                        </li>
                        <li>
                            Hacé clic en <strong>"Guardar"</strong>.
                        </li>
                    </ol>
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                        🎉 ¡Listo! La extensión se activa inmediatamente. Si la PC está disponible, verás el formulario de login de voluntario cubriendo la pantalla. Si está ocupada, verás el timer flotante.
                    </div>
                </Step>

                {/* Paso 4: Cómo se usa */}
                <Step number={4} color="bg-purple-100 text-purple-600" title="Flujo de Uso (para el día del evento)">
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">A</div>
                            <div>
                                <p className="font-semibold text-gray-800 text-sm">PC Disponible</p>
                                <p className="text-sm text-gray-600">La extensión bloquea la pantalla y muestra el selector de voluntario. El voluntario elige su nombre y hace clic en "Iniciar Sesión (20 min)".</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">B</div>
                            <div>
                                <p className="font-semibold text-gray-800 text-sm">Sesión Activa</p>
                                <p className="text-sm text-gray-600">El overlay desaparece y el voluntario puede navegar libremente en FamilySearch. Un <strong>timer flotante</strong> en la esquina inferior derecha muestra el tiempo restante.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">C</div>
                            <div>
                                <p className="font-semibold text-gray-800 text-sm">Tiempo Expirado</p>
                                <p className="text-sm text-gray-600">La extensión vuelve a bloquear la pantalla con el formulario de reporte. El voluntario puede pedir <strong>+5 minutos</strong> o completar el reporte y liberar la PC.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-bold">D</div>
                            <div>
                                <p className="font-semibold text-gray-800 text-sm">Reporte Enviado</p>
                                <p className="text-sm text-gray-600">La PC queda libre y vuelve al estado "Disponible" para el siguiente voluntario.</p>
                            </div>
                        </div>
                    </div>
                </Step>

                {/* Troubleshooting */}
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
                                <h3 className="font-semibold text-gray-800 mb-1">❌ El ícono de la extensión no aparece</h3>
                                <p className="text-sm text-gray-600">Buscalo en el menú de extensiones (ícono 🧩 en la barra de Chrome). Podés fijarlo haciendo clic en el pin 📌 al lado de "PC Stand Controller".</p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1">❌ El overlay no aparece en la PC</h3>
                                <p className="text-sm text-gray-600">Verificá que la extensión esté activa (no desactivada) en <code className="bg-gray-100 px-1 rounded">chrome://extensions</code>. También asegurate de haber guardado el número de PC en el popup.</p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1">❌ "Error al conectar" al cargar voluntarios</h3>
                                <p className="text-sm text-gray-600">La PC no tiene conexión a internet o Supabase no está disponible. Verificá la conexión de red e intentá de nuevo.</p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1">❌ La extensión no bloquea nuevas pestañas</h3>
                                <p className="text-sm text-gray-600">El content script se injecta cuando la pestaña termina de cargar. Si el voluntario abre una nueva pestaña muy rápido, puede tardar 1-2 segundos en aparecer el overlay. Es normal.</p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1">❌ Necesito desactivar la extensión de urgencia</h3>
                                <p className="text-sm text-gray-600">
                                    Navegá a <code className="bg-gray-100 px-1 rounded">chrome://extensions</code> y desactivá "PC Stand Controller" temporalmente, o usá el popup para cambiar el número de PC a uno no registrado.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1">❌ ChromeOS Flex no permite instalar extensiones no empaquetadas</h3>
                                <p className="text-sm text-gray-600">
                                    En algunos ChromeOS administrados, el modo desarrollador puede estar restringido. En ese caso, pedí al administrador del dominio que la publique en la Chrome Web Store privada, o usá una cuenta no administrada.
                                </p>
                            </div>
                        </div>
                    )}
                </section>

                {/* Resumen rápido */}
                <section className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap size={18} className="text-indigo-600" />
                        <h3 className="font-semibold text-indigo-900">Resumen rápido (PC ya configurada)</h3>
                    </div>
                    <p className="text-sm text-indigo-800 mb-3">Si la extensión ya está instalada de una sesión anterior, solo verificá:</p>
                    <ol className="list-decimal list-inside text-sm text-indigo-800 space-y-1">
                        <li>Que Chrome esté abierto</li>
                        <li>Que la extensión esté activa en <code className="bg-indigo-100 px-1 rounded">chrome://extensions</code></li>
                        <li>Que el número de PC sea correcto (verificar en el popup 💻)</li>
                    </ol>
                </section>

            </main>
        </div>
    );
};

export default PCSetupInstructions;
