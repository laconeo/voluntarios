import React, { useState, useEffect, useRef } from 'react';
import type { User } from '../types';
import { Lock } from 'lucide-react';
import Modal from './Modal';
import { toast } from 'react-hot-toast';

interface LoginProps {
  onLogin: (identifier: string, password?: string) => Promise<boolean | 'password_required' | 'register'>;
  onRegister: (newUser: User) => void;
  initialDni?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, onRegister, initialDni }) => {
  const [identifier, setIdentifier] = useState(initialDni || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(!!initialDni);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [termsContent, setTermsContent] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Omit<User, 'id' | 'role'>>({
    dni: initialDni || '',
    fullName: '',
    email: '',
    phone: '',
    tshirtSize: 'M',
    isMember: false,
    attendedPrevious: false,
    isOver18: false,
    howTheyHeard: 'Redes Sociales',
  });
  const [agreed, setAgreed] = useState(false);

  // Auto-focus en el campo de identificador al cargar
  useEffect(() => {
    if (inputRef.current && !isRegistering) {
      inputRef.current.focus();
    }
  }, [isRegistering]);

  // Cargar términos y condiciones
  useEffect(() => {
    // Use BASE_URL to ensure correct path in production (GitHub Pages)
    const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    fetch(`${baseUrl}terminos-voluntariado.html`)
      .then(res => res.text())
      .then(html => setTermsContent(html))
      .catch(err => console.error('Error loading terms:', err));
  }, []);

  // Función para detectar si es un email
  const isEmail = (str: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  };

  // Función para limpiar y normalizar documentos (quitar puntos, guiones, espacios)
  const normalizeDocument = (doc: string): string => {
    return doc.replace(/[\s.-]/g, '');
  };

  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar que el campo no esté vacío
    if (!identifier.trim()) {
      return;
    }

    setLoading(true);

    // Normalizar el identificador (quitar puntos, guiones, espacios si no es email)
    const normalizedId = isEmail(identifier) ? identifier : normalizeDocument(identifier);

    try {
      const result = await onLogin(normalizedId, showPassword ? password : undefined);

      if (result === 'password_required') {
        setShowPassword(true);
      } else if (result === 'register') {
        // Para nuevos usuarios, mostrar el formulario de registro
        setIsRegistering(true);

        // Si es email, auto-completar el campo de email en el formulario
        if (isEmail(identifier)) {
          setFormData(prev => ({
            ...prev,
            dni: '', // Dejar DNI vacío si ingresó email
            email: identifier
          }));
        } else {
          // Si es documento, guardarlo en DNI
          setFormData(prev => ({
            ...prev,
            dni: normalizedId
          }));
        }
      }
      // If success, parent component handles redirection
    } catch (error) {
      console.error('Login error', error);
      toast.error('Ocurrió un error al intentar ingresar');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.isOver18) return;
    if (!formData.isMember) return;
    if (!agreed) return;
    onRegister({ ...formData, id: '', role: 'volunteer' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    // @ts-ignore
    const val = type === 'checkbox' ? e.target.checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const isFormValid = agreed && formData.isOver18 && formData.isMember;

  const inputClasses = "w-full px-3 py-2.5 bg-white border border-fs-border rounded-fs focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-fs-text placeholder-gray-400 transition-colors";
  const labelClasses = "block text-sm font-semibold text-gray-600 mb-1.5";

  if (isRegistering) {
    return (
      <div className="max-w-3xl mx-auto mt-8 bg-white p-8 rounded-lg shadow-card border border-fs-border">
        <div className="border-b border-fs-border pb-4 mb-6">
          <h2 className="text-2xl font-serif text-fs-text">Registro de Voluntario</h2>
          <p className="text-sm text-fs-meta mt-1">
            Completa tus datos{formData.dni && ` para el documento: `}
            {formData.dni && <span className="font-bold text-fs-text">{formData.dni}</span>}
            {formData.email && !formData.dni && ` usando el email: `}
            {formData.email && !formData.dni && <span className="font-bold text-fs-text">{formData.email}</span>}
          </p>
        </div>

        <form onSubmit={handleRegisterSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>Nombre Completo</label>
              <input type="text" name="fullName" placeholder="Ej: Juan Pérez" value={formData.fullName} onChange={handleInputChange} required
                className={inputClasses} />
            </div>

            {/* Mostrar campo DNI si ingresó con email */}
            {!formData.dni && (
              <div>
                <label className={labelClasses}>DNI / RUT / Cédula</label>
                <input type="text" name="dni" placeholder="Sin puntos ni guiones" value={formData.dni} onChange={handleInputChange} required
                  className={inputClasses} />
              </div>
            )}

            <div>
              <label className={labelClasses}>Correo Electrónico</label>
              <input type="email" name="email" placeholder="correo@ejemplo.com" value={formData.email} onChange={handleInputChange} required
                className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>Teléfono Móvil</label>
              <input type="tel" name="phone" placeholder="Ej: 11 5555 6666" value={formData.phone} onChange={handleInputChange} required
                className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>Talle de Remera</label>
              <div className="relative">
                <select name="tshirtSize" value={formData.tshirtSize} onChange={handleInputChange}
                  className={`${inputClasses} appearance-none`}>
                  <option value="S">S (Small)</option>
                  <option value="M">M (Medium)</option>
                  <option value="L">L (Large)</option>
                  <option value="XL">XL (Extra Large)</option>
                  <option value="XXL">XXL (Double XL)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className={labelClasses}>¿Cómo te enteraste de la actividad?</label>
              <div className="relative">
                <select name="howTheyHeard" value={formData.howTheyHeard} onChange={handleInputChange}
                  className={`${inputClasses} appearance-none`}>
                  <option>Redes Sociales</option>
                  <option>Amigos o Familiares</option>
                  <option>Página Web de la Iglesia</option>
                  <option>Anuncio en la Capilla</option>
                  <option>Otro</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-5 rounded-fs border border-fs-border">
            <h3 className="text-md font-bold text-fs-text mb-3">Información Adicional</h3>
            <div className="space-y-3">
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" name="isMember" checked={formData.isMember} onChange={handleInputChange}
                  className="h-5 w-5 text-primary-500 border-gray-300 rounded focus:ring-primary-500" />
                <span className="ml-3 text-sm text-gray-700">
                  Soy miembro de La Iglesia de Jesucristo de los Santos de los Últimos Días <span className="text-xs text-gray-500">(Requisito obligatorio)</span>
                </span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input type="checkbox" name="attendedPrevious" checked={formData.attendedPrevious} onChange={handleInputChange}
                  className="h-5 w-5 text-primary-500 border-gray-300 rounded focus:ring-primary-500" />
                <span className="ml-3 text-sm text-gray-700">Participé como voluntario en la feria anterior</span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="isOver18"
                  checked={formData.isOver18}
                  onChange={handleInputChange}
                  className="h-5 w-5 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="ml-3 text-sm text-gray-700">
                  Confirmo que soy mayor de 18 años <span className="text-xs text-gray-500">(Requisito obligatorio)</span>
                </span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center cursor-pointer">
              <input name="agreement" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                className="h-5 w-5 text-primary-500 border-gray-300 rounded focus:ring-primary-500" />
              <div className="ml-3 text-sm text-gray-600 leading-snug">
                He leído y acepto el <button type="button" onClick={(e) => { e.preventDefault(); setIsModalOpen(true); }} className="text-fs-blue hover:underline font-medium">Acuerdo de Voluntariado</button>. Entiendo que al inscribirme asumo un compromiso de asistencia y puntualidad.
              </div>
            </label>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className={`w-full btn-primary shadow-sm transition-all ${isFormValid
                ? 'opacity-100 hover:shadow-md'
                : 'opacity-50 cursor-not-allowed bg-gray-400 hover:bg-gray-400'
                }`}
              disabled={!isFormValid}
            >
              {!formData.isOver18 && !formData.isMember
                ? "Debes ser mayor de 18 años y miembro de la iglesia"
                : !formData.isOver18
                  ? "Debes ser mayor de 18 años para continuar"
                  : !formData.isMember
                    ? "Debes ser miembro de la iglesia para continuar"
                    : "Finalizar Registro"}
            </button>
          </div>
        </form>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Acuerdo de Voluntariado"
        >
          <div dangerouslySetInnerHTML={{ __html: termsContent }} />
        </Modal>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <div className="bg-white p-10 rounded-lg shadow-card border border-fs-border text-center">
        <div className="mb-8">
          <h2 className="text-3xl font-serif text-fs-text mb-3">Bienvenido</h2>
          <p className="text-fs-meta text-sm">Portal de Voluntarios de FamilySearch</p>
        </div>

        <form onSubmit={handleIdentifierSubmit} className="space-y-6">
          <div>
            <label className="sr-only">DNI o Email</label>
            <input
              ref={inputRef}
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="DNI, RUT, Cédula o Email"
              className="w-full px-4 py-3.5 bg-gray-50 border border-fs-border rounded-fs focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-xl text-center text-fs-text placeholder-gray-400"
              required
              disabled={loading}
            />
          </div>

          {showPassword && (
            <div className="animate-fade-in relative">
              <label className="sr-only">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-4 text-gray-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-fs-border rounded-fs focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-xl text-center text-fs-text placeholder-gray-400"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full btn-primary shadow-sm hover:shadow-md flex justify-center items-center"
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              showPassword ? 'INICIAR SESIÓN' : 'CONTINUAR'
            )}
          </button>

          {showPassword && (
            <button
              type="button"
              onClick={() => {
                setShowPassword(false);
                setPassword('');
              }}
              className="text-sm text-fs-blue hover:text-fs-blue-hover underline mt-4 block mx-auto"
              disabled={loading}
            >
              ← Volver
            </button>
          )}
        </form>

        <p className="mt-8 text-xs text-gray-400">
          Sirviendo Juntos 2026 &bull; Buenos Aires
        </p>
      </div>
    </div>
  );
};

export default Login;