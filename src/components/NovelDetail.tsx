import React, { useEffect, useState, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Novel, Chapter, SeriesGroup } from '../types';
import { 
  subscribeToNovelChapters, 
  subscribeToNovelCharacters, 
  groupNovelsBySeries,
  formatChapterDisplayTitle,
  clearAllLocalCaches
} from '../services/novelService';
import {
  listenToNovelRating,
  toggleNovelUserRating,
  listenToReadingHistory,
  listenToNovelViews,
  RatingStats,
  ReadingHistoryItem
} from '../services/novelRatingAndHistoryService';
import {
  REACTION_CONFIGS,
  NovelReactionSummary,
  listenToNovelTotalReactions
} from '../services/reactionService';
import { useAppTheme } from '../context/ThemeContext';
import {
  Tag,
  User,
  BookOpen,
  ChevronRight,
  BookMarked,
  Eye,
  Bookmark,
  BookUser,
  Star,
  ArrowRight,
  RotateCw,
  Share2,
  Check
} from 'lucide-react';

interface NovelDetailProps {
  novel: Novel;
  onBack: () => void;
  onSelectChapter: (chapter: Chapter, allChapters: Chapter[]) => void;
  onOpenCharacters?: () => void;
  onSelectSeries?: (series: SeriesGroup) => void;
  allNovels?: Novel[];
}

export const NovelDetail: React.FC<NovelDetailProps> = ({
  novel,
  onBack,
  onSelectChapter,
  onOpenCharacters,
  onSelectSeries,
  allNovels
}) => {
  const { theme } = useAppTheme();
  const [chapters, setChapters] = useState<Chapter[]>(novel.chapters || []);
  const [loadingChapters, setLoadingChapters] = useState(novel.chapters ? false : true);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  const [isSynopsisOverflowing, setIsSynopsisOverflowing] = useState(false);
  const synopsisRef = useRef<HTMLParagraphElement>(null);
  const [characterCount, setCharacterCount] = useState<number>(novel.characters ? novel.characters.length : 0);
  const [previewCover, setPreviewCover] = useState<string | null>(null);

  // Rating state
  const [ratingStats, setRatingStats] = useState<RatingStats>({
    average: novel.rating || 0,
    totalRaters: novel.ratingCount || (novel.rating ? 1 : 0),
    userRating: null
  });
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);

  // Reading history state
  const [readingHistory, setReadingHistory] = useState<ReadingHistoryItem | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const handleShareNovel = async () => {
    const url = typeof window !== 'undefined' ? (window.location.origin + window.location.pathname) : '';
    const shareData = {
      title: `${novel.title} - Pena Indonesia`,
      text: `Baca novel "${novel.title}" karya ${novel.author || 'Pena Indonesia'} di Pena Indonesia!`,
      url
    };

    if (navigator.share && typeof navigator.canShare === 'function' && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2200);
    } catch {
      // Ignore fallback error
    }
  };

  // Check if novel belongs to a series
  const hasSeries = Boolean(novel.seriesName && novel.seriesName.trim().length > 0);

  // Handler to navigate to series profile
  const handleOpenSeries = () => {
    if (!novel.seriesName || !onSelectSeries) return;
    const seriesGroups = allNovels ? groupNovelsBySeries(allNovels) : [];
    const matched = seriesGroups.find(
      g => g.seriesName.trim().toLowerCase() === novel.seriesName!.trim().toLowerCase()
    );
    if (matched) {
      onSelectSeries(matched);
    } else {
      onSelectSeries({
        seriesName: novel.seriesName.trim(),
        seriesBanner: novel.seriesBanner,
        seriesCover: novel.seriesCover,
        seriesSynopsis: novel.seriesSynopsis,
        orderIndex: novel.seriesOrderIndex,
        novels: [novel]
      });
    }
  };

  // Measure if synopsis text overflows when collapsed
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
  }, [novel.synopsis, isSynopsisExpanded]);

  // Close cover preview on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewCover(null);
        setIsRatingModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Subscribe to chapters from Firebase
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const handleManualRefresh = () => {
    setIsManualRefreshing(true);
    clearAllLocalCaches();
    setLoadingChapters(true);
    setDetailRefreshKey((prev) => prev + 1);
    window.dispatchEvent(new CustomEvent('pena_soft_refresh'));
    setTimeout(() => {
      setIsManualRefreshing(false);
    }, 900);
  };

  useEffect(() => {
    const handleDetailSoftRefresh = () => {
      setLoadingChapters(true);
      setDetailRefreshKey((prev) => prev + 1);
    };
    window.addEventListener('pena_soft_refresh', handleDetailSoftRefresh);
    return () => {
      window.removeEventListener('pena_soft_refresh', handleDetailSoftRefresh);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeToNovelChapters(
      novel,
      (updatedChapters) => {
        setChapters(updatedChapters);
        setLoadingChapters(false);
      },
      (err) => {
        console.error("Error loading chapters:", err);
        setLoadingChapters(false);
      }
    );
    return () => {
      if (unsub) unsub();
    };
  }, [novel, detailRefreshKey]);

  // Subscribe to character gallery count
  useEffect(() => {
    const unsubChars = subscribeToNovelCharacters(
      novel,
      (updatedChars) => {
        setCharacterCount(updatedChars.length);
      },
      () => {}
    );
    return () => {
      if (unsubChars) unsubChars();
    };
  }, [novel]);

  // Subscribe to real-time novel rating & current user rating
  useEffect(() => {
    if (!novel.id) return;
    const initialFallback = novel.rating || 0;
    const unsub = listenToNovelRating(novel.id, initialFallback, (stats) => {
      setRatingStats(stats);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [novel.id, novel.rating]);

  // Subscribe to reading history
  useEffect(() => {
    if (!novel.id) return;
    const unsub = listenToReadingHistory(novel.id, (hist) => {
      setReadingHistory(hist);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [novel.id]);

  // Handler for user clicking star rating (1-5)
  // If clicked star is already user's active rating -> reset/cancel rating in Firebase
  const handleRatingClick = async (star: number) => {
    if (!novel.id) return;
    try {
      const updated = await toggleNovelUserRating(novel.id, star, novel.rating || 0);
      setRatingStats(updated);
    } catch (e) {
      console.warn('Rating tersimpan di antrean lokal:', e);
    }
  };

  // Determine target chapter for "Mulai Baca" vs "Lanjutkan Baca"
  const targetChapter = useMemo(() => {
    if (!chapters || chapters.length === 0) return null;
    if (readingHistory?.chapterId) {
      const found = chapters.find(c => c.id === readingHistory.chapterId);
      if (found) return found;
    }
    return chapters[0];
  }, [chapters, readingHistory]);

  const isContinueReading = useMemo(() => {
    if (!readingHistory?.chapterId || !chapters || chapters.length === 0) return false;
    return chapters.some(c => c.id === readingHistory.chapterId);
  }, [readingHistory, chapters]);

  // Agregasi base views dari seluruh bab novel atau dokumen novel
  const baseTotalViews = useMemo(() => {
    let sum = 0;
    let hasChapterViews = false;
    for (const ch of chapters) {
      if (typeof ch.views === 'number' && ch.views > 0) {
        sum += ch.views;
        hasChapterViews = true;
      }
    }
    if (hasChapterViews) return sum;

    if (typeof novel.views === 'number' && novel.views > 0) return novel.views;
    if (typeof (novel as any).viewCount === 'number' && (novel as any).viewCount > 0) return (novel as any).viewCount;
    if (typeof (novel as any).dibaca === 'number' && (novel as any).dibaca > 0) return (novel as any).dibaca;
    if (typeof (novel as any).totalViews === 'number' && (novel as any).totalViews > 0) return (novel as any).totalViews;

    return 0;
  }, [chapters, novel]);

  const [liveViews, setLiveViews] = useState<number>(baseTotalViews);

  // Real-time aggregate reactions untuk novel dari semua bab
  const [novelReactions, setNovelReactions] = useState<NovelReactionSummary>({
    fire: 0,
    love: 0,
    sad: 0,
    shock: 0,
    clap: 0,
    total: 0,
    topReaction: null
  });
  const [isReactionsModalOpen, setIsReactionsModalOpen] = useState(false);

  // Subscribe ke real-time view updates dari Firebase
  useEffect(() => {
    if (!novel.id) return;
    const unsub = listenToNovelViews(novel.id, baseTotalViews, (updatedViews) => {
      setLiveViews(updatedViews);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [novel.id, baseTotalViews]);

  // Subscribe ke total reaksi novel dari seluruh bab secara real-time
  useEffect(() => {
    if (!novel.id) return;
    const chapterIds = chapters.map((c) => c.id);
    const unsub = listenToNovelTotalReactions(
      novel.id,
      (summary) => {
        setNovelReactions(summary);
      },
      chapterIds
    );
    return () => {
      if (unsub) unsub();
    };
  }, [novel.id, chapters]);

  // Helper format angka tampilan (misal: 12400 -> 12,4 rb)
  const formatNumber = (num: number): string => {
    if (!num || isNaN(num) || num <= 0) return '0';
    if (num >= 1_000_000) {
      const val = (num / 1_000_000).toFixed(1).replace('.', ',');
      return val.endsWith(',0') ? `${val.slice(0, -2)} jt` : `${val} jt`;
    }
    if (num >= 1_000) {
      const val = (num / 1_000).toFixed(1).replace('.', ',');
      return val.endsWith(',0') ? `${val.slice(0, -2)} rb` : `${val} rb`;
    }
    return num.toLocaleString('id-ID');
  };

  // Format updated date from Firebase timestamp
  const getFormattedDate = () => {
    if (!novel.updatedAt && !novel.createdAt) return null;
    const rawDate = novel.updatedAt || novel.createdAt;
    try {
      const d = (rawDate as any)?.toDate ? (rawDate as any).toDate() : new Date(rawDate as string | number);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return null;
    }
  };

  const formattedDate = getFormattedDate();

  // Action click handler for "Mulai Baca" / "Lanjutkan Baca"
  const handleMainActionClick = () => {
    if (!targetChapter) return;
    onSelectChapter(targetChapter, chapters);
  };

  return (
    <div className="max-w-4xl mx-auto px-2 xs:px-3 sm:px-6 pt-2 sm:pt-3 pb-8 sm:pb-12">
      {/* ========================================================================= */}
      {/* KARTU PROFIL NOVEL - LEBAR KESAMPING (LANDSCAPE) PERSIS SESUAI FOTO */}
      {/* ========================================================================= */}
      <div className={`rounded-2xl xs:rounded-3xl p-3 xs:p-4 sm:p-6 md:p-7 border shadow-xs mb-3.5 sm:mb-5 transition-colors ${
        theme === 'dark'
          ? 'bg-[#1C1C1C] border-[#2E2E2E] text-[#EDE8DF]'
          : theme === 'sepia'
          ? 'bg-[#FAF4E8] border-[#D6C4A5] text-[#2E2114]'
          : 'bg-white border-stone-200/80 text-stone-900'
      }`}>
        <div className="flex flex-row gap-2.5 xs:gap-3.5 sm:gap-6 md:gap-7 items-stretch">
          {/* SISI KIRI: COVER BUKU REALISTIS (PROPORSIONAL LEBAR KESAMPING) */}
          <div className="w-[84px] xs:w-24 sm:w-36 md:w-44 lg:w-48 aspect-2/3 rounded-xl sm:rounded-2xl overflow-hidden bg-[#EBEBE6] dark:bg-[#252525] border border-stone-200/90 dark:border-stone-700 shrink-0 relative shadow-sm sm:shadow-md self-stretch">
            {novel.cover && novel.cover.trim().length > 0 ? (
              <>
                <img
                  src={novel.cover.trim()}
                  alt={novel.title}
                  referrerPolicy="no-referrer"
                  onClick={() => setPreviewCover(novel.cover!.trim())}
                  className="w-full h-full object-cover cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all"
                  title="Klik untuk melihat cover penuh"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
                {/* Efek lekukan punggung buku (spine) seperti buku fisik */}
                <div className="absolute inset-y-0 left-0 w-2.5 sm:w-3.5 bg-gradient-to-r from-black/35 via-black/10 to-transparent pointer-events-none" />
              </>
            ) : (
              <div className="w-full h-full p-2 sm:p-3 flex flex-col items-center justify-center text-center bg-[#FAF9F5] dark:bg-[#222222]">
                <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#50553C] text-white flex items-center justify-center mb-1 sm:mb-2">
                  <BookMarked className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <span className="text-[9px] sm:text-xs font-serif font-bold text-stone-700 dark:text-stone-300 line-clamp-3 leading-tight">
                  {novel.title}
                </span>
              </div>
            )}
          </div>

          {/* SISI KANAN: DETAIL PROFIL NOVEL (LEBAR KESAMPING, RAMPING, TIDAK PANJANG KE BAWAH) */}
          <div className="flex-1 min-w-0 flex flex-col self-stretch">
            {/* 1. Judul Buku: Rata dengan cover bagian atas */}
            <div className="min-w-0">
              <h1 className={`text-sm xs:text-base sm:text-2xl md:text-3xl lg:text-[32px] font-serif font-bold tracking-tight leading-tight xs:leading-snug mt-0 pt-0 line-clamp-3 ${
                theme === 'dark' ? 'text-[#F5F3EE]' : theme === 'sepia' ? 'text-[#3B2C1C]' : 'text-stone-900'
              }`}>
                {novel.title}
              </h1>
            </div>

            {/* REGANGAN DI BAWAH JUDUL: Memberi ruang lega vertikal yang otomatis menyerap ruang jika judul panjang */}
            <div className="flex-1 min-h-[8px] xs:min-h-[12px] sm:min-h-[18px]" />

            {/* 2. Informasi Penulis, Genre, Bab, Rating, dan Tombol Baca tersusun padat & rapi di bagian bawah */}
            <div className="min-w-0 flex flex-col gap-1.5 xs:gap-2 sm:gap-2.5">
              {/* Baris Penulis, Genre (Pill), dan Jumlah Bab */}
              <div className={`flex items-center gap-2 xs:gap-2.5 sm:gap-3.5 text-[10px] xs:text-[11px] sm:text-sm overflow-hidden whitespace-nowrap ${
                theme === 'dark' ? 'text-stone-300' : theme === 'sepia' ? 'text-[#57432E]' : 'text-stone-800'
              }`}>
                {/* Penulis */}
                <div className="flex items-center gap-1 shrink-0 font-medium">
                  <User className="w-3 h-3 sm:w-4 sm:h-4 text-stone-500 shrink-0" />
                  <span className="truncate max-w-[65px] xs:max-w-[90px] sm:max-w-[180px]">
                    {novel.author || 'Pena Indonesia'}
                  </span>
                </div>

                {/* Genre Badge */}
                {novel.genre && (
                  <div className={`inline-flex items-center gap-1 px-2 xs:px-2.5 sm:px-3 py-0.5 rounded-full text-[9.5px] xs:text-[10.5px] sm:text-sm font-medium shrink-0 border transition-colors ${
                    theme === 'dark'
                      ? 'bg-[#2A2A2A] text-[#DDD8CE] border-stone-700/60'
                      : theme === 'sepia'
                      ? 'bg-[#EAE4D5] text-[#2D261E] border-[#DFD5C4]'
                      : 'bg-stone-100 text-stone-800 border-stone-200 shadow-2xs'
                  }`}>
                    <Tag className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 shrink-0 ${
                      theme === 'dark' ? 'text-stone-400' : theme === 'sepia' ? 'text-[#826E57]' : 'text-stone-600'
                    }`} />
                    <span className="truncate max-w-[55px] xs:max-w-[80px] sm:max-w-[140px]">
                      {Array.isArray(novel.genre) ? novel.genre.join(', ') : novel.genre}
                    </span>
                  </div>
                )}

                {/* Jumlah Bab (Di Baris Ini Sesuai Foto) */}
                <div className="flex items-center gap-1 shrink-0 font-medium">
                  <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-stone-500 shrink-0" />
                  <span>{chapters.length} Bab</span>
                </div>
              </div>

              {/* Baris Rating & Total View & Reaksi Terbanyak (Bersih tanpa garis) */}
              <div className={`flex items-center gap-2.5 xs:gap-3.5 sm:gap-4 ${
                theme === 'dark' ? 'text-stone-300' : theme === 'sepia' ? 'text-[#57432E]' : 'text-stone-800'
              }`}>
                {/* Rating Bintang Emas */}
                <button
                  type="button"
                  onClick={() => setIsRatingModalOpen(true)}
                  className="flex items-center gap-1 xs:gap-1.5 group cursor-pointer hover:opacity-80 transition-opacity outline-none"
                  title="Klik untuk memberi rating novel"
                >
                  <Star className="w-3.5 h-3.5 sm:w-5 sm:h-5 fill-amber-400 text-amber-500 shrink-0" />
                  <span className={`font-serif font-bold text-xs xs:text-sm sm:text-base ${
                    theme === 'dark' ? 'text-amber-400' : theme === 'sepia' ? 'text-[#3B2C1C]' : 'text-stone-900'
                  }`}>
                    {ratingStats.average > 0 ? ratingStats.average.toFixed(1) : '0.0'}
                  </span>
                </button>

                {/* Total View (Hanya icon dan angka view tanpa teks View) */}
                <div className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-stone-500 shrink-0" />
                  <span className="text-[10px] xs:text-xs sm:text-sm font-medium">
                    {formatNumber(liveViews)}
                  </span>
                </div>

                {/* Reaksi Novel (Kumpulan Reaksi dari Seluruh Bab) */}
                <div className="inline-flex items-center">
                  <button
                    id="btn-novel-top-reaction"
                    type="button"
                    onClick={() => setIsReactionsModalOpen(true)}
                    className="flex items-center gap-1 group cursor-pointer hover:opacity-80 active:scale-95 transition-all outline-none"
                    title={
                      novelReactions.topReaction
                        ? `Total Reaksi Seluruh Bab: ${formatNumber(novelReactions.total)} (${novelReactions.topReaction.label} terbanyak). Ketuk untuk melihat rincian.`
                        : 'Total Reaksi dari seluruh bab. Ketuk untuk melihat rincian.'
                    }
                  >
                    <span className="text-sm xs:text-base sm:text-lg leading-none select-none">
                      {novelReactions.topReaction ? novelReactions.topReaction.emoji : '🔥'}
                    </span>
                    <span className="text-[10px] xs:text-xs sm:text-sm font-medium">
                      {formatNumber(novelReactions.total)}
                    </span>
                  </button>
                </div>
              </div>

              {/* Tombol Aksi Utama: "Lanjutkan Baca" / "Mulai Baca" */}
              <div className="mt-0.5 xs:mt-1 sm:mt-1.5">
                <button
                  id="btn-novel-main-action"
                  type="button"
                  onClick={handleMainActionClick}
                  disabled={loadingChapters || chapters.length === 0}
                  className={`w-full text-white rounded-full py-1.5 xs:py-2 sm:py-3 px-3 xs:px-4 sm:px-6 flex items-center justify-between shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed outline-none select-none group ${
                    theme === 'dark'
                      ? 'bg-[#4A5D32] hover:bg-[#3E4D2B]'
                      : theme === 'sepia'
                      ? 'bg-[#6E502B] hover:bg-[#5D4323]'
                      : 'bg-[#414E2E] hover:bg-[#364125]'
                  }`}
                >
                  <div className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2.5 pl-2 sm:pl-4">
                    <BookOpen className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white shrink-0" />
                    <span className="font-semibold text-[11px] xs:text-xs sm:text-base text-white tracking-wide">
                      {isContinueReading ? 'Lanjutkan Baca' : 'Mulai Baca'}
                    </span>
                  </div>
                  <ArrowRight className="w-3 h-3 sm:w-5 sm:h-5 text-white shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SINOPSIS NOVEL - KARTU TERPISAH DI BAWAH DETAIL NOVEL */}
      {/* ========================================================================= */}
      <div className={`rounded-3xl p-4 sm:p-6 border shadow-xs mb-3.5 sm:mb-5 transition-colors ${
        theme === 'dark'
          ? 'bg-[#1C1C1C] border-[#2E2E2E]'
          : theme === 'sepia'
          ? 'bg-[#FAF4E8] border-[#D6C4A5]'
          : 'bg-white border-stone-200/80'
      }`}>
        <div className="flex items-center justify-between mb-2.5 px-1 sm:px-2">
          <span className={`text-[10.5px] sm:text-[11.5px] font-bold uppercase tracking-wider font-mono ${
            theme === 'dark' ? 'text-amber-400/90' : theme === 'sepia' ? 'text-[#826E57]' : 'text-stone-500'
          }`}>
            SINOPSIS
          </span>
          {formattedDate && (
            <span className={`text-[10px] sm:text-xs ${
              theme === 'dark' ? 'text-stone-500' : theme === 'sepia' ? 'text-[#9A8771]' : 'text-stone-400'
            }`}>
              Diperbarui {formattedDate}
            </span>
          )}
        </div>
        <div
          onClick={() => {
            if (isSynopsisOverflowing || isSynopsisExpanded) {
              setIsSynopsisExpanded(!isSynopsisExpanded);
            }
          }}
          className={`relative group select-none transition-all px-1 sm:px-2 ${
            isSynopsisOverflowing || isSynopsisExpanded
              ? 'cursor-pointer active:opacity-85'
              : 'cursor-default'
          }`}
          title={
            (isSynopsisOverflowing || isSynopsisExpanded)
              ? (isSynopsisExpanded ? 'Klik untuk menutup sinopsis' : 'Klik untuk membaca sinopsis selengkapnya')
              : undefined
          }
        >
          <p
            ref={synopsisRef}
            className={`synopsis-paragraph font-sans whitespace-pre-line transition-all text-xs sm:text-sm leading-relaxed ${
              theme === 'dark' ? 'text-[#D6D1C7]' : theme === 'sepia' ? 'text-[#3B2C1C]' : 'text-stone-800'
            } ${!isSynopsisExpanded ? 'line-clamp-3 sm:line-clamp-4' : ''}`}
          >
            {novel.synopsis || "Belum ada sinopsis untuk novel ini."}
          </p>

          {/* Visual hint indicator when clamped/overflowing */}
          {!isSynopsisExpanded && isSynopsisOverflowing && (
            <div className="synopsis-fade absolute inset-x-0 bottom-0 h-7 pointer-events-none rounded-b-sm flex items-end justify-center">
              <span className="text-[10px] text-stone-400 font-mono tracking-widest leading-none pb-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                •••
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Fitur Seri Buku: Tampil tepat di atas Galeri Karakter saat buku masuk ke sebuah seri */}
      {hasSeries && (
        <div className="mb-2 sm:mb-2.5">
          <button
            id="btn-open-series-detail"
            type="button"
            onClick={handleOpenSeries}
            className={`w-full rounded-xl sm:rounded-2xl py-2 px-3 sm:py-2.5 sm:px-3.5 flex items-center justify-between transition-all shadow-2xs group cursor-pointer outline-none text-left border ${
              theme === 'dark'
                ? 'bg-[#1C1C1C] hover:bg-[#252525] border-[#2E2E2E]'
                : theme === 'sepia'
                ? 'bg-[#FAF4E8] hover:bg-[#EFE6D4] border-[#D6C4A5]'
                : 'bg-white hover:bg-[#F9F9F4] border-stone-200/90'
            }`}
            title={`Buka profil seri ${novel.seriesName}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                theme === 'dark'
                  ? 'bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-black'
                  : theme === 'sepia'
                  ? 'bg-[#6E502B]/15 text-[#6E502B] group-hover:bg-[#6E502B] group-hover:text-white'
                  : 'bg-[#50553C]/10 text-[#50553C] group-hover:bg-[#50553C] group-hover:text-white'
              }`}>
                <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className={`text-xs sm:text-sm font-serif font-bold transition-colors truncate ${
                theme === 'dark' ? 'text-[#EDE8DF]' : theme === 'sepia' ? 'text-[#2E2114]' : 'text-stone-900'
              }`}>
                {novel.seriesName}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-stone-400 shrink-0 ml-2">
              <span className="hidden sm:inline">Lihat Seri</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>
      )}

      {/* Button: Galeri Karakter Buku */}
      {onOpenCharacters && (
        <div className="mb-2.5 sm:mb-3.5">
          <button
            id="btn-open-character-gallery"
            type="button"
            onClick={onOpenCharacters}
            className={`w-full rounded-xl sm:rounded-2xl py-2 px-3 sm:py-2.5 sm:px-3.5 flex items-center justify-between transition-all shadow-2xs group cursor-pointer outline-none border ${
              theme === 'dark'
                ? 'bg-[#1C1C1C] hover:bg-[#252525] border-[#2E2E2E]'
                : theme === 'sepia'
                ? 'bg-[#FAF4E8] hover:bg-[#EFE6D4] border-[#D6C4A5]'
                : 'bg-white hover:bg-[#F9F9F4] border-stone-200/90'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                theme === 'dark'
                  ? 'bg-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-black'
                  : theme === 'sepia'
                  ? 'bg-[#6E502B]/15 text-[#6E502B] group-hover:bg-[#6E502B] group-hover:text-white'
                  : 'bg-[#50553C]/10 text-[#50553C] group-hover:bg-[#50553C] group-hover:text-white'
              }`}>
                <BookUser className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs sm:text-sm font-serif font-bold transition-colors truncate ${
                  theme === 'dark' ? 'text-[#EDE8DF]' : theme === 'sepia' ? 'text-[#2E2114]' : 'text-stone-900'
                }`}>
                  Galeri Karakter
                </span>
                {characterCount > 0 && (
                  <span className={`text-[9.5px] sm:text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold shrink-0 ${
                    theme === 'dark'
                      ? 'bg-stone-800 text-stone-300'
                      : theme === 'sepia'
                      ? 'bg-[#EFE6D4] text-[#6E502B]'
                      : 'bg-[#EDECE6] text-[#50553C]'
                  }`}>
                    {characterCount} Karakter
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-stone-400 shrink-0 ml-2">
              <span className="hidden sm:inline">Lihat</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DAFTAR BAB CARD */}
      {/* ========================================================================= */}
      <div className={`rounded-2xl p-3.5 sm:p-5 border shadow-xs transition-colors ${
        theme === 'dark'
          ? 'bg-[#1C1C1C] border-[#2E2E2E]'
          : theme === 'sepia'
          ? 'bg-[#FAF4E8] border-[#D6C4A5]'
          : 'bg-white border-stone-200/80'
      }`}>
        {/* Header */}
        <div className="mb-3 sm:mb-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className={`text-base sm:text-xl font-serif font-bold ${
              theme === 'dark' ? 'text-[#F5F3EE]' : theme === 'sepia' ? 'text-[#3B2C1C]' : 'text-stone-900'
            }`}>
              Daftar Bab
            </h2>
            <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium ${
              theme === 'dark'
                ? 'bg-[#282828] text-stone-300'
                : theme === 'sepia'
                ? 'bg-[#EFE6D4] text-[#3B2C1C]'
                : 'bg-[#EDECE6] text-stone-700'
            }`}>
              {chapters.length} Bab
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Tombol Bagikan Novel Web */}
            <button
              id="btn-share-novel"
              type="button"
              onClick={handleShareNovel}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer active:scale-95 border ${
                copiedShare
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : theme === 'dark'
                  ? 'bg-[#242424] hover:bg-[#2C2C2C] text-stone-300 border-[#333333]'
                  : theme === 'sepia'
                  ? 'bg-[#EFE6D4] hover:bg-[#E8DEC8] text-[#4A3B2C] border-[#DFD3B8]'
                  : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700 border-stone-200'
              }`}
              title="Bagikan tautan novel ini ke teman"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span className="hidden sm:inline">Disalin!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Bagikan</span>
                </>
              )}
            </button>

            {/* Tombol Segarkan / Refresh Bab Langsung dari Firebase */}
            <button
              id="btn-refresh-chapters"
              onClick={handleManualRefresh}
              disabled={isManualRefreshing || loadingChapters}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer active:scale-95 border shrink-0 ${
                theme === 'dark'
                  ? 'bg-[#242424] hover:bg-[#2C2C2C] text-stone-300 border-[#333333]'
                  : theme === 'sepia'
                  ? 'bg-[#EFE6D4] hover:bg-[#E8DEC8] text-[#4A3B2C] border-[#DFD3B8]'
                  : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700 border-stone-200'
              }`}
              title="Segarkan daftar bab terbaru langsung dari server Firebase"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isManualRefreshing || loadingChapters ? 'animate-spin text-[#50553C]' : ''}`} />
              <span className="hidden sm:inline">{isManualRefreshing || loadingChapters ? 'Menyinkronkan...' : 'Segarkan'}</span>
            </button>
          </div>
        </div>

        {/* Chapters list */}
        {loadingChapters ? (
          <div className="space-y-2 py-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`rounded-xl border p-2.5 sm:p-3.5 flex items-center justify-between ${
                  theme === 'dark'
                    ? 'bg-[#242424] border-[#333333]'
                    : theme === 'sepia'
                    ? 'bg-[#EFE6D4] border-[#DFD3B8]'
                    : 'bg-[#F7F7F2] border-stone-200/70'
                }`}
              >
                <div className={`h-4 w-3/5 rounded animate-pulse ${
                  theme === 'dark' ? 'bg-stone-700' : theme === 'sepia' ? 'bg-[#D9CEBC]' : 'bg-stone-300/70'
                }`} />
                <div className={`h-6 w-16 rounded-lg animate-pulse ${
                  theme === 'dark' ? 'bg-stone-800' : theme === 'sepia' ? 'bg-[#DFD5C4]/70' : 'bg-stone-200'
                }`} />
              </div>
            ))}
          </div>
        ) : chapters.length === 0 ? (
          <div className={`p-5 sm:p-6 rounded-xl border text-center ${
            theme === 'dark'
              ? 'bg-[#222222] border-[#333333]'
              : theme === 'sepia'
              ? 'bg-[#EFE6D4] border-[#D6C4A5]'
              : 'bg-[#FAF9F5] border-stone-200/60'
          }`}>
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-stone-400 mx-auto mb-2" />
            <p className={`text-xs sm:text-sm ${
              theme === 'dark' ? 'text-stone-400' : theme === 'sepia' ? 'text-[#826E57]' : 'text-stone-600'
            }`}>
              Belum ada bab yang diunggah untuk novel ini.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {chapters.map((chapter, idx) => {
              const displayTitle = formatChapterDisplayTitle(chapter, idx);

              return (
                <div
                  key={chapter.id || idx}
                  id={`chapter-item-${chapter.id || idx}`}
                  onClick={() => onSelectChapter(chapter, chapters)}
                  className={`group rounded-xl p-2.5 sm:p-3.5 flex items-center justify-between cursor-pointer transition-all shadow-2xs border ${
                    theme === 'dark'
                      ? 'bg-[#242424] hover:bg-[#2C2C2C] border-[#333333] hover:border-stone-600'
                      : theme === 'sepia'
                      ? 'bg-[#EFE6D4] hover:bg-[#E8DEC8] border-[#DFD3B8] hover:border-[#C5B090]'
                      : 'bg-[#F7F7F2] hover:bg-[#EFEFEA] border-stone-200/70 hover:border-stone-300'
                  }`}
                >
                  {/* Chapter Title (Sangat Luas + Ellipsis ... jika kepanjangan) */}
                  <div className="min-w-0 flex-1 pr-3 overflow-hidden">
                    <h3 
                      className={`text-xs sm:text-base font-serif font-semibold transition-colors truncate ${
                        theme === 'dark' ? 'text-[#EDE8DF]' : theme === 'sepia' ? 'text-[#2E2114]' : 'text-stone-900'
                      }`}
                      title={displayTitle}
                    >
                      {displayTitle}
                    </h3>
                  </div>

                  {/* Tombol Akses Bab */}
                  <div className="shrink-0 flex items-center pl-2">
                    <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
                      theme === 'dark' ? 'text-stone-500' : theme === 'sepia' ? 'text-[#9C8A74]' : 'text-stone-400'
                    }`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL POP-UP PREVIEW COVER BUKU */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {previewCover && previewCover.trim().length > 0 && (
          <div
            id="modal-novel-cover-preview-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewCover(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="relative flex flex-col items-center justify-center pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewCover.trim()}
                alt={novel.title || "Cover Buku"}
                referrerPolicy="no-referrer"
                className="max-w-[50vw] max-h-[50vh] w-auto h-auto object-contain rounded-2xl shadow-2xl select-none"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* POPUP RATING SEDERHANA: 5 BINTANG TANPA TEKS (TEKAN DILUAR UNTUK MENYIMPAN) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isRatingModalOpen && (
          <div
            id="modal-rating-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
            onClick={() => setIsRatingModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className={`rounded-2xl py-3 px-4 sm:py-3.5 sm:px-6 shadow-xl border flex items-center justify-center transition-colors ${
                theme === 'dark'
                  ? 'bg-[#1E1E1E] border-[#333333]'
                  : theme === 'sepia'
                  ? 'bg-[#FAF4E8] border-[#D6C4A5]'
                  : 'bg-white border-stone-200/90'
              }`}
            >
              {/* 5 Bintang Sederhana Tanpa Teks */}
              <div
                className="flex items-center gap-1.5 sm:gap-2.5"
                onMouseLeave={() => setHoverStar(null)}
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const isActive = (hoverStar || ratingStats.userRating || 0) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      disabled={isSubmittingRating}
                      onMouseEnter={() => setHoverStar(star)}
                      onClick={() => handleRatingClick(star)}
                      className="p-1 sm:p-1.5 rounded-lg hover:scale-120 active:scale-95 transition-transform cursor-pointer outline-none"
                      aria-label={`Rating ${star} bintang`}
                    >
                      <Star
                        className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                          isActive
                            ? 'fill-amber-400 text-amber-500'
                            : theme === 'dark'
                            ? 'text-stone-600 fill-stone-800/80 hover:text-amber-300'
                            : theme === 'sepia'
                            ? 'text-[#C5B8A5] fill-[#EFE6D4] hover:text-amber-400'
                            : 'text-stone-300 fill-stone-100 hover:text-amber-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL / POPUP RINGKAS REAKSI PEMBACA */}
        {isReactionsModalOpen && (
          <div
            id="modal-novel-reactions-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs"
            onClick={() => setIsReactionsModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#1E1E1E] sepia:bg-[#F7F2E8] rounded-2xl p-2 sm:p-2.5 shadow-xl border border-stone-200/90 dark:border-stone-700/80 sepia:border-[#DFD5C4]"
            >
              {/* 5 Reaksi: Hanya Emoji dan Jumlah Reaksi (Kecil, Ringkas & Rapi) */}
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {REACTION_CONFIGS.map((cfg) => {
                  const count = novelReactions[cfg.type] || 0;

                  return (
                    <div
                      key={cfg.type}
                      className="flex flex-col items-center justify-center py-2 px-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 min-w-[42px]"
                    >
                      <span className="text-xl leading-none mb-1 select-none">
                        {cfg.emoji}
                      </span>
                      <span className="font-mono text-xs font-bold text-stone-700 dark:text-stone-300 leading-tight">
                        {formatNumber(count)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
