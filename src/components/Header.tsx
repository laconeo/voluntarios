import React from 'react';
import type { User } from '../types';
import { LogOut, User as UserIcon, TreePine, MessageCircle } from 'lucide-react';

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
                Voluntarios FamilySearch
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

              <div className="h-6 w-px bg-gray-200 hidden sm:block"></div> {/* Separator */}

              <a
                href="https://laconeo.github.io/centro-virtual/"
                target="_blank"
                rel="noopener noreferrer"
                title="Ayuda por un misionero de servicio"
                className="flex items-center space-x-1 font-semibold text-[#8CB83E] hover:text-[#7ba135] transition-colors"
                aria-label="Ayuda por un misionero de servicio"
              >
                <MessageCircle size={22} />
              </a>

              <div className="h-6 w-px bg-gray-200 hidden sm:block"></div> {/* Separator */}

              <button
                onClick={onLogout}
                className="flex items-center font-semibold text-fs-blue hover:text-blue-800 transition-colors focus:outline-none cursor-pointer"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut size={22} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;