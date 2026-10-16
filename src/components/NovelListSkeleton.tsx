import React from 'react';
import { useAppTheme } from '../context/ThemeContext';
import { BookOpen, Library } from 'lucide-react';

export const NovelListSkeleton: React.FC = () => {
  const { theme } = useAppTheme();

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 pt-3 pb-6 sm:pt-4 sm:pb-8 animate-in fade-in duration-150">
      {/* 1. DUAL TAB SWITCHER SKELETON (Presisi 100% sama dengan NovelList) */}
      <div className="flex justify-center mb-3.5 sm:mb-4">
        <div className="relative p-1 bg-stone-200/70 dark:bg-stone-800/70 sepia:bg-[#EAE4D7] rounded-xl w-full max-w-[220px] select-none shadow-2xs">
          <div className="relative flex items-center">
            {/* Active Tab Placeholder */}
            <div className="flex-1 py-1.5 px-2 rounded-lg bg-white dark:bg-[#2A2A2A] sepia:bg-[#FDFBF7] shadow-xs flex items-center justify-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#414E2E]/60 dark:text-[#889B68]/60 sepia:text-[#414E2E]/60 animate-pulse" />
              <div className="h-3 w-10 rounded bg-stone-300/80 dark:bg-stone-600/80 sepia:bg-[#DFD5C4] animate-pulse" />
            </div>

            {/* Inactive Tab Placeholder */}
            <div className="flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 opacity-60">
              <Library className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 sepia:text-stone-600" />
              <div className="h-3 w-8 rounded bg-stone-300/60 dark:bg-stone-700/60 sepia:bg-[#DFD5C4]/70" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. GRID 3 KOLOM RAK BUKU SKELETON (Sama persis dengan bentuk kartu buku asli) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div
            key={item}
            className="group relative select-none py-1 pl-0.5 pr-2.5 sm:pr-3"
          >
            {/* Efek Samping Kertas Bookpaper Khas Novel */}
            <div 
              className="absolute top-2 bottom-1.5 right-1 sm:right-1.5 w-2.5 sm:w-3 rounded-r-xs border-r border-y border-[#D6C8AE]/70 dark:border-[#524B3C]/70 shadow-[1px_2px_4px_rgba(0,0,0,0.12)] flex flex-col justify-between py-1.5 overflow-hidden pointer-events-none z-0"
              style={{ backgroundColor: theme === 'dark' ? '#3B362C' : '#EDE3CD' }}
            >
              <div className="w-full h-px bg-[#D9CBAC]/60 dark:bg-[#5C5443]/60" />
              <div className="w-full h-px bg-[#CFBE9D]/60 dark:bg-[#4E4738]/60" />
              <div className="w-full h-px bg-[#D9CBAC]/60 dark:bg-[#5C5443]/60" />
            </div>

            {/* Tepi Kertas Bookpaper Bawah */}
            <div 
              className="absolute bottom-1 left-2 right-2.5 sm:right-3 h-1.5 rounded-b-xs border-b border-x border-[#D6C8AE]/70 dark:border-[#524B3C]/70 pointer-events-none z-0"
              style={{ backgroundColor: theme === 'dark' ? '#3B362C' : '#EDE3CD' }}
            />

            {/* Bayangan Dasar Buku */}
            <div className="absolute -inset-x-0.5 bottom-0 h-4 bg-black/20 blur-[5px] -z-10 transform translate-x-1 translate-y-1 rounded-xl pointer-events-none" />

            {/* Sampul Buku Skeleton dengan Efek Kilau Shimmer */}
            <div
              className={`relative aspect-[3/4.4] rounded-xl sm:rounded-2xl overflow-hidden border-2 shadow-[0_2px_8px_rgba(0,0,0,0.1)] flex flex-col justify-between p-2 sm:p-2.5 z-10 transition-colors ${
                theme === 'dark'
                  ? 'bg-[#222222] border-[#333333]'
                  : theme === 'sepia'
                  ? 'bg-[#F2ECE0] border-[#DDD3C1]'
                  : 'bg-[#F0EEE6] border-stone-300/70'
              }`}
            >
              {/* Spine Crease / Lipatan Punggung Buku Kiri */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-2 sm:w-2.5 bg-gradient-to-r from-black/20 via-white/5 to-transparent z-20" />

              {/* Tag Genre Kecil di Atas */}
              <div className="flex items-center z-10">
                <div className="h-3.5 sm:h-4 w-11 sm:w-14 rounded bg-stone-300/80 dark:bg-stone-700/80 sepia:bg-[#D9CEBC] animate-pulse" />
              </div>

              {/* Garis Judul Buku di Tengah */}
              <div className="my-auto px-0.5 space-y-1.5 w-full z-10">
                <div className="h-3 sm:h-3.5 w-4/5 mx-auto rounded bg-stone-400/70 dark:bg-stone-600/70 sepia:bg-[#C8BCAB] animate-pulse" />
                <div className="h-3 sm:h-3.5 w-3/5 mx-auto rounded bg-stone-300/70 dark:bg-stone-700/60 sepia:bg-[#D4C8B7] animate-pulse" />
              </div>

              {/* Garis Nama Penulis di Bawah */}
              <div className="pt-1.5 border-t border-stone-300/60 dark:border-stone-700/50 sepia:border-[#D9CEBC] flex justify-center z-10">
                <div className="h-2.5 sm:h-3 w-12 sm:w-16 rounded bg-stone-300/70 dark:bg-stone-700/60 sepia:bg-[#D4C8B7] animate-pulse" />
              </div>

              {/* Shimmer Ambient Gradient */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/15 dark:via-white/5 to-transparent animate-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
