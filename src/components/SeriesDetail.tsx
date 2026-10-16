import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Novel, SeriesGroup } from '../types';
import { BookOpen, Layers, User, Tag, BookMarked, Bookmark } from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';

interface SeriesDetailProps {
  series: SeriesGroup;
  onBack?: () => void;
  onSelectNovel: (novel: Novel) => void;
}

export const SeriesDetail: React.FC<SeriesDetailProps> = ({
  series,
  onBack,
  onSelectNovel
}) => {
  const { theme } = useAppTheme();
  const [liveBanner, setLiveBanner] = useState<string | undefined>(series.seriesBanner);
  const [liveCover, setLiveCover] = useState<string | undefined>(series.seriesCover);
  const [liveSynopsis, setLiveSynopsis] = useState<string | undefined>(series.seriesSynopsis);
  const [bannerLoadError, setBannerLoadError] = useState(false);
  const [coverLoadError, setCoverLoadError] = useState(false);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  const [isSynopsisOverflowing, setIsSynopsisOverflowing] = useState(false);
  const synopsisRef = useRef<HTMLParagraphElement>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Realtime Firestore Listener untuk Koleksi 'book_series' dan 'series'
  useEffect(() => {
    setLiveBanner(series.seriesBanner);
    setLiveCover(series.seriesCover);
    setLiveSynopsis(series.seriesSynopsis);
    setBannerLoadError(false);
    setCoverLoadError(false);

    if (!db) return;
    const currentSeriesName = (series.seriesName || '').trim();
    if (!currentSeriesName) return;

    const targetCollections = ['book_series', 'series', 'seri', 'daftarSeri', 'bookSeries'];
    const unsubs: (() => void)[] = [];

    targetCollections.forEach((collName) => {
      try {
        const collRef = collection(db, collName);
        const unsub = onSnapshot(
          collRef,
          (snapshot) => {
            for (const docSnap of snapshot.docs) {
              const d = docSnap.data();
              const nameCandidate = String(
                d.seriesName || d.namaSeri || d.seri || d.name || d.title || d.judulSeri || docSnap.id || ''
              ).trim();

              if (nameCandidate.toLowerCase() === currentSeriesName.toLowerCase()) {
                const fetchedBanner = d.seriesBanner || d.bannerSeri || d.banner || d.urlBannerSeri || d.bannerUrl || d.urlBanner || d.headerImage;
                const fetchedCover = d.seriesCover || d.sampulSeri || d.coverSeri || d.cover || d.urlSampul || d.imageUrl;
                const fetchedSynopsis = d.seriesSynopsis || d.sinopsisSeri || d.ringkasanSeri || d.synopsis || d.sinopsis || d.deskripsi || d.description;

                if (fetchedBanner && typeof fetchedBanner === 'string' && fetchedBanner.trim()) {
                  setLiveBanner(fetchedBanner.trim());
                  setBannerLoadError(false);
                }
                if (fetchedCover && typeof fetchedCover === 'string' && fetchedCover.trim()) {
                  setLiveCover(fetchedCover.trim());
                  setCoverLoadError(false);
                }
                if (fetchedSynopsis !== undefined && fetchedSynopsis !== null) {
                  setLiveSynopsis(String(fetchedSynopsis).trim());
                }
                break;
              }
            }
          },
          (err) => {
            console.warn(`Firestore series listener error on '${collName}':`, err);
          }
        );
        unsubs.push(unsub);
      } catch (e) {
        console.warn(`Failed to attach listener for ${collName}:`, e);
      }
    });

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }, [series.seriesName, series.seriesBanner, series.seriesCover, series.seriesSynopsis]);

  // Ukur apakah deskripsi terpotong untuk toggle titik ... (expand/collapse)
  useEffect(() => {
    const checkOverflow = () => {
      const el = synopsisRef.current;
      if (!el) return;
      if (!isSynopsisExpanded) {
        setIsSynopsisOverflowing(el.scrollHeight > el.clientHeight + 2);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [liveSynopsis, isSynopsisExpanded]);

  // Tutup preview cover saat tombol ESC ditekan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const trimmedBanner = typeof liveBanner === 'string' ? liveBanner.trim() : '';
  const hasValidBanner = Boolean(
    trimmedBanner &&
    !bannerLoadError &&
    (trimmedBanner.startsWith('http://') ||
     trimmedBanner.startsWith('https://') ||
     trimmedBanner.startsWith('data:image'))
  );

  const trimmedCover = typeof liveCover === 'string' ? liveCover.trim() : '';
  const hasValidCover = Boolean(
    trimmedCover &&
    !coverLoadError &&
    (trimmedCover.startsWith('http://') ||
     trimmedCover.startsWith('https://') ||
     trimmedCover.startsWith('data:image'))
  );

  const hasSynopsisText = Boolean(liveSynopsis && liveSynopsis.trim().length > 0);

  // Urutkan novel dalam seri berdasarkan seriesOrder atau orderIndex
  const sortedNovels = [...series.novels].sort((a, b) => {
    const orderA = typeof a.seriesOrder === 'number' ? a.seriesOrder : (typeof a.orderIndex === 'number' ? a.orderIndex : 9999);
    const orderB = typeof b.seriesOrder === 'number' ? b.seriesOrder : (typeof b.orderIndex === 'number' ? b.orderIndex : 9999);
    if (orderA !== orderB) return orderA - orderB;
    const titleCmp = a.title.localeCompare(b.title, 'id');
    if (titleCmp !== 0) return titleCmp;
    return a.id.localeCompare(b.id);
  });

  return (
    <div className="w-full pb-12 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. HEADER SERI ESTETIK: BANNER LANDSCAPE & GRADASI BAWAH HALUS */}
      {/* ========================================================================= */}
      <div 
        id="series-header-section"
        className={`series-header-section relative w-full overflow-hidden transition-colors duration-200 ${
          theme === 'dark' ? 'bg-[#141414]' : theme === 'sepia' ? 'bg-[#F7F2E8]' : 'bg-[#FAF9F5]'
        }`}
      >
        {/* Banner Landscape (h-48 sm:h-56 md:h-64) */}
        <div 
          id="series-banner-container"
          className={`series-banner-container relative w-full h-48 sm:h-56 md:h-64 overflow-hidden select-none transition-colors ${
            theme === 'dark' ? 'bg-[#1A1A1A]' : theme === 'sepia' ? 'bg-[#DFD5C4]' : 'bg-[#E7E5E4]'
          }`}
        >
          {hasValidBanner ? (
            <img
              src={trimmedBanner}
              alt={`Banner ${series.seriesName}`}
              referrerPolicy="no-referrer"
              onClick={() => setPreviewImage({ url: trimmedBanner, title: `Banner Seri ${series.seriesName}` })}
              onError={() => setBannerLoadError(true)}
              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
              title="Klik untuk memperbesar banner seri"
            />
          ) : (
            /* Fallback Banner Estetis Bertema Sastra / Alam */
            <div className="w-full h-full bg-gradient-to-br from-[#292F20] via-[#3E4532] to-[#1A1E14] flex items-center justify-center p-6 relative">
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
              <div className="text-center z-10 opacity-75">
                <Bookmark className="w-8 h-8 text-white/60 mx-auto mb-1.5" />
                <span className="text-white/80 font-serif tracking-widest text-xs uppercase">
                  Seri Novel
                </span>
              </div>
            </div>
          )}

          {/* Gradasi Bawah Halus (Fades cleanly to the theme background color) */}
          <div 
            className="series-banner-fade absolute inset-x-0 bottom-0 h-28 sm:h-36 pointer-events-none transition-all"
            style={{
              background: theme === 'dark'
                ? 'linear-gradient(to top, #141414 0%, rgba(20, 20, 20, 0.88) 55%, transparent 100%)'
                : theme === 'sepia'
                ? 'linear-gradient(to top, #F7F2E8 0%, rgba(247, 242, 232, 0.85) 55%, transparent 100%)'
                : 'linear-gradient(to top, #FAF9F5 0%, rgba(250, 249, 245, 0.85) 55%, transparent 100%)'
            }}
          />
        </div>

        {/* ========================================================================= */}
        {/* 2. PROFIL BULAT DI TENGAH: Memotong separuh garis bawah banner */}
        {/* ========================================================================= */}
        <div className="relative -mt-20 sm:-mt-24 md:-mt-26 z-20 flex flex-col items-center px-4 pb-1">
          <div 
            id="series-circular-profile"
            className={`series-circular-profile w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 overflow-hidden shadow-xl flex items-center justify-center shrink-0 relative group transition-colors ${
              theme === 'dark'
                ? 'border-[#141414] bg-[#1E1E1E]'
                : theme === 'sepia'
                ? 'border-[#F7F2E8] bg-[#FCF9F3]'
                : 'border-[#FAF9F5] bg-white'
            }`}
          >
            {hasValidCover ? (
              <img
                src={trimmedCover}
                alt={`Cover Seri ${series.seriesName}`}
                referrerPolicy="no-referrer"
                onClick={() => setPreviewImage({ url: trimmedCover, title: `Cover Seri ${series.seriesName}` })}
                onError={() => setCoverLoadError(true)}
                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                title="Klik untuk memperbesar cover seri"
              />
            ) : (
              /* Fallback Lingkaran Profil Estetis */
              <div className="w-full h-full bg-gradient-to-b from-[#3E4532] to-[#252A1D] flex flex-col items-center justify-center text-white p-2 text-center select-none">
                <BookOpen className="w-7 h-7 text-white/80 mb-0.5" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/90">
                  Seri
                </span>
              </div>
            )}
          </div>

          {/* Informasi Seri di Bawah Lingkaran Profil */}
          <div className="mt-2 sm:mt-2.5 text-center max-w-xl mx-auto w-full">
            {/* Nama Seri (Judul Tebal Estetis) */}
            <h1 
              id="series-title"
              className={`series-title text-xl sm:text-2xl md:text-3xl font-serif font-bold leading-snug break-words px-2 transition-colors ${
                theme === 'dark'
                  ? 'text-[#F5F3EE]'
                  : theme === 'sepia'
                  ? 'text-[#221C16]'
                  : 'text-[#1C1917]'
              }`}
            >
              {series.seriesName}
            </h1>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KONTEN UTAMA: SINOPSIS SERI & DAFTAR BUKU */}
      {/* ========================================================================= */}
      <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-2.5 sm:pt-3.5 space-y-4 sm:space-y-5">
        {/* Card Deskripsi Seri */}
        <div 
          id="series-synopsis-card"
          className={`series-profile-card rounded-2xl p-4 sm:p-5 border shadow-2xs transition-colors ${
            theme === 'dark'
              ? 'bg-[#1E1E1E] border-[#333333]'
              : theme === 'sepia'
              ? 'bg-[#FCF9F3] border-[#DFD5C4]'
              : 'bg-white border-stone-200/80'
          }`}
        >
          <div className={`flex items-center justify-center pb-2.5 mb-2.5 border-b transition-colors ${
            theme === 'dark' ? 'border-[#2A2A2A]' : theme === 'sepia' ? 'border-[#EAE3D5]' : 'border-stone-100'
          }`}>
            <h2 className={`series-synopsis-label text-xs sm:text-sm font-mono uppercase tracking-wider font-bold flex items-center justify-center gap-1.5 transition-colors ${
              theme === 'dark' ? 'text-[#C5BFB0]' : theme === 'sepia' ? 'text-[#8C6D4F]' : 'text-[#50553C]'
            }`}>
              <Bookmark className="w-3.5 h-3.5" />
              <span>Deskripsi Seri</span>
            </h2>
          </div>

          {hasSynopsisText ? (
            <div 
              onClick={() => {
                if (isSynopsisOverflowing || isSynopsisExpanded) {
                  setIsSynopsisExpanded(!isSynopsisExpanded);
                }
              }}
              className={`relative group select-none transition-all px-2 sm:px-3.5 md:px-4 ${
                isSynopsisOverflowing || isSynopsisExpanded
                  ? 'cursor-pointer active:opacity-85'
                  : 'cursor-default'
              }`}
              title={
                (isSynopsisOverflowing || isSynopsisExpanded)
                  ? (isSynopsisExpanded ? 'Klik untuk menutup deskripsi' : 'Klik untuk membaca deskripsi selengkapnya')
                  : undefined
              }
            >
              <p 
                ref={synopsisRef}
                className={`synopsis-paragraph font-sans text-sm sm:text-base leading-relaxed whitespace-pre-line text-justify transition-all ${
                  !isSynopsisExpanded ? 'line-clamp-3 sm:line-clamp-4' : ''
                } ${
                  theme === 'dark' ? 'text-[#DDD8CE]' : theme === 'sepia' ? 'text-[#382F24]' : 'text-stone-800'
                }`}
              >
                {liveSynopsis}
              </p>

              {/* Indikator titik ... saat terpotong seperti pada sinopsis buku */}
              {!isSynopsisExpanded && isSynopsisOverflowing && (
                <div className="synopsis-fade absolute inset-x-0 bottom-0 h-8 pointer-events-none rounded-b-sm flex items-end justify-center">
                  <span className="text-[10px] text-stone-400 font-mono tracking-widest leading-none pb-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    •••
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className={`italic text-xs sm:text-sm py-1 px-3 sm:px-4 text-center ${
              theme === 'dark' ? 'text-stone-400' : theme === 'sepia' ? 'text-[#7D6E5D]' : 'text-stone-500'
            }`}>
              Belum ada deskripsi untuk seri ini.
            </p>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 3. DAFTAR BUKU DALAM SERI (Urut berdasarkan seriesOrder / orderIndex) */}
        {/* ========================================================================= */}
        <div 
          id="series-books-container"
          className={`series-profile-card rounded-2xl p-3.5 sm:p-5 border shadow-2xs transition-colors ${
            theme === 'dark'
              ? 'bg-[#1E1E1E] border-[#333333]'
              : theme === 'sepia'
              ? 'bg-[#FCF9F3] border-[#DFD5C4]'
              : 'bg-white border-stone-200/80'
          }`}
        >
          <div className={`mb-3.5 sm:mb-4 flex items-center justify-between pb-2.5 sm:pb-3 border-b transition-colors ${
            theme === 'dark' ? 'border-[#2A2A2A]' : theme === 'sepia' ? 'border-[#EAE3D5]' : 'border-stone-100'
          }`}>
            <div className="flex items-center gap-2">
              <BookMarked className={`w-4 h-4 sm:w-5 sm:h-5 ${
                theme === 'dark' ? 'text-[#C5BFB0]' : theme === 'sepia' ? 'text-[#8C6D4F]' : 'text-[#50553C]'
              }`} />
              <h2 className={`text-sm sm:text-lg font-serif font-bold ${
                theme === 'dark' ? 'text-[#F5F3EE]' : theme === 'sepia' ? 'text-[#221C16]' : 'text-stone-900'
              }`}>
                Urutan Buku dalam Seri
              </h2>
            </div>
            <span className={`text-xs font-mono ${
              theme === 'dark' ? 'text-stone-400' : theme === 'sepia' ? 'text-[#7D6E5D]' : 'text-stone-500'
            }`}>
              Total {sortedNovels.length} Buku
            </span>
          </div>

          {/* List Kartu Buku */}
          <div className="space-y-2.5 sm:space-y-3">
            {sortedNovels.map((novel, index) => {
              const chapterCount = novel.chapters?.length ?? 0;
              const displayOrder = typeof novel.seriesOrder === 'number' ? novel.seriesOrder : (index + 1);
              const novelCoverTrimmed = typeof novel.cover === 'string' ? novel.cover.trim() : '';
              const hasNovelCover = Boolean(
                novelCoverTrimmed &&
                (novelCoverTrimmed.startsWith('http://') || 
                 novelCoverTrimmed.startsWith('https://') || 
                 novelCoverTrimmed.startsWith('data:image'))
              );
              
              const customCover = novel.customCover;
              const hasCustomGradient = Boolean(customCover?.bgGradient && customCover.bgGradient.trim());

              return (
                <div
                  key={novel.id}
                  id={`series-novel-item-${novel.id}`}
                  onClick={() => onSelectNovel(novel)}
                  className={`series-book-card group relative rounded-xl p-2.5 sm:p-3.5 border transition-all shadow-2xs hover:shadow-xs cursor-pointer flex flex-row gap-2.5 sm:gap-3.5 items-stretch overflow-hidden ${
                    theme === 'dark'
                      ? 'bg-[#161616] hover:bg-[#222222] border-[#2D2D2D]'
                      : theme === 'sepia'
                      ? 'bg-[#F4EFE6] hover:bg-[#EAE3D5] border-[#DFD5C4]'
                      : 'bg-[#FAF9F5] hover:bg-[#F2EFE9] border-stone-200/70'
                  }`}
                >
                  {/* Order Badge (Nomor Urut Buku) */}
                  <div className={`series-order-badge w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-mono text-[11px] sm:text-xs font-bold shrink-0 self-center shadow-2xs ${
                    theme === 'dark'
                      ? 'bg-[#262626] text-[#E5E0D5] border border-[#383838]'
                      : theme === 'sepia'
                      ? 'bg-[#8C6D4F] text-[#FFFDF9]'
                      : 'bg-[#50553C] text-white'
                  }`}>
                    #{displayOrder}
                  </div>

                  {/* Novel Cover (Gambar atau Custom Cover Palet Gradien atau Fallback) */}
                  <div className="w-16 sm:w-20 h-22 sm:h-28 rounded-lg overflow-hidden shrink-0 relative shadow-2xs border border-stone-200/80">
                    {hasNovelCover ? (
                      <img
                        src={novelCoverTrimmed}
                        alt={novel.title}
                        referrerPolicy="no-referrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage({ url: novelCoverTrimmed, title: novel.title });
                        }}
                        className="w-full h-full object-cover block cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                        title="Klik untuk melihat cover penuh"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : hasCustomGradient ? (
                      /* Render menggunakan palet customCover.bgGradient dari Firebase */
                      <div 
                        className="w-full h-full text-white flex flex-col justify-between p-1.5 select-none text-center"
                        style={{ background: customCover?.bgGradient }}
                      >
                        <span className="text-[7.5px] sm:text-[8.5px] font-mono uppercase tracking-wider text-white/90 font-semibold">
                          Buku #{displayOrder}
                        </span>
                        <span 
                          className="text-[9px] sm:text-[10.5px] font-serif font-bold line-clamp-2 leading-tight"
                          style={{ color: customCover?.titleColor || '#FFFFFF' }}
                        >
                          {novel.title}
                        </span>
                        <BookOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3 mx-auto text-white/80" />
                      </div>
                    ) : (
                      /* Fallback Cover Estetis Kartu Buku */
                      <div className="w-full h-full bg-gradient-to-b from-[#343B2C] to-[#1F241A] text-white flex flex-col justify-between p-1.5 select-none text-center">
                        <span className="text-[7.5px] sm:text-[8.5px] font-mono uppercase tracking-wider text-white/80">
                          Buku #{displayOrder}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-serif font-bold text-white line-clamp-2 leading-tight">
                          {novel.title}
                        </span>
                        <BookOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3 mx-auto text-white/70" />
                      </div>
                    )}
                  </div>

                  {/* Detail Buku Kanan */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <h3 className={`text-xs sm:text-base font-serif font-bold leading-snug transition-colors line-clamp-2 ${
                        theme === 'dark'
                          ? 'text-[#EDE8DF] group-hover:text-[#FCD34D]'
                          : theme === 'sepia'
                          ? 'text-[#2D261E] group-hover:text-[#8C6D4F]'
                          : 'text-stone-900 group-hover:text-[#50553C]'
                      }`}>
                        {novel.title}
                      </h3>
                      {novel.synopsis && (
                        <p className={`text-[11px] sm:text-xs line-clamp-1 sm:line-clamp-2 mt-1 ${
                          theme === 'dark' ? 'text-stone-400' : theme === 'sepia' ? 'text-[#7D6E5D]' : 'text-stone-500'
                        }`}>
                          {novel.synopsis}
                        </p>
                      )}
                    </div>

                    {/* Metadata Row */}
                    <div className={`pt-1.5 sm:pt-2 border-t flex flex-wrap items-center gap-1.5 sm:gap-3 text-[11px] sm:text-xs font-medium mt-1 ${
                      theme === 'dark' ? 'border-[#282828] text-stone-400' : theme === 'sepia' ? 'border-[#DFD5C4] text-[#706050]' : 'border-stone-200/50 text-stone-500'
                    }`}>
                      {novel.author && (
                        <div className={`flex items-center gap-1 shrink-0 ${
                          theme === 'dark' ? 'text-stone-300' : theme === 'sepia' ? 'text-[#4A3E31]' : 'text-stone-600'
                        }`}>
                          <User className="w-3 h-3 opacity-60 shrink-0" />
                          <span className="truncate max-w-[95px] sm:max-w-[150px]">{novel.author}</span>
                        </div>
                      )}
                      {novel.genre && (
                        <span className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                          theme === 'dark'
                            ? 'text-stone-300 bg-[#252525]'
                            : theme === 'sepia'
                            ? 'text-[#4A3E31] bg-[#EFE9DD]'
                            : 'text-stone-700 bg-[#EDECE6]'
                        }`}>
                          <Tag className="w-2.5 h-2.5 opacity-60 shrink-0" />
                          <span className="truncate max-w-[85px]">
                            {Array.isArray(novel.genre) ? novel.genre.join(', ') : novel.genre}
                          </span>
                        </span>
                      )}
                      <span className={`flex items-center gap-1 shrink-0 ${
                        theme === 'dark' ? 'text-stone-300' : theme === 'sepia' ? 'text-[#4A3E31]' : 'text-stone-600'
                      }`}>
                        <Layers className="w-3 h-3 opacity-60 shrink-0" />
                        <span>{chapterCount} Bab</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL POP-UP PREVIEW GAMBAR (50% SCREEN SIZE, OVERLAY BACKDROP) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {previewImage && previewImage.url.trim().length > 0 && (
          <div
            id="modal-image-preview-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="relative flex flex-col items-center justify-center pointer-events-auto max-w-[80vw] sm:max-w-[50vw] max-h-[70vh] sm:max-h-[50vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewImage.url.trim()}
                alt={previewImage.title}
                referrerPolicy="no-referrer"
                className="max-w-[80vw] sm:max-w-[50vw] max-h-[65vh] sm:max-h-[48vh] w-auto h-auto object-contain rounded-2xl shadow-2xl select-none border border-white/20 cursor-pointer"
                onClick={() => setPreviewImage(null)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
