import React, { useState } from 'react';
import { Feather, Menu, ArrowLeft, Sun, Moon, RotateCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppTheme } from '../context/ThemeContext';
import { Announcement } from '../types';
import defaultLogo from '../assets/images/logo.png';

interface HeaderProps {
  currentView: 'home' | 'series_detail' | 'detail' | 'reader' | 'characters';
  novelTitle?: string;
  hasActiveAnnouncements?: boolean;
  announcements?: Announcement[];
  isSplashActive?: boolean;
  onBackToHome?: () => void;
  onBackToDetail?: () => void;
  onOpenDrawer?: () => void;
  onOpenHomeDrawer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  novelTitle,
  hasActiveAnnouncements = false,
  announcements = [],
  isSplashActive = false,
  onBackToHome,
  onBackToDetail,
  onOpenDrawer,
  onOpenHomeDrawer,
}) => {
  const { theme, openThemeModal } = useAppTheme();
  const [logoError, setLogoError] = React.useState(false);
  const [isAutoDismissed, setIsAutoDismissed] = React.useState(false);
  const [isHeaderRefreshing, setIsHeaderRefreshing] = React.useState(false);

  const handleGlobalRefresh = () => {
    setIsHeaderRefreshing(true);
    window.dispatchEvent(new CustomEvent('pena_soft_refresh'));
    setTimeout(() => {
      setIsHeaderRefreshing(false);
    }, 850);
  };

  // Balon petunjuk tampil di halaman utama selama pengumuman masih berjalan / aktif,
  // dan akan muncul selama 3 detik sebelum nyelip lucu ke arah kiri
  const hasAnnouncements = hasActiveAnnouncements || (announcements && announcements.length > 0);
  const showCuteNotification = currentView === 'home' && hasAnnouncements && !isAutoDismissed;

  React.useEffect(() => {
    // Mulai hitung 3 detik setelah layar splash pembuka selesai tampil
    if (hasAnnouncements && !isSplashActive && !isAutoDismissed) {
      const timer = setTimeout(() => {
        setIsAutoDismissed(true);
      }, 3000); // 3 detik tampil di layar awal

      return () => clearTimeout(timer);
    }
  }, [hasAnnouncements, isSplashActive, isAutoDismissed]);

  // Penyesuaian tema (Terang, Sepia, Gelap) secara presisi
  const bubbleThemeStyle = React.useMemo(() => {
    if (theme === 'dark') {
      return {
        card: 'bg-[#1E1E1E] border-amber-500/70 text-[#EDE8DF] shadow-2xl shadow-black/70',
        arrow: 'bg-[#1E1E1E] border-amber-500/70',
        iconBox: 'bg-amber-950/80 border border-amber-600/50 text-amber-300',
        title: 'text-amber-300',
        sub: 'text-stone-300'
      };
    }
    if (theme === 'sepia') {
      return {
        card: 'bg-[#F4EDE0] border-[#D6C4A5] text-[#2E271F] shadow-lg shadow-stone-800/10',
        arrow: 'bg-[#F4EDE0] border-[#D6C4A5]',
        iconBox: 'bg-[#EADECC] border border-[#D6C4A5]/70 text-[#7A5826]',
        title: 'text-[#3B2C1C]',
        sub: 'text-[#6B5A47]'
      };
    }
    // Terang / Light (Default)
    return {
      card: 'bg-white border-amber-400 text-stone-900 shadow-xl shadow-amber-950/10',
      arrow: 'bg-white border-amber-400',
      iconBox: 'bg-amber-50 border border-amber-200 text-amber-700',
      title: 'text-amber-950',
      sub: 'text-stone-600'
    };
  }, [theme]);

  const handleOpenBrandOrNotification = () => {
    if (onOpenHomeDrawer) {
      onOpenHomeDrawer();
    } else if (onBackToHome) {
      onBackToHome();
    }
  };

  return (
    <header className={`h-14 sm:h-16 sticky top-0 z-30 shrink-0 shadow-2xs transition-colors duration-150 border-b ${
      theme === 'dark'
        ? 'bg-[#181818] border-[#2A2A2A] text-[#EDE8DF]'
        : theme === 'sepia'
        ? 'bg-[#F4EDE0] border-[#DFD3B8] text-[#2E2114]'
        : 'bg-[#FAF9F5] border-[#E8E7E0] text-stone-900'
    }`}>
      <div className="max-w-4xl mx-auto h-full px-3 sm:px-6 flex items-center justify-between">
        {/* Left: Hamburger menu (for reader), Brand / Back button, & Novel Title */}
        <div className="flex items-center space-x-2 sm:space-x-2.5 flex-1 min-w-0">
          {/* If in reader view, show Hamburger Menu Button (Garis Tiga) */}
          {currentView === 'reader' && onOpenDrawer && (
            <button
              id="btn-header-menu"
              onClick={onOpenDrawer}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors cursor-pointer outline-none active:scale-95 ${
                theme === 'dark'
                  ? 'hover:bg-stone-800 text-stone-200'
                  : theme === 'sepia'
                  ? 'hover:bg-[#EFE6D4] text-[#2E2114]'
                  : 'hover:bg-stone-200/70 text-stone-800'
              }`}
              title="Buka Daftar Bab"
            >
              <Menu className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
            </button>
          )}

          {/* Back button / Home Icon */}
          {currentView === 'reader' || currentView === 'characters' ? (
            <button
              id="btn-back-to-detail"
              onClick={onBackToDetail || onBackToHome}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-colors cursor-pointer outline-none active:scale-95 ${
                theme === 'dark'
                  ? 'bg-[#3E4D2B] hover:bg-[#4A5D32] text-white'
                  : theme === 'sepia'
                  ? 'bg-[#6E502B] hover:bg-[#5D4323] text-white'
                  : 'bg-[#50553C] hover:bg-[#434832] text-white'
              }`}
              title="Kembali ke Detail Novel"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          ) : currentView === 'detail' || currentView === 'series_detail' ? (
            <button
              id="btn-back-to-home"
              onClick={onBackToHome}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-colors cursor-pointer outline-none active:scale-95 ${
                theme === 'dark'
                  ? 'bg-[#3E4D2B] hover:bg-[#4A5D32] text-white'
                  : theme === 'sepia'
                  ? 'bg-[#6E502B] hover:bg-[#5D4323] text-white'
                  : 'bg-[#50553C] hover:bg-[#434832] text-white'
              }`}
              title="Kembali ke Beranda"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          ) : (
            <div className="relative shrink-0">
              <button
                id="btn-header-brand"
                onClick={handleOpenBrandOrNotification}
                className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden border shadow-xs flex items-center justify-center shrink-0 transition-all cursor-pointer outline-none active:scale-95 ${
                  !logoError
                    ? 'border-stone-200/90 dark:border-stone-700/80 bg-white'
                    : 'bg-[#50553C] hover:bg-[#434832] text-white border-transparent'
                }`}
                title="Buka Menu Laci Samping"
              >
                {!logoError ? (
                  <img
                    src={defaultLogo}
                    alt="Pena Indonesia"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                    className="w-full h-full object-cover block"
                  />
                ) : (
                  <Feather className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                )}
                {hasAnnouncements && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 border-2 border-[#FAF9F5] dark:border-[#181818] rounded-full animate-pulse z-10" />
                )}
              </button>

              {/* Balon Kata / Floating Tooltip Lucu Penunjuk Pengumuman (Tampil 3 Detik lalu Nyelip Lucu ke Kiri) */}
              <AnimatePresence>
                {showCuteNotification && (
                  <motion.div
                    id="announcement-cute-tooltip"
                    initial={{ opacity: 0, x: -45, scale: 0.85, rotate: -6 }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      y: [0, -3, 0],
                      scale: 1,
                      rotate: 0,
                      transition: {
                        x: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
                        y: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                        opacity: { duration: 0.25 },
                        scale: { duration: 0.25 }
                      }
                    }}
                    exit={{
                      x: -160,
                      opacity: 0,
                      scale: 0.72,
                      rotate: -15,
                      transition: {
                        duration: 0.52,
                        ease: [0.32, 0, 0.67, 0] // nyelip mulus & lucu ke kiri
                      }
                    }}
                    onClick={handleOpenBrandOrNotification}
                    className="absolute top-full left-0 mt-2.5 z-50 cursor-pointer select-none"
                    title="Ketuk untuk melihat pengumuman"
                  >
                    {/* Ekor panah menunjuk ke atas tepat ke tombol logo */}
                    <div
                      className={`absolute -top-1.5 left-3.5 w-3 h-3 border-t border-l rotate-45 shadow-2xs ${bubbleThemeStyle.arrow}`}
                    />

                    {/* Badan Kartu Balon */}
                    <div
                      className={`relative flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border transition-all duration-150 hover:scale-102 active:scale-95 ${bubbleThemeStyle.card}`}
                    >
                      {/* Ikon Lucu Beranimasi */}
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-sm ${bubbleThemeStyle.iconBox}`}
                      >
                        <span className="inline-block animate-wiggle">📜</span>
                      </div>

                      {/* Teks Lucu & Ramah */}
                      <div className="min-w-0 text-left">
                        <p
                          className={`text-[12px] sm:text-[12.5px] font-serif font-bold leading-tight whitespace-nowrap ${bubbleThemeStyle.title}`}
                        >
                          Ada kabar baru nih! ✨
                        </p>
                        <p
                          className={`text-[10px] sm:text-[10.5px] leading-tight mt-0.5 whitespace-nowrap flex items-center gap-1 ${bubbleThemeStyle.sub}`}
                        >
                          <span>Ketuk di sini untuk baca</span>
                          <span className="text-[11px] leading-none">👆</span>
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Novel Title / App Name */}
          {novelTitle && currentView !== 'home' ? (
            <div className="flex items-center min-w-0 flex-1 ml-0.5 sm:ml-1 overflow-hidden">
              <span className={`text-xs sm:text-base font-serif font-bold truncate block ${
                theme === 'dark' ? 'text-[#F5F3EE]' : theme === 'sepia' ? 'text-[#3B2C1C]' : 'text-stone-900'
              }`}>
                {novelTitle}
              </span>
            </div>
          ) : (
            <span className={`text-sm sm:text-base font-serif font-bold truncate block ${
              theme === 'dark' ? 'text-[#F5F3EE]' : theme === 'sepia' ? 'text-[#3B2C1C]' : 'text-stone-900'
            }`}>
              Pena Indonesia
            </span>
          )}
        </div>

        {/* Right: Tombol Segarkan & Pemilih Tema */}
        <div className="flex items-center shrink-0 ml-2 gap-1.5 sm:gap-2">
          {/* Tombol Segarkan Cepat */}
          <button
            id="btn-header-refresh"
            onClick={handleGlobalRefresh}
            disabled={isHeaderRefreshing}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95 shadow-2xs group ${
              theme === 'dark'
                ? 'bg-[#222222] hover:bg-[#2A2A2A] border-[#333333] text-stone-300'
                : theme === 'sepia'
                ? 'bg-[#FAF4E8] hover:bg-[#EFE6D4] border-[#D6C4A5] text-[#4A3B2C]'
                : 'bg-white hover:bg-stone-50 border-stone-200/90 text-stone-700'
            }`}
            title="Segarkan data terbaru dari server Firebase"
          >
            <RotateCw className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isHeaderRefreshing ? 'animate-spin text-[#50553C]' : 'group-hover:rotate-45 transition-transform'}`} />
          </button>

          <button
            id="btn-header-theme"
            onClick={openThemeModal}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer outline-none active:scale-95 shadow-2xs group ${
              theme === 'dark'
                ? 'bg-[#222222] hover:bg-[#2A2A2A] border-[#333333]'
                : theme === 'sepia'
                ? 'bg-[#FAF4E8] hover:bg-[#EFE6D4] border-[#D6C4A5]'
                : 'bg-white hover:bg-stone-50 border-stone-200/90'
            }`}
            title="Ganti Tema (Terang, Hangat, Malam)"
          >
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400 group-hover:rotate-12 transition-transform" />
            ) : theme === 'sepia' ? (
              <span className="text-sm sm:text-base leading-none group-hover:scale-110 transition-transform">🍂</span>
            ) : (
              <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-600 group-hover:rotate-45 transition-transform" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

