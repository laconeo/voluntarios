import React, { useState } from 'react';
import type { User } from '../types';
import { Lock } from 'lucide-react';

interface LoginProps {
  onLogin: (identifier: string, password?: string) => void;
  onRegister: (newUser: User) => void;
  initialDni?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, onRegister, initialDni }) => {
  const [identifier, setIdentifier] = useState(initialDni || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(!!initialDni);
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

  // Detectar si el identificador requiere contraseña (admin, superadmin o coordinator)
  const requiresPassword = (id: string) => {
    return id === '99999999' || id === '11111111' || id === '44444444' ||
      id.includes('admin') || id.includes('superadmin') || id.includes('coord');
  };

  const handleIdentifierSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Si requiere contraseña, mostrar campo de contraseña
    if (requiresPassword(identifier) && !showPassword) {
      setShowPassword(true);
      return;
    }

    // Si ya mostró contraseña o no la requiere, proceder con login
    if (identifier.trim() === 'admin@feria.com' || requiresPassword(identifier)) {
      onLogin(identifier, password);
    } else {
      // Para nuevos usuarios, solo mostrar el formulario de registro
      // NO llamar a onLogin hasta que completen el registro
      setIsRegistering(true);
      setFormData(prev => ({ ...prev, dni: identifier }));
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.isOver18) return;
    if (!agreed) return;
    onRegister({ ...formData, id: '', role: 'volunteer' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    // @ts-ignore
    const val = isCheckbox ? e.target.checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const isFormValid = agreed && formData.isOver18;

  const inputClasses = "w-full px-3 py-2.5 bg-white border border-fs-border rounded-fs focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-fs-text placeholder-gray-400 transition-colors";
  const labelClasses = "block text-sm font-semibold text-gray-600 mb-1.5";

  if (isRegistering) {
    return (
      <div className="max-w-3xl mx-auto mt-8 bg-white p-8 rounded-lg shadow-card border border-fs-border">
        <div className="border-b border-fs-border pb-4 mb-6">
          <h2 className="text-2xl font-serif text-fs-text">Registro de Voluntario</h2>
          <p className="text-sm text-fs-meta mt-1">Completa tus datos para el DNI: <span className="font-bold text-fs-text">{formData.dni}</span></p>
        </div>

        <form onSubmit={handleRegisterSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClasses}>Nombre Completo</label>
              <input type="text" name="fullName" placeholder="Ej: Juan Pérez" value={formData.fullName} onChange={handleInputChange} required
                className={inputClasses} />
            </div>
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
                <span className="ml-3 text-sm text-gray-700">Soy miembro de La Iglesia de Jesucristo de los Santos de los Últimos Días</span>
              </label>

              <label className="flex items-center cursor-pointer">
                <input type="checkbox" name="attendedPrevious" checked={formData.attendedPrevious} onChange={handleInputChange}
                  className="h-5 w-5 text-primary-500 border-gray-300 rounded focus:ring-primary-500" />
                <span className="ml-3 text-sm text-gray-700">Participé como voluntario en la feria anterior</span>
              </label>

              <label className={`flex items-center p-2 rounded transition-colors cursor-pointer border ${!formData.isOver18 ? 'bg-white border-red-200' : 'border-transparent'}`}>
                <input
                  type="checkbox"
                  name="isOver18"
                  checked={formData.isOver18}
                  onChange={handleInputChange}
                  className="h-5 w-5 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className={`ml-3 text-sm font-medium ${!formData.isOver18 ? 'text-red-600' : 'text-gray-800'}`}>
                  Confirmo que soy mayor de 18 años <span className="text-xs font-normal text-gray-500 ml-1">(Requisito obligatorio)</span>
                </span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-start cursor-pointer">
              <input name="agreement" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                className="h-5 w-5 text-primary-500 border-gray-300 rounded focus:ring-primary-500 mt-0.5" />
              <div className="ml-3 text-sm text-gray-600 leading-snug">
                He leído y acepto el <a href="#" className="text-fs-blue hover:underline font-medium">Acuerdo de Voluntariado</a>. Entiendo que al inscribirme asumo un compromiso de asistencia y puntualidad.
              </div>
            </label>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className={`w-full py-3 px-6 font-bold text-base rounded-fs shadow-sm transition-all ${isFormValid
                ? 'bg-primary-500 text-white hover:bg-primary-600 hover:shadow-md'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              disabled={!isFormValid}
            >
              {formData.isOver18 ? "Finalizar Registro" : "Debes ser mayor de 18 años para continuar"}
            </button>
          </div>
        </form>
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
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Ingresa tu DNI"
              className="w-full px-4 py-3.5 bg-gray-50 border border-fs-border rounded-fs focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-xl text-center text-fs-text placeholder-gray-400"
            />
          </div>

          {showPassword && (
            <div className="animate-fade-in">
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
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Contraseña de administrador (admin123) o coordinador (coord123)
              </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-primary-500 text-white text-base font-bold rounded-fs hover:bg-primary-600 transition duration-200 shadow-sm hover:shadow-md"
          >
            {showPassword ? 'Iniciar Sesión' : 'Continuar'}
          </button>

          {showPassword && (
            <button
              type="button"
              onClick={() => {
                setShowPassword(false);
                setPassword('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
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