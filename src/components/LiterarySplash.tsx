import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Feather, BookOpen } from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import defaultLogo from '../assets/images/logo.png';

interface LiterarySplashProps {
  isOpen: boolean;
  onFinish: () => void;
  duration?: number; // Durasi dalam milidetik (default 2800ms)
  logoSrc?: string;  // Path atau URL logo kustom
  appName?: string;
  tagline?: string;
}

export const LiterarySplash: React.FC<LiterarySplashProps> = ({
  isOpen,
  onFinish,
  duration = 2800,
  logoSrc = defaultLogo,
  appName = 'Pena Indonesia',
  tagline = 'Membuka lembaran cerita...',
}) => {
  const { theme } = useAppTheme();
  const [progress, setProgress] = useState(0);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      return;
    }

    // Jalankan progres garis pena
    const intervalTime = 40;
    const steps = duration / intervalTime;
    const increment = 100 / steps;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return Math.min(100, prev + increment);
      });
    }, intervalTime);

    // Otomatis tutup setelah durasi selesai
    const autoClose = setTimeout(() => {
      onFinish();
    }, duration);

    return () => {
      clearInterval(timer);
      clearTimeout(autoClose);
    };
  }, [isOpen, duration, onFinish]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="literary-splash-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={`fixed inset-0 z-9999 flex flex-col items-center justify-center select-none px-6 transition-colors duration-200 ${
            theme === 'dark'
              ? 'bg-[#121212] text-[#EDE8DF]'
              : theme === 'sepia'
              ? 'bg-[#F7F2E8] text-[#2E271F]'
              : 'bg-[#FAF9F5] text-stone-900'
          }`}
        >
          {/* Elemen Tengah: Logo, Judul & Animasi Denyut */}
          <div className="flex flex-col items-center text-center max-w-xs">
            {/* Emblem Bulat dengan Logo Kustom atau Ikon Sastra */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: [0.85, 1.02, 1], opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="relative mb-5"
            >
              {/* Ring Cahaya Halus di belakang logo */}
              <motion.div
                animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className={`absolute -inset-1 rounded-3xl blur-md pointer-events-none ${
                  theme === 'dark'
                    ? 'bg-amber-400/25'
                    : theme === 'sepia'
                    ? 'bg-[#8C6D4F]/25'
                    : 'bg-[#50553C]/20'
                }`}
              />

              {/* Bingkai Tipis dan Pas dengan Logo */}
              <div
                className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl flex items-center justify-center shadow-lg border overflow-hidden transition-all ${
                  !imageError
                    ? 'border-stone-200/90 dark:border-stone-700/80 bg-white'
                    : theme === 'dark'
                    ? 'bg-[#1E1E1E] border-[#2F2F2F] text-amber-400 p-3'
                    : theme === 'sepia'
                    ? 'bg-[#EDE5D5] border-[#DFD5C4] text-[#705335] p-3'
                    : 'bg-[#50553C] border-[#434832] text-[#FAF9F5] p-3'
                }`}
              >
                {!imageError ? (
                  <motion.img
                    src={logoSrc}
                    alt={appName}
                    referrerPolicy="no-referrer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover block"
                  />
                ) : (
                  <div className="relative flex items-center justify-center">
                    <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 opacity-90" />
                    <motion.div
                      animate={{ rotate: [-6, 6, -6] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute -top-1.5 -right-1.5"
                    >
                      <Feather className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-sm" />
                    </motion.div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Nama Aplikasi dengan Font Serif Elegan */}
            <motion.h1
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.18, duration: 0.5 }}
              className="font-serif text-2xl sm:text-3xl font-bold tracking-[0.14em] uppercase mb-2"
            >
              {appName}
            </motion.h1>

            {/* Tagline Klasik */}
            <motion.p
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 0.8 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-xs sm:text-sm italic font-serif opacity-75 mb-6"
            >
              {tagline}
            </motion.p>

            {/* Garis Progres Pena Tipis & Elegan */}
            <div
              className={`w-44 sm:w-52 h-1 rounded-full overflow-hidden ${
                theme === 'dark'
                  ? 'bg-stone-800'
                  : theme === 'sepia'
                  ? 'bg-[#E3D8C4]'
                  : 'bg-stone-200'
              }`}
            >
              <motion.div
                className={`h-full rounded-full transition-all ease-out duration-75 ${
                  theme === 'dark'
                    ? 'bg-amber-400'
                    : theme === 'sepia'
                    ? 'bg-[#8C6D4F]'
                    : 'bg-[#50553C]'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

