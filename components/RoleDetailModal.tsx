
import React from 'react';
import type { Role } from '../types';
import { X, Youtube } from 'lucide-react';

interface RoleDetailModalProps {
  role: Role;
  onClose: () => void;
}

const RoleDetailModal: React.FC<RoleDetailModalProps> = ({ role, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{role.name}</h2>
            <button onClick={onClose} className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
              <X size={24} />
            </button>
          </div>
          
          <div className="space-y-4 text-gray-700 dark:text-gray-300">
            <p><span className="font-semibold">Descripción:</span> {role.description}</p>
            <p><span className="font-semibold">Tareas Detalladas:</span> {role.detailedTasks}</p>
            <p><span className="font-semibold">Nivel de Experiencia Requerido:</span> <span className="capitalize px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm">{role.experienceLevel}</span></p>

            {role.youtubeUrl && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center"><Youtube size={18} className="mr-2 text-red-500"/> Video Explicativo</h4>
                <div className="aspect-w-16 aspect-h-9">
                  <iframe 
                    className="w-full h-full rounded-lg"
                    src={role.youtubeUrl} 
                    title="YouTube video player" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen>
                  </iframe>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleDetailModal;
