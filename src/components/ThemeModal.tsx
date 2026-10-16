import React from 'react';
import { Sun, BookOpen, Moon } from 'lucide-react';
import { useAppTheme, AppTheme } from '../context/ThemeContext';

export const ThemeModal: React.FC = () => {
  const { theme, setTheme, isThemeModalOpen, closeThemeModal } = useAppTheme();

  if (!isThemeModalOpen) return null;

  return (
    <div
      id="theme-modal-backdrop"
      onClick={closeThemeModal}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
    >
      {/* Wadah Persegi Panjang Tegas (Bukan Bulat Tepinya: rounded-none) */}
      <div
        id="theme-modal-card"
        onClick={(e) => e.stopPropagation()}
        className={`flex items-center justify-center gap-2 p-2 rounded-none border shadow-2xl transition-all duration-150 animate-in zoom-in-95 ${
          theme === 'dark'
            ? 'bg-[#1C1C1C] border-stone-700 shadow-black/80'
            : theme === 'sepia'
            ? 'bg-[#EFE7D8] border-[#D5C6AF] shadow-stone-900/15'
            : 'bg-[#F9F8F5] border-stone-300 shadow-stone-900/15'
        }`}
      >
        {/* Tiga Pilihan Bertipe Ikon Murni (Bukan Contoh Warna) */}
        {[
          {
            id: 'light' as AppTheme,
            icon: Sun,
            label: 'Terang',
            activeStyle:
              theme === 'dark'
                ? 'bg-stone-800 text-amber-400 border-amber-400/60 ring-1 ring-amber-400/60'
                : 'bg-white text-amber-600 border-amber-500 ring-1 ring-amber-500/50 shadow-xs',
            inactiveStyle:
              theme === 'dark'
                ? 'text-stone-400 border-stone-800 hover:text-stone-200 hover:bg-stone-800/60'
                : 'text-stone-500 border-transparent hover:text-stone-800 hover:bg-black/5'
          },
          {
            id: 'sepia' as AppTheme,
            icon: BookOpen,
            label: 'Sepia',
            activeStyle:
              theme === 'dark'
                ? 'bg-stone-800 text-[#D4B996] border-[#D4B996]/60 ring-1 ring-[#D4B996]/60'
                : 'bg-[#FAF4E8] text-[#6B5138] border-[#8C6D4F] ring-1 ring-[#8C6D4F]/50 shadow-xs',
            inactiveStyle:
              theme === 'dark'
                ? 'text-stone-400 border-stone-800 hover:text-[#D4B996] hover:bg-stone-800/60'
                : 'text-stone-500 border-transparent hover:text-[#6B5138] hover:bg-black/5'
          },
          {
            id: 'dark' as AppTheme,
            icon: Moon,
            label: 'Gelap',
            activeStyle:
              theme === 'dark'
                ? 'bg-stone-800 text-amber-300 border-amber-400/70 ring-1 ring-amber-400/60 shadow-xs'
                : 'bg-stone-900 text-amber-300 border-stone-900 ring-1 ring-stone-900/40 shadow-xs',
            inactiveStyle:
              theme === 'dark'
                ? 'text-stone-500 border-stone-800 hover:text-stone-200 hover:bg-stone-800/60'
                : 'text-stone-500 border-transparent hover:text-stone-900 hover:bg-black/5'
          }
        ].map((opt) => {
          const isSelected = theme === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              id={`btn-theme-${opt.id}`}
              onClick={() => setTheme(opt.id)}
              title={opt.label}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-none border flex items-center justify-center transition-all duration-150 cursor-pointer outline-none active:scale-95 ${
                isSelected ? opt.activeStyle : opt.inactiveStyle
              }`}
            >
              <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.2]" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

