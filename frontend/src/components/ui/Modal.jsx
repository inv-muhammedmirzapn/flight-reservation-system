import { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-[#1a1c1d]/40 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Content Card */}
      <div className="relative bg-white dark:bg-[#1a1c1d] rounded-2xl w-full max-w-lg p-6 shadow-2xl z-10 border border-black/5 dark:border-white/10 transform transition-all duration-300 scale-100 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center pb-4 border-b border-black/5 dark:border-white/5 mb-4">
          <h2 className="text-xl font-bold tracking-tight text-on-surface">
            {title}
          </h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg text-on-surface-variant hover:bg-black/5 dark:hover:bg-white/5 transition-colors active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="overflow-y-auto pr-1 flex-grow">
          {children}
        </div>
      </div>
    </div>
  );
}
