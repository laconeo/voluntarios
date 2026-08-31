import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Printer, User, Image as ImageIcon, Upload, X, RotateCcw, Check, Loader2 } from 'lucide-react';
import { supabaseApi as mockApi } from '../services/supabaseApiService';
import type { Event } from '../types';
import { toast } from 'react-hot-toast';

const baseUrl = import.meta.env.BASE_URL || '/';
const voluntarioImg = `${baseUrl}VOLUNTARIO.png`;
const coordinadorImg = `${baseUrl}COORDINADOR.png`;

interface VolunteerBadgesProps {
    eventId: string;
    onClose: () => void;
}

interface BadgeData {
    id: string;
    volunteerName: string;
    roleName: string;
}

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const MAX_SIZE = 1200;
                if (width > MAX_SIZE || height > MAX_SIZE) {
                    if (width > height) {
                        height = Math.round((height * MAX_SIZE) / width);
                        width = MAX_SIZE;
                    } else {
                        width = Math.round((width * MAX_SIZE) / height);
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.88));
                } else {
                    resolve(e.target?.result as string);
                }
            };
            img.onerror = () => reject(new Error('Error al procesar la imagen'));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsDataURL(file);
    });
};

const VolunteerBadges: React.FC<VolunteerBadgesProps> = ({ eventId, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [badges, setBadges] = useState<BadgeData[]>([]);
    const [event, setEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Modal state for background configuration
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [draftBgVoluntario, setDraftBgVoluntario] = useState<string>('');
    const [draftBgCoordinador, setDraftBgCoordinador] = useState<string>('');
    const [draftWidthMm, setDraftWidthMm] = useState<number>(90);
    const [draftHeightMm, setDraftHeightMm] = useState<number>(110);
    const [draftFontSizePt, setDraftFontSizePt] = useState<number>(24);
    const [draftNamePositionY, setDraftNamePositionY] = useState<number>(48);
    const [isSavingBg, setIsSavingBg] = useState(false);

    const fileInputVoluntarioRef = useRef<HTMLInputElement>(null);
    const fileInputCoordinadorRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchData();
    }, [eventId]);

    // Update selected IDs when badges change (initially select all)
    useEffect(() => {
        if (badges.length > 0 && selectedIds.size === 0) {
            setSelectedIds(new Set(badges.map(b => b.id)));
        }
    }, [badges]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [eventData, bookings, allShifts] = await Promise.all([
                mockApi.getEventById(eventId),
                mockApi.getBookingsByEvent(eventId),
                mockApi.getShiftsByEvent(eventId)
            ]);

            setEvent(eventData);
            if (eventData) {
                setDraftBgVoluntario(eventData.credentialBgVoluntarioUrl || '');
                setDraftBgCoordinador(eventData.credentialBgCoordinadorUrl || '');
                setDraftWidthMm(eventData.credentialWidthMm || 90);
                setDraftHeightMm(eventData.credentialHeightMm || 110);
                setDraftFontSizePt(eventData.credentialNameFontSizePt || 24);
                setDraftNamePositionY(eventData.credentialNamePositionY ?? 48);
            }

            // Fetch all users to get names
            const allUsers = await mockApi.getAllUsers();

            // Set to keep track of unique UserID-Role combinations
            const uniqueEntries = new Set<string>();
            const badgeList: BadgeData[] = [];

            // 1. Process Bookings (Volunteers)
            bookings.filter(b => b.status === 'confirmed').forEach(b => {
                const user = allUsers.find(u => u.id === b.userId);
                if (user) {
                    const key = `${user.id}|Voluntario`;
                    if (!uniqueEntries.has(key)) {
                        uniqueEntries.add(key);
                        badgeList.push({
                            id: key,
                            volunteerName: user.fullName,
                            roleName: 'Voluntario'
                        });
                    }
                }
            });

            // 2. Process Coordinators
            allShifts.forEach(shift => {
                if (shift.coordinatorIds) {
                    shift.coordinatorIds.forEach(coordId => {
                        const user = allUsers.find(u => u.id === coordId);
                        if (user) {
                            const key = `${user.id}|Coordinador`;
                            if (!uniqueEntries.has(key)) {
                                uniqueEntries.add(key);
                                badgeList.push({
                                    id: key,
                                    volunteerName: user.fullName,
                                    roleName: 'Coordinador'
                                });
                            }
                        }
                    });
                }
            });

            badgeList.sort((a, b) => a.volunteerName.localeCompare(b.volunteerName));
            setBadges(badgeList);
        } catch (error) {
            console.error('Error fetching badge data:', error);
            toast.error('Error al cargar datos para credenciales');
        } finally {
            setIsLoading(false);
        }
    };

    const openConfigModal = () => {
        setDraftBgVoluntario(event?.credentialBgVoluntarioUrl || '');
        setDraftBgCoordinador(event?.credentialBgCoordinadorUrl || '');
        setDraftWidthMm(event?.credentialWidthMm || 90);
        setDraftHeightMm(event?.credentialHeightMm || 110);
        setDraftFontSizePt(event?.credentialNameFontSizePt || 24);
        setDraftNamePositionY(event?.credentialNamePositionY ?? 48);
        setIsConfigModalOpen(true);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, role: 'Voluntario' | 'Coordinador') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Por favor selecciona un archivo de imagen válido');
            return;
        }

        try {
            const dataUrl = await compressImage(file);
            if (role === 'Voluntario') {
                setDraftBgVoluntario(dataUrl);
            } else {
                setDraftBgCoordinador(dataUrl);
            }
            toast.success(`Imagen de ${role} cargada`);
        } catch (err) {
            console.error(err);
            toast.error('No se pudo procesar la imagen');
        }
    };

    const handleSaveBackgrounds = async () => {
        if (!event) return;
        setIsSavingBg(true);
        try {
            const clampedWidth = Math.min(Math.max(draftWidthMm, 50), 200);
            const clampedHeight = Math.min(Math.max(draftHeightMm, 50), 300);
            const clampedFontSize = Math.min(Math.max(draftFontSizePt, 6), 72);
            const clampedPositionY = Math.min(Math.max(draftNamePositionY, 0), 100);

            // Actualizamos el estado local inmediatamente con los valores del draft
            const localUpdatedEvent: typeof event = {
                ...event,
                credentialBgVoluntarioUrl: draftBgVoluntario || event.credentialBgVoluntarioUrl,
                credentialBgCoordinadorUrl: draftBgCoordinador || event.credentialBgCoordinadorUrl,
                credentialWidthMm: clampedWidth,
                credentialHeightMm: clampedHeight,
                credentialNameFontSizePt: clampedFontSize,
                credentialNamePositionY: clampedPositionY,
            };
            setEvent(localUpdatedEvent);
            setDraftWidthMm(clampedWidth);
            setDraftHeightMm(clampedHeight);
            setDraftFontSizePt(clampedFontSize);
            setDraftNamePositionY(clampedPositionY);

            // Intentamos persistir en Supabase (puede fallar si las columnas no existen aún)
            try {
                const updatedEvent = await mockApi.updateEvent(event.id, {
                    credentialBgVoluntarioUrl: draftBgVoluntario || undefined,
                    credentialBgCoordinadorUrl: draftBgCoordinador || undefined,
                    credentialWidthMm: clampedWidth,
                    credentialHeightMm: clampedHeight,
                    credentialNameFontSizePt: clampedFontSize,
                    credentialNamePositionY: clampedPositionY,
                });
                setEvent(updatedEvent);
            } catch (dbError) {
                // Las columnas pueden no existir en la BD aún; los datos ya están en localStorage
                console.warn('[VolunteerBadges] No se pudo persistir en Supabase, usando localStorage:', dbError);
            }

            toast.success('Configuración de credenciales guardada con éxito');
            setIsConfigModalOpen(false);
        } catch (error) {
            console.error('Error inesperado al guardar configuración:', error);
            toast.error('Error al guardar la configuración');
        } finally {
            setIsSavingBg(false);
        }
    };

    const getBadgeBg = (roleName: string) => {
        if (roleName === 'Coordinador') {
            return event?.credentialBgCoordinadorUrl || coordinadorImg;
        }
        return event?.credentialBgVoluntarioUrl || voluntarioImg;
    };

    const handlePrint = () => {
        if (selectedIds.size === 0) {
            toast.error('No hay credenciales seleccionadas para imprimir');
            return;
        }
        window.print();
    };

    const toggleSelectAll = () => {
        const filtered = badges.filter(b => 
            b.volunteerName.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(b => b.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const filteredBadges = badges.filter(b => 
        b.volunteerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8CB83E]"></div>
                <p className="mt-4 text-gray-500 font-medium">Preparando credenciales...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20 print:bg-white print:pb-0 print:min-h-0">
            {/* Header - Hidden on print */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-50 print:hidden shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                title="Volver"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 leading-tight">Credenciales</h2>
                                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">{event?.nombre}</p>
                            </div>
                        </div>

                        <div className="flex flex-1 max-w-md">
                            <div className="relative w-full">
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8CB83E] focus:border-transparent outline-none text-sm"
                                />
                                <div className="absolute left-3 top-2.5 text-gray-400">
                                    <User size={18} />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-right mr-2">
                                <p className="text-sm font-bold text-gray-900">{selectedIds.size} seleccionadas</p>
                                <button 
                                    onClick={toggleSelectAll}
                                    className="text-xs text-[#8CB83E] font-semibold hover:underline"
                                >
                                    {selectedIds.size === filteredBadges.length ? 'Deseleccionar todas' : 'Seleccionar visibles'}
                                </button>
                            </div>

                            <button
                                onClick={openConfigModal}
                                className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 font-semibold shadow-sm transition-all active:scale-95 text-sm"
                                title="Subir o cambiar imágenes de fondo"
                            >
                                <ImageIcon size={18} className="text-[#8CB83E]" />
                                <span className="hidden sm:inline">Configurar Fondos</span>
                            </button>

                            <button
                                onClick={handlePrint}
                                disabled={selectedIds.size === 0}
                                className="flex items-center justify-center gap-2 bg-[#8CB83E] text-white px-5 py-2.5 rounded-xl hover:bg-[#7cb342] font-bold shadow-md shadow-green-100 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none text-sm"
                            >
                                <Printer size={18} />
                                Imprimir Selección
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Badges Container */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 print:p-0 print:m-0 print:max-w-none">
                {/* Mosaic and Styles */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                        @media print {
                            @page {
                                size: A4 portrait;
                                margin: 10mm;
                            }
                            /* Force everything to white background except cards */
                            html, body, #root, .min-h-screen, .bg-gray-50, .max-w-7xl, .badge-mosaic {
                                background-color: white !important;
                                background-image: none !important;
                            }
                            body {
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            .print-container {
                                display: block !important;
                                padding: 0 !important;
                                margin: 0 !important;
                                width: 100% !important;
                                max-width: none !important;
                                background-color: white !important;
                            }
                            .badge-mosaic {
                                display: grid !important;
                                grid-template-columns: repeat(2, ${event?.credentialWidthMm || 90}mm) !important;
                                gap: 0 !important; 
                                row-gap: 0 !important;
                                justify-content: center !important;
                                align-content: start !important;
                                margin: 0 auto !important;
                                padding: 0 !important;
                                background-color: white !important;
                            }
                            .badge-card {
                                display: none !important;
                            }
                            .badge-card.selected {
                                display: flex !important;
                                width: ${event?.credentialWidthMm || 90}mm !important;
                                height: ${event?.credentialHeightMm || 110}mm !important;
                                border: 0.1mm solid #eee !important;
                                margin: 0 !important;
                                box-shadow: none !important;
                                break-inside: avoid;
                                page-break-inside: avoid;
                                background-size: 100% 100% !important;
                                background-position: center !important;
                                background-repeat: no-repeat !important;
                                transform: none !important;
                                box-sizing: border-box !important;
                                background-color: white !important;
                            }
                            .no-print {
                                display: none !important;
                            }
                        }

                    .badge-mosaic {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, ${event?.credentialWidthMm || 90}mm);
                        gap: 20px;
                        justify-content: center;
                    }

                    .badge-card {
                        width: ${event?.credentialWidthMm || 90}mm;
                        height: ${event?.credentialHeightMm || 110}mm;
                        background: white;
                        background-size: 100% 100%;
                        background-position: center;
                        background-repeat: no-repeat;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                        position: relative;
                        transition: all 0.2s;
                        flex-shrink: 0;
                        cursor: pointer;
                    }

                    .badge-card.selected {
                        border-color: #8CB83E;
                        border-width: 4px;
                        box-shadow: 0 0 0 4px rgba(140, 184, 62, 0.2);
                        transform: scale(1.02);
                    }

                    .name-container {
                        position: absolute;
                        left: 0;
                        right: 0;
                        transform: translateY(-50%);
                        text-align: center;
                        padding: 0 10mm;
                        pointer-events: none;
                    }

                    .selection-overlay {
                        position: absolute;
                        top: 10px;
                        left: 10px;
                        z-index: 20;
                    }

                    .custom-checkbox {
                        width: 24px;
                        height: 24px;
                        border: 2px solid #8CB83E;
                        border-radius: 6px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: white;
                        transition: all 0.2s;
                    }
                `}} />

                <div className="badge-mosaic print-container">
                    {filteredBadges.map((badge) => {
                        const isSelected = selectedIds.has(badge.id);
                        const bgUrl = getBadgeBg(badge.roleName);

                        return (
                            <div 
                                key={badge.id} 
                                className={`badge-card ${isSelected ? 'selected' : ''}`}
                                id={`badge-${badge.id}`}
                                onClick={() => toggleSelect(badge.id)}
                                style={{ 
                                    backgroundImage: `url("${bgUrl}")` 
                                }}
                            >
                                {/* Selection Indicator */}
                                <div className="selection-overlay print:hidden">
                                    <div className={`custom-checkbox ${isSelected ? 'checked' : ''}`}>
                                        {isSelected && <div className="w-2.5 h-2.5 bg-[#8CB83E] rounded-sm" />}
                                    </div>
                                </div>

                                {/* Volunteer Name centered in the card */}
                                <div
                                    className="name-container"
                                    style={{ top: `${event?.credentialNamePositionY ?? 48}%` }}
                                >
                                    <h2 style={{ fontSize: `${event?.credentialNameFontSizePt || 24}pt` }} className="font-black text-gray-800 uppercase tracking-tight leading-tight break-words">
                                        {badge.volunteerName}
                                    </h2>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredBadges.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                        <User size={48} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-bold text-gray-900">Sin resultados</h3>
                        <p className="text-gray-500">No se encontraron voluntarios que coincidan con su búsqueda.</p>
                    </div>
                )}
            </div>

            {/* Modal: Configuración de Imágenes de Fondo */}
            {isConfigModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn print:hidden">
                    <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 text-[#8CB83E] rounded-xl">
                                    <ImageIcon size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Configurar Credencial</h3>
                                    <p className="text-xs text-gray-500">Personaliza el fondo y las dimensiones de la credencial</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsConfigModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {/* Dimensiones */}
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                                <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
                                    <span className="w-2.5 h-2.5 bg-blue-400 rounded-full inline-block"></span>
                                    Dimensiones de la Credencial
                                </h4>
                                <p className="text-xs text-gray-500 mb-4">Ajusta el tamaño para que la imagen de fondo encaje perfectamente sin recortarse.</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Ancho (mm)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min={50}
                                                max={200}
                                                value={draftWidthMm}
                                                onChange={(e) => setDraftWidthMm(Number(e.target.value))}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                                            />
                                            <span className="text-xs text-gray-400 whitespace-nowrap">50–200</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Alto (mm)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min={50}
                                                max={300}
                                                value={draftHeightMm}
                                                onChange={(e) => setDraftHeightMm(Number(e.target.value))}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                                            />
                                            <span className="text-xs text-gray-400 whitespace-nowrap">50–300</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-blue-600 mt-3 font-medium">📐 Tamaño actual: {draftWidthMm}mm × {draftHeightMm}mm — Predeterminado: 90mm × 110mm</p>
                            </div>

                            {/* Tamaño de fuente del nombre */}
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                                <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-1">
                                    <span className="w-2.5 h-2.5 bg-purple-400 rounded-full inline-block"></span>
                                    Tamaño de Fuente del Nombre
                                </h4>
                                <p className="text-xs text-gray-500 mb-4">Ajusta el tamaño de la letra del nombre para que se vea proporcionado. Útil cuando la persona tiene nombre y apellidos largos.</p>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min={6}
                                        max={72}
                                        step={1}
                                        value={draftFontSizePt}
                                        onChange={(e) => setDraftFontSizePt(Number(e.target.value))}
                                        className="flex-1 h-2 bg-purple-200 rounded-full appearance-none cursor-pointer accent-purple-500"
                                    />
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number"
                                            min={6}
                                            max={72}
                                            value={draftFontSizePt}
                                            onChange={(e) => setDraftFontSizePt(Number(e.target.value))}
                                            className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none font-bold"
                                        />
                                        <span className="text-xs text-gray-400 whitespace-nowrap">pt</span>
                                    </div>
                                </div>
                                {/* Preview en vivo */}
                                <div className="mt-4 bg-white rounded-lg border border-purple-100 p-3 text-center overflow-hidden">
                                    <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-wider">Vista previa</p>
                                    <p
                                        style={{ fontSize: `${draftFontSizePt}pt`, lineHeight: '1.1' }}
                                        className="font-black text-gray-800 uppercase tracking-tight break-words leading-tight"
                                    >
                                        Nombre Apellido
                                    </p>
                                </div>
                                <p className="text-xs text-purple-600 mt-3 font-medium">🔤 Tamaño actual: {draftFontSizePt}pt — Predeterminado: 24pt (rango: 6pt–72pt)</p>
                            </div>

                            {/* Posición vertical del nombre */}
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                                <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-1">
                                    <span className="w-2.5 h-2.5 bg-orange-400 rounded-full inline-block"></span>
                                    Posición Vertical del Nombre
                                </h4>
                                <p className="text-xs text-gray-500 mb-4">Mueve el nombre hacia arriba o abajo dentro de la credencial para centrarlo sobre la zona correcta del diseño.</p>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-400 whitespace-nowrap">Arriba</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={draftNamePositionY}
                                        onChange={(e) => setDraftNamePositionY(Number(e.target.value))}
                                        className="flex-1 h-2 bg-orange-200 rounded-full appearance-none cursor-pointer accent-orange-500"
                                    />
                                    <span className="text-xs text-gray-400 whitespace-nowrap">Abajo</span>
                                    <div className="flex items-center gap-1.5 ml-2">
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={draftNamePositionY}
                                            onChange={(e) => setDraftNamePositionY(Number(e.target.value))}
                                            className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none font-bold"
                                        />
                                        <span className="text-xs text-gray-400">%</span>
                                    </div>
                                </div>
                                {/* Preview en vivo */}
                                <div className="mt-4 bg-white rounded-lg border border-orange-100 overflow-hidden relative" style={{ height: '80px' }}>
                                    <p className="text-[10px] text-gray-400 absolute top-1 left-0 right-0 text-center uppercase tracking-wider">Vista previa</p>
                                    <div
                                        className="absolute left-0 right-0 text-center"
                                        style={{ top: `${draftNamePositionY}%`, transform: 'translateY(-50%)' }}
                                    >
                                        <p className="font-black text-gray-800 uppercase tracking-tight text-sm leading-tight">
                                            Nombre Apellido
                                        </p>
                                    </div>
                                    {/* Línea guía */}
                                    <div
                                        className="absolute left-0 right-0 border-t border-dashed border-orange-300 opacity-50"
                                        style={{ top: `${draftNamePositionY}%` }}
                                    />
                                </div>
                                <p className="text-xs text-orange-600 mt-3 font-medium">📍 Posición actual: {draftNamePositionY}% — Predeterminado: 48% (0% = arriba, 100% = abajo)</p>
                            </div>

                            {/* Card 1: Voluntario */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full inline-block"></span>
                                            Fondo Credencial Voluntario
                                        </h4>
                                        <p className="text-xs text-gray-500">Se usará en la credencial de los voluntarios confirmados</p>
                                    </div>
                                    {draftBgVoluntario && (
                                        <button
                                            onClick={() => setDraftBgVoluntario('')}
                                            className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors"
                                        >
                                            <RotateCcw size={12} />
                                            Restablecer por defecto
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    {/* Preview */}
                                    <div 
                                        className="w-28 h-36 rounded-lg border border-gray-300 bg-white shadow-sm flex-shrink-0 bg-cover bg-center relative overflow-hidden flex flex-col justify-center items-center"
                                        style={{ backgroundImage: `url("${draftBgVoluntario || voluntarioImg}")` }}
                                    >
                                        <span className="bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-xs uppercase">
                                            Ejemplo
                                        </span>
                                    </div>

                                    {/* Upload Control */}
                                    <div className="flex-1 w-full flex flex-col justify-center">
                                        <input
                                            ref={fileInputVoluntarioRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleFileChange(e, 'Voluntario')}
                                        />
                                        <button
                                            onClick={() => fileInputVoluntarioRef.current?.click()}
                                            className="w-full border-2 border-dashed border-[#8CB83E] hover:bg-green-50/50 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
                                        >
                                            <Upload size={24} className="text-[#8CB83E] group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-semibold text-gray-700">Subir nueva imagen de Voluntario</span>
                                            <span className="text-xs text-gray-400">PNG, JPG, WEBP (Recomendado 90mm x 110mm)</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Coordinador */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block"></span>
                                            Fondo Credencial Coordinador
                                        </h4>
                                        <p className="text-xs text-gray-500">Se usará en la credencial de los coordinadores asignados</p>
                                    </div>
                                    {draftBgCoordinador && (
                                        <button
                                            onClick={() => setDraftBgCoordinador('')}
                                            className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors"
                                        >
                                            <RotateCcw size={12} />
                                            Restablecer por defecto
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    {/* Preview */}
                                    <div 
                                        className="w-28 h-36 rounded-lg border border-gray-300 bg-white shadow-sm flex-shrink-0 bg-cover bg-center relative overflow-hidden flex flex-col justify-center items-center"
                                        style={{ backgroundImage: `url("${draftBgCoordinador || coordinadorImg}")` }}
                                    >
                                        <span className="bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-xs uppercase">
                                            Ejemplo
                                        </span>
                                    </div>

                                    {/* Upload Control */}
                                    <div className="flex-1 w-full flex flex-col justify-center">
                                        <input
                                            ref={fileInputCoordinadorRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleFileChange(e, 'Coordinador')}
                                        />
                                        <button
                                            onClick={() => fileInputCoordinadorRef.current?.click()}
                                            className="w-full border-2 border-dashed border-[#8CB83E] hover:bg-green-50/50 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
                                        >
                                            <Upload size={24} className="text-[#8CB83E] group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-semibold text-gray-700">Subir nueva imagen de Coordinador</span>
                                            <span className="text-xs text-gray-400">PNG, JPG, WEBP (Recomendado 90mm x 110mm)</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
                            <button
                                onClick={() => setIsConfigModalOpen(false)}
                                className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-200/60 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveBackgrounds}
                                disabled={isSavingBg}
                                className="flex items-center gap-2 bg-[#8CB83E] text-white px-6 py-2.5 rounded-xl hover:bg-[#7cb342] font-bold shadow-md shadow-green-100 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSavingBg ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Check size={18} />
                                        Guardar Cambios
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VolunteerBadges;
