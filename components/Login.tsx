
import React, { useState } from 'react';
import type { User } from '../types';

interface LoginProps {
  onLogin: (identifier: string) => void;
  onRegister: (newUser: User) => void;
  initialDni?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, onRegister, initialDni }) => {
  const [identifier, setIdentifier] = useState(initialDni || '');
  const [isRegistering, setIsRegistering] = useState(!!initialDni);
  const [formData, setFormData] = useState<Omit<User, 'id' | 'role'>>({
    dni: initialDni || '',
    fullName: '',
    email: '',
    phone: '',
    tshirtSize: 'M',
    isMember: false,
    attendedPrevious: false,
    isOver18: true,
    howTheyHeard: 'Redes Sociales',
  });
  const [agreed, setAgreed] = useState(false);

  const handleIdentifierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (identifier.trim() === 'admin@feria.com') { // Admin login
        onLogin(identifier);
    } else { // Volunteer DNI
        setIsRegistering(true);
        setFormData(prev => ({ ...prev, dni: identifier }));
        onLogin(identifier); // App.tsx will check if user exists
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
        alert("Debes aceptar las normas y responsabilidades.");
        return;
    }
    onRegister({ ...formData, id: '', role: 'volunteer' });
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    // @ts-ignore
    const val = isCheckbox ? e.target.checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  if (isRegistering) {
    return (
      <div className="max-w-2xl mx-auto mt-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100 mb-2">Formulario de Registro de Voluntario</h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-6">DNI: <span className="font-semibold">{formData.dni}</span></p>
        <form onSubmit={handleRegisterSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input type="text" name="fullName" placeholder="Nombre Completo" value={formData.fullName} onChange={handleInputChange} required className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleInputChange} required className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <input type="tel" name="phone" placeholder="Teléfono" value={formData.phone} onChange={handleInputChange} required className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <select name="tshirtSize" value={formData.tshirtSize} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="S">Talle S</option>
              <option value="M">Talle M</option>
              <option value="L">Talle L</option>
              <option value="XL">Talle XL</option>
              <option value="XXL">Talle XXL</option>
            </select>
            <select name="howTheyHeard" value={formData.howTheyHeard} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option>Redes Sociales</option>
              <option>Amigos</option>
              <option>Página Web</option>
              <option>Otro</option>
            </select>
          </div>
          <div className="space-y-4">
              <div className="flex items-center"><input type="checkbox" name="isMember" checked={formData.isMember} onChange={handleInputChange} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" /><label className="ml-2 block text-sm text-gray-900 dark:text-gray-300">¿Eres miembro?</label></div>
              <div className="flex items-center"><input type="checkbox" name="attendedPrevious" checked={formData.attendedPrevious} onChange={handleInputChange} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" /><label className="ml-2 block text-sm text-gray-900 dark:text-gray-300">¿Participaste en la feria anterior?</label></div>
              <div className="flex items-center"><input type="checkbox" name="isOver18" checked={formData.isOver18} onChange={handleInputChange} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" /><label className="ml-2 block text-sm text-gray-900 dark:text-gray-300">¿Eres mayor de 18 años?</label></div>
          </div>
           <div className="pt-4">
              <div className="flex items-start">
                  <input id="agreement" name="agreement" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 mt-1" />
                  <label htmlFor="agreement" className="ml-3 text-sm text-gray-700 dark:text-gray-300">Acepto el <a href="#" className="font-medium text-primary-600 hover:text-primary-500">disclaimer de normas y responsabilidades</a>. Entiendo que esto es un COMPROMISO.</label>
              </div>
          </div>
          <button type="submit" className="w-full py-3 px-4 bg-primary-600 text-white font-semibold rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-gray-400" disabled={!agreed}>Completar Registro</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 text-center">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Acceso de Voluntarios</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Ingresa tu DNI (sin puntos) para continuar.</p>
        <form onSubmit={handleIdentifierSubmit} className="space-y-4">
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="DNI o email (admin)"
            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
          />
          <button
            type="submit"
            className="w-full py-3 px-4 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition duration-300"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
