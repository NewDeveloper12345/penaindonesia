import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Announcement } from '../types';
import { Megaphone, Bell, ChevronRight } from 'lucide-react';
import { parseTimestamp } from '../services/novelService';
import { useAppTheme } from '../context/ThemeContext';

interface HomeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: Announcement[];
  onOpenAnnouncementModal: (index?: number) => void;
}

export const HomeDrawer: React.FC<HomeDrawerProps> = ({
  isOpen,
  onClose,
  announcements,
  onOpenAnnouncementModal,
}) => {
  const { theme } = useAppTheme();

  const formatAnnouncementDate = (raw: any, fallbackTitle?: string) => {
    const ms = parseTimestamp(raw);
    if (!ms) return fallbackTitle || 'Pengumuman';
    try {
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
      }).format(new Date(ms));
    } catch {
      return fallbackTitle || 'Pengumuman';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
          {/* Backdrop Overlay (Menutup saat diklik dengan animasi bounce pada drawer) */}
          <motion.div
            id="home-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-2xs cursor-pointer"
          />

          {/* Side Drawer (Tinggi 70vh, posisi vertikal terpusat top 15vh, floating rounded kanan, animasi bounce saat ditutup) */}
          <motion.div
            id="home-side-drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{
              x: ['0%', '8%', '-110%'],
              transition: {
                duration: 0.38,
                times: [0, 0.22, 1],
                ease: ['easeOut', 'easeInOut'],
              },
            }}
            transition={{
              type: 'spring',
              damping: 26,
              stiffness: 280,
            }}
            className={`fixed left-0 top-[15vh] h-[70vh] border-y border-r shadow-2xl rounded-r-2xl flex flex-col z-50 overflow-hidden transition-colors duration-200 ${
              theme === 'dark'
                ? 'bg-[#181818] border-[#2E2E2E] text-[#EDE8DF] shadow-black/85'
                : theme === 'sepia'
                ? 'bg-[#F7F2E8] border-[#DFD5C4] text-[#2E271F] shadow-stone-900/20'
                : 'bg-[#FAF9F5] border-[#E8E7E0] text-stone-900 shadow-2xl'
            }`}
            style={{ width: '35vw', maxWidth: '35vw', minWidth: '280px' }}
          >
            {/* Area dalam laci dengan scrolling independen */}
            <div className="flex-1 w-full h-full p-4 overflow-y-auto custom-scrollbar relative z-10 flex flex-col space-y-3.5">
              {/* Menu Section Title: Pengumuman di Tengah */}
              <div className="flex items-center justify-center pb-2 transition-colors duration-200">
                <span className={`text-[11px] sm:text-[12px] font-bold uppercase tracking-wider font-mono flex items-center justify-center gap-1.5 transition-colors duration-200 ${
                  theme === 'dark'
                    ? 'text-[#C5BFB0]'
                    : theme === 'sepia'
                    ? 'text-[#6B5138]'
                    : 'text-stone-500'
                }`}>
                  <Bell className={`w-3.5 h-3.5 ${
                    theme === 'dark' ? 'text-amber-400' : theme === 'sepia' ? 'text-[#8C6D4F]' : 'text-[#50553C]'
                  }`} />
                  Pengumuman
                </span>
              </div>

              {/* Announcements Section */}
              {announcements.length > 0 ? (
                <div className="space-y-2">
                  {announcements.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        onOpenAnnouncementModal(idx);
                      }}
                      className={`group px-3.5 py-2.5 rounded-xl border transition-all cursor-pointer select-none active:scale-[0.98] ${
                        theme === 'dark'
                          ? 'bg-[#212121] border-[#333333] hover:border-amber-400/50 hover:bg-[#262626] hover:shadow-xs'
                          : theme === 'sepia'
                          ? 'bg-[#EFE7D8] border-[#DFD5C4] hover:border-[#8C6D4F]/60 hover:shadow-xs'
                          : 'bg-white border-stone-200/80 hover:border-[#50553C]/50 hover:shadow-xs'
                      }`}
                    >
                      {/* Isi Teks Pengumuman Langsung (Hemat Ruang & Rapi) */}
                      <p className={`text-[11.5px] sm:text-xs line-clamp-2 leading-relaxed text-center transition-colors ${
                        theme === 'dark'
                          ? 'text-[#CCC7BC] group-hover:text-amber-200'
                          : theme === 'sepia'
                          ? 'text-[#4A3F33] group-hover:text-[#2E271F]'
                          : 'text-stone-600 group-hover:text-stone-900'
                      }`}>
                        {item.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`py-8 px-3 text-center rounded-xl border border-dashed flex flex-col items-center justify-center transition-colors ${
                  theme === 'dark'
                    ? 'bg-[#1F1F1F] border-[#303030]'
                    : theme === 'sepia'
                    ? 'bg-[#EDE5D5]/60 border-[#DFD5C4]'
                    : 'bg-stone-100/50 border-stone-200'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                    theme === 'dark'
                      ? 'bg-[#2A2A2A] text-amber-400/80'
                      : theme === 'sepia'
                      ? 'bg-[#DFD5C4]/60 text-[#8C6D4F]'
                      : 'bg-stone-200/60 text-stone-400'
                  }`}>
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <p className={`text-xs font-serif font-medium ${
                    theme === 'dark' ? 'text-[#E8E4DC]' : theme === 'sepia' ? 'text-[#2E271F]' : 'text-stone-600'
                  }`}>
                    Belum Ada Pengumuman
                  </p>
                  <p className={`text-[10.5px] mt-1 max-w-[200px] ${
                    theme === 'dark' ? 'text-[#888888]' : theme === 'sepia' ? 'text-[#8C7B65]' : 'text-stone-400'
                  }`}>
                    Pengumuman terbaru dari penulis atau redaksi akan tampil di sini.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Profil Developer */}
            <div className={`p-3.5 border-t shrink-0 transition-colors ${
              theme === 'dark'
                ? 'border-[#2D2D2D] bg-[#161616]'
                : theme === 'sepia'
                ? 'border-[#DFD5C4] bg-[#EFE6D6]'
                : 'border-stone-200 bg-[#F4F1EA]'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-serif font-semibold ${
                  theme === 'dark' ? 'text-stone-300' : theme === 'sepia' ? 'text-[#3E3224]' : 'text-stone-700'
                }`}>
                  Kreator & Pengembang
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-600 dark:text-amber-300 font-mono font-medium">
                  @iimnnwkyy
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="https://www.tiktok.com/@iimnnwkyy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-black hover:bg-stone-900 text-white text-[11px] font-medium shadow-xs transition-transform active:scale-95"
                  title="TikTok @iimnnwkyy"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.3 6.3 0 0 0 1.88-4.49V8.58a8.28 8.28 0 0 0 4.84 1.56V6.69h-.95z"/>
                  </svg>
                  <span>TikTok</span>
                </a>
                <a
                  href="https://www.instagram.com/iimnnwkyy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-95 text-white text-[11px] font-medium shadow-xs transition-transform active:scale-95"
                  title="Instagram @iimnnwkyy"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                  </svg>
                  <span>Instagram</span>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
