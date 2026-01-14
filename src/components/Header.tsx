import React from 'react';
import type { User } from '../types';
import { LogOut, User as UserIcon, TreePine } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onLogout?: () => void;
  onProfileClick?: () => void;
  onLogoClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onProfileClick, onLogoClick }) => {
  return (
    <header className="bg-white border-b border-fs-border sticky top-0 z-50 h-14 sm:h-[60px] flex items-center shadow-sm">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={onLogoClick}>
            <div className="flex flex-col">
              <h1 className="text-[20px] text-[#8CB83E] font-serif tracking-tight font-bold leading-tight">
                Sistema de Gestión de Voluntarios (SGV)
              </h1>
              <span className="text-sm text-gray-500 font-sans">
                Centro Virtual
              </span>
            </div>
          </div>

          {user && onLogout && (
            <div className="flex items-center space-x-6">
              <button onClick={onProfileClick} className="hidden sm:flex items-center space-x-2 hover:bg-gray-50 p-1 rounded-fs transition-colors">
                <div className="bg-gray-100 p-1.5 rounded-full text-gray-500">
                  <UserIcon size={16} />
                </div>
                <span className="font-normal font-sans text-sm text-fs-text">{user.fullName}</span>
              </button>
              <button
                onClick={onLogout}
                className="flex items-center text-sm font-semibold text-fs-blue hover:text-blue-800 hover:underline transition-colors focus:outline-none"
                aria-label="Cerrar sesión"
              >
                <LogOut size={16} className="mr-1" />
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