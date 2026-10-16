import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Announcement } from '../types';
import { useAppTheme } from '../context/ThemeContext';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { parseTimestamp } from '../services/novelService';

interface AnnouncementModalProps {
  isOpen: boolean;
  announcements: Announcement[];
  initialIndex?: number;
  onClose: () => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  isOpen,
  announcements,
  initialIndex = 0,
  onClose,
}) => {
  const { theme } = useAppTheme();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const currentAnnouncement = announcements[currentIndex] || announcements[0];

  const formatDate = (raw: any) => {
    const ms = parseTimestamp(raw);
    if (!ms) return '';
    try {
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date(ms));
    } catch {
      return '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && currentAnnouncement && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none overflow-hidden"
          style={{ minHeight: '100vh', width: '100vw' }}
        >
          <motion.div
            id="announcement-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/65 backdrop-blur-xs cursor-pointer"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            id="announcement-modal-card"
            initial={{ scale: 0.9, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 8 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className={`relative z-10 border shadow-xl rounded-2xl pt-3.5 pb-3 px-4 sm:px-5 flex flex-col items-center justify-center overflow-y-auto max-h-[85vh] custom-scrollbar m-auto transition-colors duration-200 ${
              theme === 'dark'
                ? 'bg-[#1C1C1C] text-[#EDE8DF] border-[#333333] shadow-black/90'
                : theme === 'sepia'
                ? 'bg-[#F7F2E8] text-[#2E271F] border-[#DFD5C4] shadow-stone-900/25'
                : 'bg-[#FAF9F5] text-stone-900 border-stone-200/90 shadow-xl'
            }`}
            style={{ width: '90vw', maxWidth: '310px', height: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              id="btn-close-announcement-modal"
              onClick={onClose}
              aria-label="Tutup Pengumuman"
              className={`absolute top-2 right-2 p-1 rounded-full transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'text-stone-400 hover:text-white hover:bg-white/10'
                  : theme === 'sepia'
                  ? 'text-[#8C7B65] hover:text-[#2E271F] hover:bg-black/5'
                  : 'text-stone-400 hover:text-stone-800 hover:bg-stone-100'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {currentAnnouncement.createdAt && (
              <div
                className={`text-center mb-1.5 text-[11px] sm:text-xs font-serif italic tracking-wide transition-colors duration-200 ${
                  theme === 'dark'
                    ? 'text-amber-400/90'
                    : theme === 'sepia'
                    ? 'text-[#8C6D4F]'
                    : 'text-stone-500'
                }`}
              >
                {formatDate(currentAnnouncement.createdAt)}
              </div>
            )}

            {currentAnnouncement.title && (
              <h2
                className={`text-xs sm:text-sm font-serif font-bold text-center mb-1.5 break-words whitespace-normal px-1 transition-colors duration-200 ${
                  theme === 'dark'
                    ? 'text-[#F5F3EE]'
                    : theme === 'sepia'
                    ? 'text-[#2E271F]'
                    : 'text-stone-900'
                }`}
              >
                {currentAnnouncement.title}
              </h2>
            )}

            <div className="w-full text-center my-0.5">
              <p
                className={`text-[12.5px] sm:text-[13px] font-sans break-words whitespace-pre-line text-center leading-relaxed select-text transition-colors duration-200 ${
                  theme === 'dark'
                    ? 'text-[#DDD8CE]'
                    : theme === 'sepia'
                    ? 'text-[#382F24]'
                    : 'text-stone-800'
                }`}
              >
                {currentAnnouncement.content}
              </p>
            </div>

            {currentAnnouncement.author && (
              <div
                className={`mt-1 text-[10.5px] font-serif italic text-center transition-colors duration-200 ${
                  theme === 'dark'
                    ? 'text-[#8E887E]'
                    : theme === 'sepia'
                    ? 'text-[#8C7B65]'
                    : 'text-stone-400'
                }`}
              >
                Oleh: {currentAnnouncement.author}
              </div>
            )}

            {announcements.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-2 text-xs select-none">
                <button
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  aria-label="Pengumuman sebelumnya"
                  className={`p-1 rounded-full transition-colors cursor-pointer flex items-center justify-center ${
                    theme === 'dark'
                      ? 'text-amber-400 hover:bg-white/10 active:scale-95 disabled:text-stone-600'
                      : theme === 'sepia'
                      ? 'text-[#8C6D4F] hover:bg-black/5 active:scale-95 disabled:text-[#D5C6AF]'
                      : 'text-stone-600 hover:bg-stone-200 active:scale-95 disabled:text-stone-300'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono opacity-60">
                  {currentIndex + 1} / {announcements.length}
                </span>
                <button
                  disabled={currentIndex === announcements.length - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(announcements.length - 1, prev + 1))}
                  aria-label="Pengumuman berikutnya"
                  className={`p-1 rounded-full transition-colors cursor-pointer flex items-center justify-center ${
                    theme === 'dark'
                      ? 'text-amber-400 hover:bg-white/10 active:scale-95 disabled:text-stone-600'
                      : theme === 'sepia'
                      ? 'text-[#8C6D4F] hover:bg-black/5 active:scale-95 disabled:text-[#D5C6AF]'
                      : 'text-stone-600 hover:bg-stone-200 active:scale-95 disabled:text-stone-300'
                  }`}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
