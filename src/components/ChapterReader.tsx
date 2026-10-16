import React, { useEffect, useState, useMemo } from 'react';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkBreaks from 'remark-breaks';
import { Chapter } from '../types';
import { 
  BookOpen, 
  Menu,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X
} from 'lucide-react';
import { ChapterReactions } from './ChapterReactions';
import { saveReadingHistory, recordNovelAndChapterView } from '../services/novelRatingAndHistoryService';
import { fetchSingleChapterContent } from '../services/novelService';
import { useAppTheme } from '../context/ThemeContext';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface ChapterReaderProps {
  chapter: Chapter;
  chapters: Chapter[];
  onSelectChapter: (chapter: Chapter) => void;
  isDrawerOpen?: boolean;
  onCloseDrawer?: () => void;
  onOpenDrawer?: () => void;
  novelId?: string;
}

// Transform URL Markdown agar mengizinkan data:image/ (Base64) dan blob: selain http/https
const customUrlTransform = (url: string) => {
  if (url.startsWith('data:image/') || url.startsWith('blob:')) {
    return url;
  }
  return defaultUrlTransform(url);
};

export const ChapterReader: React.FC<ChapterReaderProps> = ({
  chapter,
  chapters,
  onSelectChapter,
  isDrawerOpen = false,
  onCloseDrawer = () => {},
  onOpenDrawer,
  novelId
}) => {
  const { theme } = useAppTheme();

  // Laci samping lokal agar responsif baik dibuka dari header maupun tombol bawah
  const [localDrawerOpen, setLocalDrawerOpen] = useState(false);
  const isDrawerActive = isDrawerOpen || localDrawerOpen;

  // Dynamic fallback single chapter content loader
  const [fetchedContent, setFetchedContent] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string>(chapter.title);
  const [isFetchingContent, setIsFetchingContent] = useState<boolean>(false);

  // Sync state when chapter changes or when chapters array updates
  useEffect(() => {
    const matched = chapters.find((c) => c.id === chapter.id);
    const target = matched || chapter;
    setActiveTitle(target.title || chapter.title);
  }, [chapter.id, chapter.title, chapters]);

  // Real-time Firestore listener for active chapter document or parent book to reflect title changes instantly
  useEffect(() => {
    if (!db || !chapter.id) return;
    let unsubChapterDoc: (() => void) | undefined;
    let unsubParentBook: (() => void) | undefined;

    try {
      // 1. Listen to subcollection books/{novelId}/chapters/{chapterId}
      if (novelId && !chapter.id.startsWith('ch-')) {
        const chDocRef = doc(db, 'books', novelId, 'chapters', chapter.id);
        unsubChapterDoc = onSnapshot(chDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data?.title) {
              setActiveTitle(data.title);
            }
          }
        }, () => {});
      }

      // 2. Listen to parent book doc books/{novelId} chapters array
      if (novelId) {
        const bookDocRef = doc(db, 'books', novelId);
        unsubParentBook = onSnapshot(bookDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const b = data.bab || data.babs || data.chapters || data.daftarBab;
            if (Array.isArray(b)) {
              const matched = b.find((item: any) => item?.id === chapter.id || item?.pengenal === chapter.id);
              if (matched?.title) {
                setActiveTitle(matched.title);
              }
            }
          }
        }, () => {});
      }
    } catch {}

    return () => {
      if (unsubChapterDoc) unsubChapterDoc();
      if (unsubParentBook) unsubParentBook();
    };
  }, [novelId, chapter.id]);

  // Auto-fetch chapter text from Firebase if content is missing or empty
  useEffect(() => {
    setFetchedContent(null);
    const hasInitialContent = Boolean(chapter.content && chapter.content.trim().length > 0);

    if (!hasInitialContent && novelId && (chapter.id || chapter.chapterNumber)) {
      setIsFetchingContent(true);
      fetchSingleChapterContent(novelId, chapter.id, chapter.chapterNumber || chapter.order)
        .then((res) => {
          if (res) {
            const contentStr = typeof res === 'string' ? res : res.content;
            const titleStr = typeof res === 'object' ? res.title : undefined;
            if (contentStr && contentStr.trim()) {
              setFetchedContent(contentStr);
            }
            if (titleStr && titleStr.trim() && (!chapter.title || /^bab\s+\d+$/i.test(chapter.title))) {
              setActiveTitle(titleStr.trim());
            }
          }
        })
        .finally(() => {
          setIsFetchingContent(false);
        });
    }
  }, [chapter.id, chapter.content, chapter.chapterNumber, chapter.order, chapter.title, novelId]);

  // Reset scroll saat berpindah bab
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [chapter.id]);

  const handleOpenDrawer = () => {
    if (onOpenDrawer) {
      onOpenDrawer();
    }
    setLocalDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setLocalDrawerOpen(false);
    onCloseDrawer();
  };

  // Indeks bab aktif untuk navigasi Sebelumnya & Berikutnya
  const currentIndex = useMemo(() => {
    return chapters.findIndex((c) => c.id === chapter.id);
  }, [chapters, chapter.id]);

  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  // Effective content with fallback
  const rawChapterContent = useMemo(() => {
    if (chapter.content && chapter.content.trim().length > 0) {
      return chapter.content;
    }
    if (fetchedContent && fetchedContent.trim().length > 0) {
      return fetchedContent;
    }
    return '';
  }, [chapter.content, fetchedContent]);

  // Olah teks naskah sebelum dirender (Membersihkan gambar rusak & mendukung format center)
  const processedContent = useMemo(() => {
    if (!rawChapterContent) return '';
    let text = rawChapterContent;

    // 1. Bersihkan semua tag gambar yang tautannya kosong atau hanya tanda petik
    text = text.replace(/!\[.*?\]\(\s*(?:""|'')?\s*\)/g, '');

    // 2. Ubah [center]...[/center] menjadi <center>...</center>
    text = text.replace(/\[center\]([\s\S]*?)\[\/center\]/gi, (_match, inner) => {
      return `<center>${inner.trim()}</center>`;
    });

    // 3. Ubah format baris -> ... <- menjadi <center>...</center>
    text = text.replace(/(?:^|\n)->\s*(.+?)\s*<-(?=\n|$)/g, (_match, inner) => {
      return `\n<center>${inner.trim()}</center>\n`;
    });
    text = text.replace(/->\s*([^\n\r]+?)\s*<-/g, (_match, inner) => {
      return `<center>${inner.trim()}</center>`;
    });

    return text;
  }, [rawChapterContent]);

  // Simpan riwayat membaca ke Firestore & localStorage secara otomatis saat bab dibuka
  useEffect(() => {
    if (novelId && chapter?.id) {
      saveReadingHistory(
        novelId, 
        chapter.id, 
        chapter.title, 
        chapter.chapterNumber || chapter.order
      );
      recordNovelAndChapterView(novelId, chapter.id);
    }
  }, [novelId, chapter.id, chapter.title, chapter.chapterNumber, chapter.order]);

  // Komponen kustom perender Markdown untuk naskah novel yang menyesuaikan tema secara sempurna
  const markdownComponents = useMemo(() => ({
    h1: ({ ...props }) => (
      <h1 className="text-xl sm:text-2xl font-serif font-bold text-center mt-6 mb-4 tracking-tight leading-snug" {...props} />
    ),
    h2: ({ ...props }) => (
      <h2 className="text-lg sm:text-xl font-serif font-bold text-center mt-5 mb-3 tracking-tight leading-snug" {...props} />
    ),
    h3: ({ ...props }) => (
      <h3 className="text-base sm:text-lg font-serif font-bold mt-4 mb-2 tracking-tight leading-snug" {...props} />
    ),
    p: ({ ...props }) => {
      return (
        <p className="my-4 sm:my-5 indent-6 sm:indent-8 leading-[1.9] sm:leading-[2.1] text-[15px] sm:text-[17px] text-justify tracking-normal select-none" {...props} />
      );
    },
    blockquote: ({ ...props }) => (
      <blockquote 
        className={`border-l-4 my-5 sm:my-6 pl-4 sm:pl-5 py-1 italic font-serif transition-colors ${
          theme === 'dark' 
            ? 'border-amber-500/50 text-[#C4BDB0] bg-black/25' 
            : theme === 'sepia' 
            ? 'border-[#B8976C] text-[#543F29] bg-[#EBE0C9]/40' 
            : 'border-stone-400 text-stone-600 bg-stone-100/50'
        }`} 
        {...props} 
      />
    ),
    img: ({ src, alt }: { src?: string; alt?: string }) => {
      if (!src || src.trim() === '' || src === '""' || src === "''") {
        return null;
      }
      return (
        <span className="block my-6 sm:my-8 text-center">
          <img
            src={src}
            alt={alt || 'Ilustrasi cerita'}
            loading="lazy"
            decoding="async"
            className="max-w-full sm:max-w-lg mx-auto rounded-lg shadow-md border border-stone-200/50 dark:border-stone-800 object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          {alt && alt !== 'image' && alt.trim() !== '' && (
            <span className={`block text-xs mt-2 italic font-serif ${
              theme === 'dark' ? 'text-stone-400' : theme === 'sepia' ? 'text-[#826E57]' : 'text-stone-500'
            }`}>
              {alt}
            </span>
          )}
        </span>
      );
    },
    hr: () => (
      <div className="flex items-center justify-center my-8 select-none" aria-hidden="true">
        <span className={`tracking-[0.6em] text-xs font-serif ${
          theme === 'dark' ? 'text-amber-500/60' : theme === 'sepia' ? 'text-[#9E7B4F]' : 'text-stone-400'
        }`}>
          * * *
        </span>
      </div>
    ),
    ul: ({ ...props }) => <ul className="list-disc list-inside my-4 pl-4 space-y-1.5 leading-relaxed" {...props} />,
    ol: ({ ...props }) => <ol className="list-decimal list-inside my-4 pl-4 space-y-1.5 leading-relaxed" {...props} />,
    li: ({ ...props }) => <li className="my-1 text-[15px] sm:text-[17px] leading-relaxed" {...props} />,
    em: ({ ...props }) => <em className="italic font-serif" {...props} />,
    strong: ({ ...props }) => <strong className="font-bold font-serif" {...props} />
  }), [theme]);

  return (
    <div className={`min-h-screen flex flex-col font-serif transition-colors duration-150 ${
      theme === 'dark' 
        ? 'bg-[#121212] text-[#EDE8DF]' 
        : theme === 'sepia' 
        ? 'bg-[#EFE6D4] text-[#2E2114]' 
        : 'bg-[#F2EFE9] text-stone-900'
    }`}>
      {/* Laci Geser Daftar Bab (Sidebar Chapter Drawer - Dipindahkan ke Sisi Kiri) */}
      {isDrawerActive && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop Blur Gelap */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={handleCloseDrawer}
          />

          {/* Panel Laci Samping (Di Sisi Kiri Layar) */}
          <div
            className={`relative mr-auto w-full max-w-xs sm:max-w-sm h-full shadow-2xl flex flex-col font-sans border-r animate-in slide-in-from-left duration-250 z-10 ${
              theme === 'dark'
                ? 'bg-[#1C1C1C] border-[#2E2E2E] text-[#EDE8DF]'
                : theme === 'sepia'
                ? 'bg-[#FAF4E8] border-[#DECFAF] text-[#2E2114]'
                : 'bg-[#FCFBF8] border-[#E5E0D0] text-stone-900'
            }`}
          >
            <div className={`p-4 border-b flex items-center justify-between ${
              theme === 'dark' ? 'border-[#2E2E2E]' : theme === 'sepia' ? 'border-[#DECFAF]' : 'border-stone-200'
            }`}>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h2 className="font-serif font-bold text-base">Daftar Bab</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono border ${
                  theme === 'dark'
                    ? 'bg-stone-800 text-stone-300 border-stone-700'
                    : theme === 'sepia'
                    ? 'bg-[#E5DAC6] text-[#2E2114] border-[#D6C4A5]'
                    : 'bg-white text-stone-600 border-stone-200'
                }`}>
                  {chapters.length} Bab
                </span>
                <button
                  type="button"
                  id="btn-close-reader-drawer"
                  onClick={handleCloseDrawer}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    theme === 'dark' 
                      ? 'hover:bg-stone-800 text-stone-400 hover:text-stone-200' 
                      : theme === 'sepia'
                      ? 'hover:bg-[#EFE6D4] text-[#57432E]'
                      : 'hover:bg-stone-100 text-stone-500 hover:text-stone-800'
                  }`}
                  title="Tutup Daftar Bab"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {chapters.map((chap, idx) => {
                const isCurrent = chap.id === chapter.id;
                const isProlog = /prolog/i.test(chap.title);
                const isEpilog = /epilog/i.test(chap.title);

                const chapterBadge = isProlog 
                  ? 'P' 
                  : isEpilog 
                  ? 'E' 
                  : (typeof chap.chapterNumber === 'number' ? chap.chapterNumber : (chap.order !== undefined ? chap.order : idx + 1));

                return (
                  <button
                    key={chap.id || idx}
                    type="button"
                    onClick={() => {
                      onSelectChapter(chap);
                      handleCloseDrawer();
                    }}
                    className={`w-full py-2.5 px-3 flex items-center gap-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      isCurrent
                        ? theme === 'dark'
                          ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                          : theme === 'sepia'
                          ? 'bg-[#E2D2B8] text-[#2E2114] font-semibold border border-[#C5B090]'
                          : 'bg-[#50553C]/10 text-[#363a29] font-semibold border border-[#50553C]/20'
                        : theme === 'dark'
                          ? 'hover:bg-stone-800/60 text-stone-300'
                          : theme === 'sepia'
                          ? 'hover:bg-[#EFE6D4] text-[#3B2C1C]'
                          : 'hover:bg-stone-100/70 text-stone-700'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] shrink-0 transition-colors ${
                        isCurrent
                          ? theme === 'dark'
                            ? 'bg-amber-400 text-black font-bold shadow-xs'
                            : theme === 'sepia'
                            ? 'bg-[#6E502B] text-white font-bold shadow-xs'
                            : 'bg-[#414E2E] text-white font-bold shadow-xs'
                          : theme === 'dark'
                            ? 'bg-stone-800 text-stone-400'
                            : theme === 'sepia'
                            ? 'bg-[#E8DEC8] text-[#57432E]'
                            : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {chapterBadge}
                    </div>

                    <span className="text-xs sm:text-sm break-words leading-tight flex-1 min-w-0 line-clamp-2">
                      {chap.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* KONTEN BAB NOVEL (100% GRATIS UNTUK SEMUA PEMBACA)                         */}
      {/* ========================================================================= */}
      {/* Pembungkus Lembaran Kertas Novel (Paper Sheet Container) */}
      <div className="w-full flex-1 flex justify-center py-2 sm:py-6 px-2 sm:px-4">
        <article 
          className={`relative max-w-xl w-full mx-auto px-7 sm:px-11 py-7 sm:py-10 flex flex-col justify-between protected-reading-content select-none rounded-xs sm:rounded-sm border-x transition-colors duration-150 ${
            theme === 'dark'
              ? 'bg-[#181819] text-[#DDD8CF] border-[#2B2B2C] shadow-[0_4px_30px_rgba(0,0,0,0.5),-4px_0_16px_rgba(0,0,0,0.35),4px_0_16px_rgba(0,0,0,0.35)]'
              : theme === 'sepia'
              ? 'bg-[#FAF4E8] text-[#2E2114] border-[#DECFAF] shadow-[0_4px_25px_rgba(78,52,28,0.08),-4px_0_14px_rgba(78,52,28,0.05),4px_0_14px_rgba(78,52,28,0.05)]'
              : 'bg-[#FCFBF8] text-stone-900 border-[#E2DDCB] shadow-[0_4px_25px_rgba(0,0,0,0.06),-4px_0_14px_rgba(0,0,0,0.04),4px_0_14px_rgba(0,0,0,0.04)]'
          }`}
          onContextMenu={(e) => e.preventDefault()}
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          {/* Pinggiran Kertas Kiri (Paper Left Crease & Spine Shadow) */}
          <div 
            aria-hidden="true" 
            className={`pointer-events-none absolute inset-y-0 left-0 w-2.5 sm:w-3 border-r select-none ${
              theme === 'dark'
                ? 'bg-gradient-to-r from-black/30 via-black/10 to-transparent border-white/5'
                : theme === 'sepia'
                ? 'bg-gradient-to-r from-[#4A351D]/10 via-[#4A351D]/3 to-transparent border-[#4A351D]/10'
                : 'bg-gradient-to-r from-stone-900/6 via-stone-900/2 to-transparent border-stone-400/20'
            }`} 
          />

          {/* Pinggiran Kertas Kanan (Paper Right Edge Shadow) */}
          <div 
            aria-hidden="true" 
            className={`pointer-events-none absolute inset-y-0 right-0 w-2.5 sm:w-3 border-l select-none ${
              theme === 'dark'
                ? 'bg-gradient-to-l from-black/30 via-black/10 to-transparent border-white/5'
                : theme === 'sepia'
                ? 'bg-gradient-to-l from-[#4A351D]/10 via-[#4A351D]/3 to-transparent border-[#4A351D]/10'
                : 'bg-gradient-to-l from-stone-900/6 via-stone-900/2 to-transparent border-stone-400/20'
            }`} 
          />

          <div>
            {/* Header Naskah Novel */}
            <header className="mb-8 pb-4 border-b border-stone-200/60 dark:border-stone-800/60 text-center">
              <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight px-2 leading-tight">
                {activeTitle || chapter.title}
              </h1>
            </header>

            {/* Isi Naskah Utama */}
            {isFetchingContent ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                <span className="text-xs font-serif text-stone-500 dark:text-stone-400">
                  Memuat teks bab...
                </span>
              </div>
            ) : processedContent.trim().length === 0 ? (
              <div className="py-20 text-center font-serif">
                <p className="text-stone-400 dark:text-stone-500 italic text-sm">
                  Bab ini belum memiliki teks naskah cerita.
                </p>
              </div>
            ) : (
              <div className="novel-typography">
                <Markdown 
                  urlTransform={customUrlTransform}
                  remarkPlugins={[remarkBreaks]}
                  rehypePlugins={[rehypeRaw]}
                  components={markdownComponents}
                >
                  {processedContent}
                </Markdown>
              </div>
            )}
          </div>

          {/* Area Interaksi Emosi & Reaksi Bab Novel */}
          {novelId && (
            <div className="mt-8 pt-6 border-t border-stone-200/60 dark:border-stone-800/60">
              <ChapterReactions 
                novelId={novelId} 
                chapterId={chapter.id} 
                onOpenDrawer={handleOpenDrawer}
              />
            </div>
          )}

          {/* Akhir Bab Pembatas */}
          <div className="mt-8 pt-6 border-t border-stone-200/60 dark:border-stone-800/60 text-center">
            <span className={`text-xs font-serif italic ${
              theme === 'dark' ? 'text-stone-500' : theme === 'sepia' ? 'text-[#826E57]' : 'text-stone-400'
            }`}>
              Selesai Membaca — {activeTitle || chapter.title}
            </span>
          </div>

          {/* Navigasi Bab Sebelumnya & Berikutnya di Bagian Akhir Halaman */}
          <div className="mt-6 pt-5 border-t border-stone-200/60 dark:border-stone-800/60 flex items-center justify-between gap-3 font-sans">
            {prevChapter ? (
              <button
                type="button"
                id="btn-reader-footer-prev"
                onClick={() => onSelectChapter(prevChapter)}
                className={`flex-1 py-2.5 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium transition-all cursor-pointer active:scale-95 ${
                  theme === 'dark'
                    ? 'bg-[#222222] hover:bg-[#2A2A2A] text-stone-200 border-[#383838]'
                    : theme === 'sepia'
                    ? 'bg-[#FAF4E8] hover:bg-[#F0E4CB] text-[#3B2C1C] border-[#D6C4A5]'
                    : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-200 shadow-2xs'
                }`}
                title={`Bab Sebelumnya: ${prevChapter.title}`}
              >
                <ChevronLeft className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="truncate">Bab Sebelumnya</span>
              </button>
            ) : (
              <div className="flex-1" />
            )}

            {nextChapter ? (
              <button
                type="button"
                id="btn-reader-footer-next"
                onClick={() => onSelectChapter(nextChapter)}
                className={`flex-1 py-2.5 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium transition-all cursor-pointer active:scale-95 shadow-xs ${
                  theme === 'dark'
                    ? 'bg-[#3E4D2B] hover:bg-[#4A5D32] text-white border-[#3E4D2B]'
                    : theme === 'sepia'
                    ? 'bg-[#6E502B] hover:bg-[#5D4323] text-white border-[#6E502B]'
                    : 'bg-[#50553C] hover:bg-[#434832] text-white border-[#50553C]'
                }`}
                title={`Bab Selanjutnya: ${nextChapter.title}`}
              >
                <span className="truncate">Bab Selanjutnya</span>
                <ChevronRight className="w-4 h-4 shrink-0 text-white" />
              </button>
            ) : (
              <div className="flex-1 text-center py-2 text-xs font-serif italic text-stone-400">
                (Sudah di bab terakhir)
              </div>
            )}
          </div>
        </article>
      </div>

      <div 
        id="reader-bottom-accent-bar"
        className={`h-2 sm:h-2.5 w-full shrink-0 border-t ${
          theme === 'dark'
            ? 'bg-[#3E4D2B] border-[#2A341E]'
            : theme === 'sepia'
            ? 'bg-[#6E502B] border-[#5A4122]'
            : 'bg-[#50553C] border-[#434832]/30'
        }`}
      />
    </div>
  );
};
