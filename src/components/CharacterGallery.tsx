import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Novel, BookCharacter } from '../types';
import { subscribeToNovelCharacters, getCachedNovelCharacters } from '../services/novelService';
import { 
  Users, 
  User, 
  Calendar, 
  Ruler, 
  Sparkles, 
  AlertCircle,
  RotateCcw,
  ZoomIn,
  X,
  Maximize2
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';

interface CharacterGalleryProps {
  novel: Novel;
  onBack?: () => void;
}

/**
 * Komponen pembungkus teks catatan yang mendeteksi apakah teks terpotong (overflow/line-clamp).
 * Modal hanya dapat dipicu via klik jika teks memang terpotong (...).
 */
interface CharacterNoteTextProps {
  notes: string;
  onOpenModal: () => void;
}

const CharacterNoteText: React.FC<CharacterNoteTextProps> = ({ notes, onOpenModal }) => {
  const { theme } = useAppTheme();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      const el = textRef.current;
      if (el) {
        setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [notes]);

  if (!notes) {
    return (
      <p className={`synopsis-paragraph font-sans italic text-[11px] sm:text-xs ${
        theme === 'dark' ? 'text-stone-500' : theme === 'sepia' ? 'text-[#826E57]' : 'text-stone-400'
      }`}>
        Belum ada catatan deskripsi atau latar belakang tokoh ini.
      </p>
    );
  }

  return (
    <div
      onClick={() => {
        if (isOverflowing) {
          onOpenModal();
        }
      }}
      className={`rounded-lg transition-colors ${
        isOverflowing
          ? 'cursor-pointer hover:opacity-85 -m-1 p-1'
          : ''
      }`}
      title={isOverflowing ? 'Klik untuk membaca catatan lengkap' : undefined}
    >
      <p
        ref={textRef}
        className={`synopsis-paragraph font-sans whitespace-pre-line line-clamp-3 sm:line-clamp-4 md:line-clamp-5 overflow-hidden text-ellipsis leading-relaxed ${
          theme === 'dark' ? 'text-[#D6D1C7]' : theme === 'sepia' ? 'text-[#3B2C1C]' : 'text-stone-800'
        }`}
      >
        {notes}
      </p>
    </div>
  );
};

export const CharacterGallery: React.FC<CharacterGalleryProps> = ({
  novel,
  onBack,
}) => {
  const { theme } = useAppTheme();
  const [characters, setCharacters] = useState<BookCharacter[]>(() => {
    if (novel?.characters && novel.characters.length > 0) {
      return novel.characters;
    }
    return novel?.id ? getCachedNovelCharacters(novel.id) : [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const initial = (novel?.characters && novel.characters.length > 0)
      ? novel.characters
      : novel?.id ? getCachedNovelCharacters(novel.id) : [];
    return initial.length === 0;
  });
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);

  // Modal States
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [activeNotesCharacter, setActiveNotesCharacter] = useState<BookCharacter | null>(null);

  const bookId = novel?.id;

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    setRetryKey((prev) => prev + 1);
  }, []);

  // Handle ESC key to close any open modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewImage(null);
        setActiveNotesCharacter(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    // Pastikan bookId yang dikirim dari profil buku terdeteksi dengan benar
    if (!bookId || typeof bookId !== 'string' || !bookId.trim()) {
      setLoading(false);
      setError('ID Buku (bookId) tidak terdeteksi atau tidak valid.');
      return;
    }

    // Hanya tampilkan loading jika memang belum ada data sama sekali di memori/cache
    if (characters.length === 0) {
      setLoading(true);
    }
    setError(null);

    let isMounted = true;

    // Realtime query ke koleksi Firestore 'characters' (where bookId == novel.id)
    const unsub = subscribeToNovelCharacters(
      novel,
      (updatedChars) => {
        if (!isMounted) return;
        setCharacters(updatedChars);
        setLoading(false);
        setError(null);
      },
      (err) => {
        if (!isMounted) return;
        console.error('Error fetching characters:', err);
        setLoading(false);
        const errMsg = err?.message || 'Terjadi kendala saat memuat data karakter dari Firebase.';
        setError(errMsg);
      }
    );

    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, [novel, bookId, retryKey]);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-4 pb-10 sm:pb-14">
      {/* Main Content Area (Read-Only Mode) */}
      {loading ? (
        /* 1. Status Loading */
        <div className="bg-white rounded-2xl p-8 sm:p-12 border border-stone-200/80 shadow-2xs text-center">
          <div className="w-8 h-8 border-2 border-[#50553C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-stone-600 font-serif text-xs sm:text-sm font-medium">
            Memuat daftar karakter dari buku...
          </p>
        </div>
      ) : error ? (
        /* 2. Status Error dengan Tombol Coba Lagi */
        <div className="bg-white rounded-2xl p-6 sm:p-10 border border-red-100 shadow-2xs text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base sm:text-lg font-serif font-bold text-stone-900 mb-1">
            Gagal Memuat Galeri Karakter
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm max-w-md mx-auto mb-4 leading-relaxed">
            {error}
          </p>
          <button
            id="btn-retry-fetch-characters"
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#50553C] hover:bg-[#434832] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer outline-none active:scale-95 shadow-2xs mx-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Coba Lagi</span>
          </button>
        </div>
      ) : characters.length === 0 ? (
        /* 3. Status Kosong (0 Karakter) */
        <div className={`rounded-2xl p-8 sm:p-12 border shadow-2xs text-center transition-colors ${
          theme === 'dark'
            ? 'bg-[#1C1C1C] border-[#2E2E2E]'
            : theme === 'sepia'
            ? 'bg-[#FAF4E8] border-[#D6C4A5]'
            : 'bg-white border-stone-200/80'
        }`}>
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mx-auto mb-3 ${
            theme === 'dark'
              ? 'bg-[#252525] border-[#333333] text-stone-400'
              : theme === 'sepia'
              ? 'bg-[#EFE6D4] border-[#DFD3B8] text-[#826E57]'
              : 'bg-[#FAF9F5] border-stone-200/80 text-stone-400'
          }`}>
            <Users className="w-6 h-6" />
          </div>
          <h2 className={`text-base sm:text-lg font-serif font-bold mb-1 ${
            theme === 'dark' ? 'text-[#EDE8DF]' : theme === 'sepia' ? 'text-[#3B2C1C]' : 'text-stone-800'
          }`}>
            Belum ada karakter yang ditambahkan untuk buku ini.
          </h2>
          <p className={`text-xs sm:text-sm max-w-sm mx-auto ${
            theme === 'dark' ? 'text-stone-400' : theme === 'sepia' ? 'text-[#826E57]' : 'text-stone-500'
          }`}>
            Daftar tokoh akan otomatis muncul setelah penulis menambahkan profil karakter pada buku ini.
          </p>
        </div>
      ) : (
        /* 4. Status Sukses Ada Karakter */
        <div className="space-y-3.5 sm:space-y-4">
          {characters.map((character, idx) => {
            const hasBadges = Boolean(character.gender || character.age || character.height || character.role);
            const rawPhoto = character.photoUrl || character.photo || '';
            const imageSrc = typeof rawPhoto === 'string' && rawPhoto.trim().length > 0 ? rawPhoto.trim() : null;
            const characterNotes = character.notes || character.description || '';

            return (
              <div
                key={character.id || idx}
                id={`character-card-${character.id || idx}`}
                className={`rounded-2xl p-3 sm:p-4 md:p-5 border shadow-2xs transition-colors ${
                  theme === 'dark'
                    ? 'bg-[#1C1C1C] border-[#2E2E2E]'
                    : theme === 'sepia'
                    ? 'bg-[#FAF4E8] border-[#D6C4A5]'
                    : 'bg-white border-stone-200/80'
                }`}
              >
                {/* Horizontal 2-Column Layout */}
                <div className="flex items-start gap-3 sm:gap-4 md:gap-5">
                  {/* Sisi Kiri: Foto Karakter Rasio 9:16 (Fixed Width, Object-Fit Cover, Rounded Border, Clickable Zoom) */}
                  <div
                    onClick={() => {
                      if (imageSrc) {
                        setPreviewImage({ url: imageSrc, name: character.name });
                      }
                    }}
                    className={`w-24 sm:w-32 md:w-36 shrink-0 aspect-[9/16] rounded-xl overflow-hidden border relative shadow-2xs flex items-center justify-center ${
                      theme === 'dark'
                        ? 'bg-[#252525] border-[#333333]'
                        : theme === 'sepia'
                        ? 'bg-[#EAE2D2] border-[#DFD3B8]'
                        : 'bg-[#EBEBE6] border-stone-200/80'
                    } ${
                      imageSrc ? 'cursor-pointer group' : ''
                    }`}
                    title={imageSrc ? 'Klik untuk memperbesar foto (75% layar)' : character.name}
                  >
                    {imageSrc ? (
                      <>
                        <img
                          src={imageSrc}
                          alt={character.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                        {/* Hover Overlay Hint */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-[10.5px] font-semibold backdrop-blur-[1px]">
                          <ZoomIn className="w-4 h-4" />
                          <span className="hidden sm:inline">Zoom</span>
                        </div>
                      </>
                    ) : (
                      <div className={`w-full h-full p-2 flex flex-col items-center justify-center text-center ${
                        theme === 'dark' ? 'bg-[#222222]' : theme === 'sepia' ? 'bg-[#EFE6D4]' : 'bg-[#FAF9F5]'
                      }`}>
                        <div className="w-8 h-8 rounded-lg bg-[#50553C] text-white flex items-center justify-center mb-1.5 shadow-2xs">
                          <User className="w-4 h-4" />
                        </div>
                        <span className={`text-[10px] sm:text-xs font-serif font-bold line-clamp-2 leading-tight ${
                          theme === 'dark' ? 'text-stone-300' : theme === 'sepia' ? 'text-[#3B2C1C]' : 'text-stone-700'
                        }`}>
                          {character.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Sisi Kanan: Metadata & Catatan Profil */}
                  <div className="flex-1 min-w-0 flex flex-col justify-start">
                    {/* Baris 1: Nama Karakter */}
                    <div className="flex items-start justify-between gap-2">
                      <h2 className={`text-sm sm:text-lg md:text-xl font-serif font-bold leading-snug ${
                        theme === 'dark' ? 'text-[#F5F3EE]' : theme === 'sepia' ? 'text-[#3B2C1C]' : 'text-stone-900'
                      }`}>
                        {character.name}
                      </h2>
                      {character.role && (
                        <span className={`shrink-0 inline-block px-1.5 sm:px-2 py-0.5 rounded-md text-[9.5px] sm:text-[10.5px] font-medium font-mono border ${
                          theme === 'dark'
                            ? 'bg-[#282828] text-amber-300 border-[#383838]'
                            : theme === 'sepia'
                            ? 'bg-[#EFE6D4] text-[#6E502B] border-[#D6C4A5]'
                            : 'bg-[#F4F4EE] text-[#50553C] border-stone-200/60'
                        }`}>
                          {character.role}
                        </span>
                      )}
                    </div>

                    {/* Baris 2: Badge Informasi (Gender, Umur, Tinggi Badan) */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                      {character.gender && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] sm:text-xs font-medium border ${
                          theme === 'dark'
                            ? 'bg-[#242424] border-[#333333] text-stone-300'
                            : theme === 'sepia'
                            ? 'bg-[#EFE6D4] border-[#DFD3B8] text-[#3B2C1C]'
                            : 'bg-[#FAF9F5] border-stone-200/80 text-stone-700'
                        }`}>
                          <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 shrink-0" />
                          <span>{character.gender}</span>
                        </span>
                      )}

                      {character.age && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] sm:text-xs font-medium border ${
                          theme === 'dark'
                            ? 'bg-[#242424] border-[#333333] text-stone-300'
                            : theme === 'sepia'
                            ? 'bg-[#EFE6D4] border-[#DFD3B8] text-[#3B2C1C]'
                            : 'bg-[#FAF9F5] border-stone-200/80 text-stone-700'
                        }`}>
                          <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#50553C] dark:text-stone-400 sepia:text-[#8C6D4F] shrink-0" />
                          <span>{character.age}</span>
                        </span>
                      )}

                      {character.height && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] sm:text-xs font-medium border ${
                          theme === 'dark'
                            ? 'bg-[#242424] border-[#333333] text-stone-300'
                            : theme === 'sepia'
                            ? 'bg-[#EFE6D4] border-[#DFD3B8] text-[#3B2C1C]'
                            : 'bg-[#FAF9F5] border-stone-200/80 text-stone-700'
                        }`}>
                          <Ruler className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#50553C] dark:text-stone-400 sepia:text-[#8C6D4F] shrink-0" />
                          <span>{character.height}</span>
                        </span>
                      )}

                      {!hasBadges && (
                        <span className={`text-[10px] sm:text-[11px] font-sans italic ${
                          theme === 'dark' ? 'text-stone-500' : theme === 'sepia' ? 'text-[#826E57]' : 'text-stone-400'
                        }`}>
                          Info fisik belum dicantumkan
                        </span>
                      )}
                    </div>

                    {/* Baris 3: Bagian "CATATAN & PROFIL TOKOH" (Dibatasi Rata Pas dengan Cover & Clickable Hanya Jika Terpotong) */}
                    <div className={`mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t ${
                      theme === 'dark' ? 'border-[#2A2A2A]' : theme === 'sepia' ? 'border-[#E2D2B8]' : 'border-stone-100'
                    }`}>
                      <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider font-mono block mb-1 ${
                        theme === 'dark' ? 'text-amber-400/90' : theme === 'sepia' ? 'text-[#826E57]' : 'text-stone-500'
                      }`}>
                        CATATAN & PROFIL TOKOH
                      </span>

                      <CharacterNoteText
                        notes={characterNotes}
                        onOpenModal={() => setActiveNotesCharacter(character)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MODAL POP-UP CATATAN LENGKAP KARAKTER (BERSIH & MINIMALIS) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {activeNotesCharacter && (
          <div
            id="modal-notes-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setActiveNotesCharacter(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className={`border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] relative transition-colors ${
                theme === 'dark'
                  ? 'bg-[#1C1C1C] border-[#333333]'
                  : theme === 'sepia'
                  ? 'bg-[#FAF4E8] border-[#D6C4A5]'
                  : 'bg-white border-stone-200'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Modal Bersih & Minimalis */}
              <div className={`px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${
                theme === 'dark'
                  ? 'bg-[#181818] border-[#2A2A2A]'
                  : theme === 'sepia'
                  ? 'bg-[#EFE6D4] border-[#DFD3B8]'
                  : 'bg-stone-50 border-stone-100'
              }`}>
                <span className={`text-xs sm:text-sm font-serif font-bold tracking-wide ${
                  theme === 'dark' ? 'text-[#EDE8DF]' : theme === 'sepia' ? 'text-[#3B2C1C]' : 'text-stone-900'
                }`}>
                  Catatan Karakter
                </span>

                {/* Close Button X */}
                <button
                  id="btn-close-notes-modal"
                  type="button"
                  onClick={() => setActiveNotesCharacter(null)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer outline-none active:scale-95 ${
                    theme === 'dark'
                      ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                      : theme === 'sepia'
                      ? 'bg-[#DFD3B8] text-[#2E2114] hover:bg-[#D6C4A5]'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                  title="Tutup Modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body Modal: Teks Catatan Saja Dari Paling Atas Secara Bersih */}
              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
                <p className={`font-sans whitespace-pre-line text-xs sm:text-sm leading-relaxed sm:leading-loose ${
                  theme === 'dark' ? 'text-[#D6D1C7]' : theme === 'sepia' ? 'text-[#2E2114]' : 'text-stone-800'
                }`}>
                  {activeNotesCharacter.notes || activeNotesCharacter.description || 'Belum ada catatan deskripsi atau latar belakang tokoh ini.'}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 3. MODAL PREVIEW ZOOM FOTO KARAKTER (MAKSIMAL 75% SCREEN SIZE) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {previewImage && previewImage.url && previewImage.url.trim().length > 0 && (
          <div
            id="modal-image-preview-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setPreviewImage(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="relative flex flex-col items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Tombol Penutup "X" Melayang di Luar/Pojok Kanan Atas */}
              <button
                id="btn-close-image-preview"
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3.5 -right-3.5 sm:-top-4 sm:-right-4 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-stone-900/90 text-white hover:bg-black flex items-center justify-center shadow-xl border border-white/20 transition-all cursor-pointer active:scale-95"
                title="Tutup Preview Foto"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Container Gambar (Ukuran maksimal 75vw dan 75vh) */}
              <div className="max-w-[75vw] max-h-[75vh] rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-stone-950 flex items-center justify-center">
                <img
                  src={previewImage.url.trim()}
                  alt={previewImage.name}
                  referrerPolicy="no-referrer"
                  className="max-w-[75vw] max-h-[75vh] w-auto h-auto object-contain select-none"
                />
              </div>

              {/* Caption Nama Tokoh di Bagian Bawah Gambar */}
              <div className="mt-2.5 px-3.5 py-1 bg-stone-900/80 backdrop-blur-xs text-white rounded-full text-xs font-serif font-semibold border border-white/10 shadow-md flex items-center gap-1.5">
                <Maximize2 className="w-3 h-3 text-[#EDECE6]" />
                <span>{previewImage.name}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};


