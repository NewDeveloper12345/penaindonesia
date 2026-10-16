import React, { useState, useEffect } from 'react';
import { Novel, SeriesGroup } from '../types';
import { groupNovelsBySeries } from '../services/novelService';
import { NovelListSkeleton } from './NovelListSkeleton';
import { 
  BookOpen, 
  Library, 
  WifiOff, 
  Loader2, 
  ChevronRight, 
  Layers 
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';

interface NovelListProps {
  novels: Novel[];
  loading?: boolean;
  activeTab?: 'all' | 'series';
  onChangeTab?: (tab: 'all' | 'series') => void;
  onSelectNovel: (novel: Novel) => void;
  onSelectSeries: (series: SeriesGroup) => void;
  isOffline?: boolean;
  onRetry?: () => void;
}

const SPINE_STYLES = [
  { bg: 'from-[#3A241D] via-[#543328] to-[#2B1B15]', border: '#6A4335', accent: '#E5A83B' },
  { bg: 'from-[#1A2C2C] via-[#243E3E] to-[#121F1F]', border: '#335858', accent: '#D4AF37' },
  { bg: 'from-[#2B1B2F] via-[#3F2545] to-[#1F1222]', border: '#5C3864', accent: '#F0C265' },
  { bg: 'from-[#1A2433] via-[#26354B] to-[#131A26]', border: '#374C6A', accent: '#E0B04C' },
  { bg: 'from-[#3D1A1A] via-[#572424] to-[#2B1010]', border: '#783535', accent: '#F2C94C' },
  { bg: 'from-[#282B1C] via-[#3C412A] to-[#1B1D12]', border: '#555C3B', accent: '#E5A83B' }
];

export const NovelList: React.FC<NovelListProps> = ({
  novels,
  loading = false,
  onSelectNovel,
  onSelectSeries,
  activeTab = 'all',
  onChangeTab,
  isOffline = false,
  onRetry
}) => {
  const { theme } = useAppTheme();
  const [localTab, setLocalTab] = useState<'all' | 'series'>('all');
  const currentTab = activeTab ?? localTab;

  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [isCheckingNet, setIsCheckingNet] = useState(false);
  const [netNotice, setNetNotice] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetNotice(null);
      if (onRetry) onRetry();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onRetry]);

  const handleRetry = () => {
    setIsCheckingNet(true);
    setNetNotice(null);
    if (onRetry) onRetry();
    setTimeout(() => {
      setIsCheckingNet(false);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setNetNotice('Belum ada koneksi internet terdeteksi kak');
        setTimeout(() => setNetNotice(null), 3500);
      }
    }, 1200);
  };

  const handleTabChange = (tab: 'all' | 'series') => {
    if (onChangeTab) onChangeTab(tab);
    else setLocalTab(tab);
  };

  const seriesGroups = groupNovelsBySeries(novels);

  if (loading) {
    return <NovelListSkeleton />;
  }

  // Jika tidak ada novel sama sekali (misal offline total saat baru buka pertama)
  if (novels.length === 0) {
    return (
      <div className="relative min-h-[calc(100vh-100px)] max-w-3xl mx-auto px-3 sm:px-6 pt-3 pb-8 overflow-hidden">
        {/* Placeholder kabur di latar belakang */}
        <div className="space-y-3 sm:space-y-3.5 select-none pointer-events-none opacity-40 blur-[1.5px] filter">
          <div className="flex justify-center mb-3.5 sm:mb-4">
            <div className="flex items-center gap-1 p-1 bg-stone-200/60 dark:bg-stone-800/60 rounded-xl w-full max-w-[220px]">
              <div className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium bg-white dark:bg-stone-700 text-stone-800 shadow-2xs flex items-center justify-center gap-1.5">
                <BookOpen className="w-3 h-3 text-[#414E2E]" />
                <span>Buku</span>
              </div>
              <div className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium text-stone-700 dark:text-stone-300 flex items-center justify-center gap-1.5">
                <Library className="w-3.5 h-3.5" />
                <span>Seri</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="relative py-1 pl-0.5 pr-2.5 sm:pr-3">
                <div className="aspect-[3/4.4] rounded-xl sm:rounded-2xl bg-stone-200 dark:bg-stone-800 border-2 border-stone-300/80 dark:border-stone-700 p-2 flex flex-col justify-between">
                  <div className="h-3 w-10 rounded bg-stone-300 dark:bg-stone-700" />
                  <div className="space-y-1 my-auto">
                    <div className="h-3 w-4/5 mx-auto rounded bg-stone-400 dark:bg-stone-600" />
                    <div className="h-2.5 w-3/5 mx-auto rounded bg-stone-300 dark:bg-stone-700" />
                  </div>
                  <div className="h-2 w-12 mx-auto rounded bg-stone-300 dark:bg-stone-700" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal peringatan koneksi terputus di tengah */}
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white/95 dark:bg-[#1E1E1E]/95 sepia:bg-[#F7F2E8]/95 backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-xl border border-stone-200/90 dark:border-stone-700/80 sepia:border-[#DFD5C4] text-center transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="w-13 h-13 rounded-2xl bg-[#414E2E]/10 dark:bg-[#50553C]/30 sepia:bg-[#414E2E]/15 text-[#414E2E] dark:text-[#889B68] sepia:text-[#414E2E] flex items-center justify-center mx-auto mb-3.5 shadow-2xs">
              <WifiOff className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-serif font-bold text-stone-800 dark:text-stone-100 sepia:text-stone-900 mb-1.5">
              Koneksi Terputus
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 sepia:text-stone-700 leading-relaxed mb-4">
              Nyalakan internet untuk mulai membaca ya kak😊
            </p>
            <button
              id="btn-retry-connection"
              type="button"
              onClick={handleRetry}
              disabled={isCheckingNet}
              className="w-full py-2.5 px-4 rounded-xl bg-[#414E2E] hover:bg-[#364125] active:bg-[#2B351E] text-white text-xs sm:text-sm font-medium transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-wait"
            >
              <Loader2 className={`w-3.5 h-3.5 ${isCheckingNet ? 'animate-spin' : ''}`} />
              <span>{isCheckingNet ? 'Memeriksa Jaringan...' : 'Coba Hubungkan Lagi'}</span>
            </button>
            {netNotice && (
              <p className="mt-2.5 text-[11px] text-amber-700 dark:text-amber-400 font-medium animate-in fade-in duration-150">
                {netNotice}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 pt-3 pb-6 sm:pt-4 sm:pb-8">
      {/* Banner peringatan offline jika internet mati saat data sudah ada */}
      {(isOffline || !isOnline) && (
        <div className="mb-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 sepia:bg-[#EDE3CE] border border-amber-200/80 dark:border-amber-800/60 sepia:border-amber-300/60 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200 sepia:text-amber-900 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-medium">Nyalakan internet untuk mulai membaca ya kak😊</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isCheckingNet}
            className="shrink-0 py-1 px-2.5 rounded-lg bg-white/80 dark:bg-stone-800/80 text-[11px] font-medium text-stone-700 dark:text-stone-200 border border-stone-200/60 dark:border-stone-700/60 hover:bg-white transition-all flex items-center gap-1 cursor-pointer"
          >
            <Loader2 className={`w-3 h-3 ${isCheckingNet ? 'animate-spin' : ''}`} />
            <span>{isCheckingNet ? 'Cek...' : 'Cek'}</span>
          </button>
        </div>
      )}

      {/* Tab Switcher: Buku vs Seri */}
      <div className="flex justify-center mb-3.5 sm:mb-4">
        <div className={`relative p-1 rounded-xl w-full max-w-[220px] select-none shadow-2xs border transition-colors ${
          theme === 'dark'
            ? 'bg-[#242424] border-[#333333]'
            : theme === 'sepia'
            ? 'bg-[#EAE4D7] border-[#DFD5C4]'
            : 'bg-stone-200/90 border-stone-300/70'
        }`}>
          <div
            className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg pointer-events-none transform-gpu transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] will-change-transform ${
              currentTab === 'all' ? 'translate-x-0' : 'translate-x-full'
            } ${
              theme === 'dark'
                ? 'bg-[#333333] shadow-sm'
                : theme === 'sepia'
                ? 'bg-[#FAF4E8] shadow-xs'
                : 'bg-white shadow-xs'
            }`}
          />
          <div className="relative flex items-center">
            <button
              id="tab-all-books"
              type="button"
              onClick={() => handleTabChange('all')}
              className={`relative z-10 flex-1 py-1.5 px-2 rounded-lg text-xs transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                currentTab === 'all'
                  ? theme === 'dark'
                    ? 'text-white font-bold'
                    : theme === 'sepia'
                    ? 'text-[#2E2114] font-bold'
                    : 'text-stone-900 font-bold'
                  : theme === 'dark'
                  ? 'text-stone-400 font-semibold hover:text-stone-200'
                  : theme === 'sepia'
                  ? 'text-[#6E5942] font-semibold hover:text-[#2E2114]'
                  : 'text-stone-600 font-semibold hover:text-stone-900'
              }`}
            >
              <BookOpen
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  currentTab === 'all'
                    ? theme === 'dark'
                      ? 'text-[#889B68] scale-110'
                      : theme === 'sepia'
                      ? 'text-[#6E502B] scale-110'
                      : 'text-[#414E2E] scale-110'
                    : 'opacity-70 scale-100'
                }`}
              />
              <span>Buku</span>
            </button>
            <button
              id="tab-series-books"
              type="button"
              onClick={() => handleTabChange('series')}
              className={`relative z-10 flex-1 py-1.5 px-2 rounded-lg text-xs transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                currentTab === 'series'
                  ? theme === 'dark'
                    ? 'text-white font-bold'
                    : theme === 'sepia'
                    ? 'text-[#2E2114] font-bold'
                    : 'text-stone-900 font-bold'
                  : theme === 'dark'
                  ? 'text-stone-400 font-semibold hover:text-stone-200'
                  : theme === 'sepia'
                  ? 'text-[#6E5942] font-semibold hover:text-[#2E2114]'
                  : 'text-stone-600 font-semibold hover:text-stone-900'
              }`}
            >
              <Library
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  currentTab === 'series'
                    ? theme === 'dark'
                      ? 'text-[#889B68] scale-110'
                      : theme === 'sepia'
                      ? 'text-[#6E502B] scale-110'
                      : 'text-[#414E2E] scale-110'
                    : 'opacity-70 scale-100'
                }`}
              />
              <span>Seri</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab: Buku (Grid 3 Kolom Kartu Buku 3D Estetik) */}
      {currentTab === 'all' && (
        <div
          id="home-tab-all-books"
          className="grid grid-cols-3 gap-2.5 sm:gap-4 animate-in fade-in zoom-in-[0.99] duration-200 ease-out"
        >
          {novels.map((novel) => {
            const coverTrimmed = typeof novel.cover === 'string' ? novel.cover.trim() : '';
            const hasValidCover = Boolean(
              coverTrimmed &&
              (coverTrimmed.startsWith('http://') ||
               coverTrimmed.startsWith('https://') ||
               coverTrimmed.startsWith('data:image'))
            );

            return (
              <div
                key={novel.id}
                id={`novel-card-${novel.id}`}
                onClick={() => onSelectNovel(novel)}
                className="group relative cursor-pointer select-none py-1 pl-0.5 pr-2.5 sm:pr-3 transition-transform duration-200 hover:-translate-y-1 active:scale-[0.98]"
                title={novel.title}
              >
                {/* Efek Tepi Kertas Kanan (3D Novel Bookpaper) */}
                <div
                  className="absolute top-2 bottom-1.5 right-1 sm:right-1.5 w-2.5 sm:w-3 rounded-r-xs border-r border-y border-[#D6C8AE] dark:border-[#524B3C] shadow-[1px_2px_4px_rgba(0,0,0,0.18)] flex flex-col justify-between py-1.5 overflow-hidden pointer-events-none z-0"
                  style={{ backgroundColor: '#EDE3CD' }}
                >
                  <div className="w-full h-px bg-[#D9CBAC] dark:bg-[#5C5443] opacity-80" />
                  <div className="w-full h-px bg-[#CFBE9D] dark:bg-[#4E4738] opacity-90" />
                  <div className="w-full h-px bg-[#D9CBAC] dark:bg-[#5C5443] opacity-80" />
                  <div className="w-full h-px bg-[#CFBE9D] dark:bg-[#4E4738] opacity-90" />
                  <div className="w-full h-px bg-[#D9CBAC] dark:bg-[#5C5443] opacity-80" />
                </div>

                {/* Tepi Kertas Bawah */}
                <div
                  className="absolute bottom-1 left-2 right-2.5 sm:right-3 h-1.5 rounded-b-xs border-b border-x border-[#D6C8AE] dark:border-[#524B3C] pointer-events-none z-0"
                  style={{ backgroundColor: '#EDE3CD' }}
                />

                {/* Bayangan Dasar Buku */}
                <div className="absolute -inset-x-0.5 bottom-0 h-4 bg-black/30 blur-[6px] -z-10 transform translate-x-1.5 translate-y-1.5 group-hover:translate-x-2 group-hover:translate-y-2 group-hover:blur-[8px] transition-all duration-200 pointer-events-none rounded-xl" />
                <div className="absolute inset-y-1 left-1.5 right-1.5 bg-black/20 blur-[2px] -z-10 transform translate-x-1 translate-y-1 pointer-events-none rounded-xl" />

                {/* Sampul Buku Asli */}
                <div className="relative aspect-[3/4.4] rounded-xl sm:rounded-2xl overflow-hidden bg-stone-100 dark:bg-stone-800 border-2 border-stone-800/20 dark:border-stone-300/25 ring-1 ring-black/15 dark:ring-white/15 shadow-[0_2px_8px_rgba(0,0,0,0.14)] flex flex-col z-10">
                  <div className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl border border-black/25 dark:border-white/20 z-20" />

                  {hasValidCover ? (
                    <img
                      src={coverTrimmed}
                      alt={novel.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover block group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : novel.customCover?.bgGradient ? (
                    <div
                      className="w-full h-full text-white flex flex-col justify-between p-2 sm:p-2.5 select-none"
                      style={{ background: novel.customCover.bgGradient }}
                    >
                      <div className="flex items-center">
                        <span className="bg-white/20 backdrop-blur-xs text-white/95 text-[7.5px] sm:text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded truncate max-w-full">
                          {novel.genre ? (Array.isArray(novel.genre) ? novel.genre[0] : novel.genre).toUpperCase() : 'NOVEL'}
                        </span>
                      </div>
                      <div className="my-auto py-0.5 text-center px-1">
                        <span
                          className="text-[10.5px] sm:text-xs font-serif font-bold line-clamp-3 leading-tight"
                          style={{ color: novel.customCover.titleColor || '#FFFFFF' }}
                        >
                          {novel.title}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-white/20 text-center text-[8px] sm:text-[9px] text-white/85 truncate">
                        {novel.author || 'Penulis'}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-[#343B2C] text-white flex flex-col justify-between p-2 sm:p-2.5 select-none">
                      <div className="flex items-center">
                        <span className="bg-white/20 backdrop-blur-xs text-white/95 text-[7.5px] sm:text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded truncate max-w-full">
                          {novel.genre ? (Array.isArray(novel.genre) ? novel.genre[0] : novel.genre).toUpperCase() : 'NOVEL'}
                        </span>
                      </div>
                      <div className="my-auto py-0.5 text-center px-1">
                        <span className="text-[10.5px] sm:text-xs font-serif font-bold text-white line-clamp-3 leading-tight">
                          {novel.title}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-white/20 text-center text-[8px] sm:text-[9px] text-white/85 truncate">
                        {novel.author || 'Penulis'}
                      </div>
                    </div>
                  )}

                  {/* Spine Crease / Lipatan Punggung Buku Kiri */}
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-2 sm:w-2.5 bg-gradient-to-r from-black/30 via-white/10 to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 left-[2px] sm:left-[2.5px] w-px bg-black/20" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/15 opacity-60 group-hover:opacity-10 transition-opacity" />

                  {/* Ribbon Bookmark Kecil Emas di Atas Kanan */}
                  <div className="pointer-events-none absolute top-0 right-2 sm:right-3 w-2.5 sm:w-3.5 h-4.5 sm:h-6 bg-gradient-to-b from-[#E5A83B] to-[#C97B1A] shadow-xs rounded-b-xs flex items-end justify-center pb-0.5 z-10">
                    <div className="w-1 sm:w-1.5 h-1 sm:h-1.5 border-l-2 border-b-2 border-white/40 rotate-[-45deg] mb-0.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Seri (Rak Buku Punggung / Series Spines) */}
      {currentTab === 'series' && (
        <div className="space-y-3 sm:space-y-3.5 animate-in fade-in zoom-in-[0.99] duration-200 ease-out">
          {seriesGroups.length === 0 ? (
            <div className={`rounded-2xl p-6 sm:p-8 text-center border shadow-2xs transition-colors ${
              theme === 'dark'
                ? 'bg-[#1C1C1C] border-[#2E2E2E]'
                : theme === 'sepia'
                ? 'bg-[#FAF4E8] border-[#D6C4A5]'
                : 'bg-white border-stone-200/80'
            }`}>
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                theme === 'dark' ? 'bg-[#50553C]/20 text-[#A4B686]' : 'bg-[#50553C]/10 text-[#50553C]'
              }`}>
                <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className={`text-sm sm:text-base font-serif font-bold mb-1 ${
                theme === 'dark' ? 'text-stone-100' : theme === 'sepia' ? 'text-[#3B2C1C]' : 'text-stone-800'
              }`}>
                Belum Ada Seri Buku
              </h3>
              <p className={`text-xs sm:text-sm max-w-sm mx-auto leading-relaxed ${
                theme === 'dark' ? 'text-stone-400' : theme === 'sepia' ? 'text-[#826E57]' : 'text-stone-500'
              }`}>
                Penulis belum mengelompokkan novel ke dalam seri. Buku yang memiliki nama seri di Author App akan tampil otomatis di sini.
              </p>
            </div>
          ) : (
            seriesGroups.map((group) => (
              <div
                key={group.seriesName}
                className={`rounded-2xl px-2.5 pt-2 pb-2.5 sm:px-3 sm:pt-2.5 sm:pb-3 border shadow-xs overflow-hidden transition-colors ${
                  theme === 'dark'
                    ? 'bg-[#1C1C1C] border-[#2E2E2E]'
                    : theme === 'sepia'
                    ? 'bg-[#FAF4E8] border-[#D6C4A5]'
                    : 'bg-white border-stone-200/90'
                }`}
              >
                <div className="relative pt-0.5 pb-0">
                  {/* Deretan Punggung Buku di Rak */}
                  <div className="flex items-end gap-2 sm:gap-2.5 overflow-x-auto pb-0 pt-1 px-1 custom-scrollbar -mx-1 scroll-smooth">
                    {group.novels.map((novel, idx) => {
                      const seriesNum = idx + 1;
                      const badgeLabel = `S${seriesNum}`;
                      const style = SPINE_STYLES[idx % SPINE_STYLES.length];

                      return (
                        <div
                          key={novel.id}
                          onClick={() => onSelectNovel(novel)}
                          className="group/spine relative flex-shrink-0 cursor-pointer select-none transition-all duration-200 hover:-translate-y-2 active:scale-[0.98]"
                          title={`${novel.title} (${badgeLabel}) - Klik untuk membaca`}
                        >
                          <div
                            className={`relative w-9.5 sm:w-11.5 h-32 sm:h-40 rounded-t-[3px] rounded-b-[1px] bg-gradient-to-r ${style.bg} border-x border-t border-black/40 shadow-[1px_4px_8px_rgba(0,0,0,0.28)] flex flex-col justify-between items-center py-1.5 sm:py-2 overflow-hidden`}
                            style={{ borderColor: style.border }}
                          >
                            <div className="pointer-events-none absolute inset-y-0 left-1 right-1 bg-gradient-to-r from-transparent via-white/12 to-transparent opacity-80" />
                            <div className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-black/45" />
                            <div className="pointer-events-none absolute inset-y-0 right-0 w-0.5 bg-black/45" />

                            {/* Aksen Emas Atas */}
                            <div className="w-full flex flex-col gap-0.5 px-0.5 z-10">
                              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#E5A83B]/80 to-transparent shadow-xs" />
                              <div className="w-full h-px bg-black/60" />
                            </div>

                            {/* Judul Seri Vertikal */}
                            <div className="flex-1 flex items-center justify-center my-0.5 z-10 px-0.5 overflow-hidden">
                              <span
                                className="text-[9.5px] sm:text-[10.5px] font-serif font-bold text-amber-100/95 tracking-wide line-clamp-1 max-h-20 sm:max-h-26 drop-shadow-xs select-none"
                                style={{
                                  writingMode: 'vertical-rl',
                                  textOrientation: 'mixed',
                                  transform: 'rotate(180deg)',
                                  letterSpacing: '0.04em'
                                }}
                              >
                                {group.seriesName}
                              </span>
                            </div>

                            {/* Aksen Emas Bawah */}
                            <div className="w-full flex flex-col gap-0.5 px-0.5 z-10 mb-0.5">
                              <div className="w-full h-px bg-black/60" />
                              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#E5A83B]/80 to-transparent shadow-xs" />
                            </div>

                            {/* Badge Medali Nomor Seri */}
                            <div className="z-10 mt-auto">
                              <div
                                className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-full bg-gradient-to-b from-[#F5D061] via-[#D49A24] to-[#99630D] p-0.5 shadow-xs flex items-center justify-center border border-[#FFE79A]/60 group-hover/spine:scale-105 transition-transform"
                                title={`Seri Urutan #${seriesNum}`}
                              >
                                <div className="w-full h-full rounded-full bg-[#241712] flex items-center justify-center">
                                  <span className="text-[8.5px] sm:text-[9.5px] font-mono font-extrabold text-[#F7DE98] tracking-tighter drop-shadow-xs">
                                    {badgeLabel}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="pointer-events-none absolute bottom-0 inset-x-0 h-1 bg-black/60" />
                          </div>

                          <div className="absolute -bottom-0.5 inset-x-1 h-1.5 bg-black/35 blur-[2px] -z-10 group-hover/spine:blur-[3px] group-hover/spine:translate-y-0.5 transition-all pointer-events-none rounded-full" />
                        </div>
                      );
                    })}

                    {/* Tombol Lihat Selengkapnya jika lebih dari 2 buku */}
                    {group.novels.length >= 3 && (
                      <div
                        onClick={() => onSelectSeries(group)}
                        className="group/more-spine relative flex-shrink-0 cursor-pointer select-none transition-all duration-200 hover:-translate-y-2 active:scale-[0.98]"
                        title="Lihat semua buku dalam seri ini"
                      >
                        <div className="relative w-9 sm:w-10 h-32 sm:h-40 rounded-t-[3px] rounded-b-[1px] bg-gradient-to-r from-[#211612] via-[#33221C] to-[#1A110E] border-x border-t border-[#E5A83B]/40 shadow-[1px_4px_8px_rgba(0,0,0,0.32)] flex flex-col justify-between items-center py-1.5 sm:py-2 overflow-hidden">
                          <div className="pointer-events-none absolute inset-y-0 left-1 right-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-80" />
                          <div className="w-full flex flex-col gap-0.5 px-0.5 z-10">
                            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#E5A83B] to-transparent" />
                            <div className="w-full h-px bg-black/60" />
                          </div>
                          <div className="flex-1 flex flex-col items-center justify-center my-0.5 z-10 px-0.5">
                            <span className="font-mono text-sm sm:text-base font-extrabold text-[#F7DE98] tracking-widest animate-pulse drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                              &gt;&gt;
                            </span>
                          </div>
                          <div className="w-full flex flex-col gap-0.5 px-0.5 z-10 mb-0.5">
                            <div className="w-full h-px bg-black/60" />
                            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#E5A83B] to-transparent" />
                          </div>
                          <div className="z-10 mt-auto">
                            <div className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-full bg-gradient-to-b from-[#F5D061] via-[#D49A24] to-[#99630D] p-0.5 shadow-xs flex items-center justify-center border border-[#FFE79A]/60 group-hover/more-spine:scale-105 transition-transform">
                              <div className="w-full h-full rounded-full bg-[#241712] flex items-center justify-center">
                                <ChevronRight className="w-3.5 h-3.5 text-[#F7DE98]" />
                              </div>
                            </div>
                          </div>
                          <div className="pointer-events-none absolute bottom-0 inset-x-0 h-1 bg-black/60" />
                        </div>
                        <div className="absolute -bottom-0.5 inset-x-1 h-1.5 bg-black/35 blur-[2px] -z-10 group-hover/more-spine:blur-[3px] group-hover/more-spine:translate-y-0.5 transition-all pointer-events-none rounded-full" />
                      </div>
                    )}
                  </div>

                  {/* Papan Kayu Rak Buku (Shelf Board) */}
                  <div
                    onClick={() => onSelectSeries(group)}
                    className="group/shelf relative w-full mt-0 cursor-pointer select-none"
                    title="Klik untuk membuka detail seri ini"
                  >
                    <div className={`w-full h-1.5 sm:h-2 rounded-t-xs border-t shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] ${
                      theme === 'dark'
                        ? 'bg-gradient-to-b from-[#8E6D4E] to-[#6E5035] border-[#A68260]'
                        : theme === 'sepia'
                        ? 'bg-gradient-to-b from-[#A58260] to-[#886445] border-[#BD9A78]'
                        : 'bg-gradient-to-b from-[#B08D69] to-[#92704E] border-[#C8A783]'
                    }`} />
                    <div className={`w-full min-h-[30px] sm:min-h-[34px] rounded-b-md border-t shadow-[0_3px_8px_rgba(0,0,0,0.18)] flex items-center px-2 sm:px-2.5 py-1 justify-between gap-1.5 group-hover/shelf:brightness-105 transition-all ${
                      theme === 'dark'
                        ? 'bg-gradient-to-b from-[#563E28] via-[#45301F] to-[#2E1F13] border-black/40 text-[#F7DE98]'
                        : theme === 'sepia'
                        ? 'bg-gradient-to-b from-[#6A4E33] via-[#573E25] to-[#402B17] border-black/30 text-[#FDF2D6]'
                        : 'bg-gradient-to-b from-[#7A583A] via-[#66462A] to-[#4F331A] border-[#92704E]/50 text-[#FFF6E0]'
                    }`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E5B64B] border border-[#FFE79A]/60 shadow-xs shrink-0" />
                      <div className="flex-1 flex items-center justify-center min-w-0 px-1">
                        <span className="font-serif font-bold text-[11.5px] sm:text-xs text-[#FFF6E0] tracking-wide truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] text-center group-hover/shelf:text-white transition-colors">
                          {group.seriesName}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="bg-[#241712]/75 border border-[#D49A24]/40 text-[#F7DE98] text-[9.5px] font-mono px-1.5 py-0.5 rounded shadow-xs">
                          {group.novels.length} Buku
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#F7DE98] group-hover/shelf:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
