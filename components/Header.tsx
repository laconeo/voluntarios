
import React from 'react';
import type { User } from '../types';
import { LogOut, User as UserIcon } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">
              Sistema de Voluntarios
            </h1>
            <span className="ml-4 text-sm text-gray-500 dark:text-gray-400 hidden sm:block">Feria del Libro 2026</span>
          </div>
          {user && onLogout && (
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                <UserIcon size={18} />
                <span className="font-medium">{user.fullName}</span>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                aria-label="Cerrar sesión"
              >
                <LogOut size={16} className="mr-2" />
                Salir
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
