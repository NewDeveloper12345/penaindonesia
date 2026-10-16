import React, { useEffect, useState, useRef } from 'react';
import { Menu } from 'lucide-react';
import {
  ReactionType,
  ReactionCounts,
  REACTION_CONFIGS,
  REACTION_ANIMATION_CLASS,
  INITIAL_REACTION_COUNTS,
  getChapterReactionKey,
  getUserStoredReaction,
  setUserStoredReaction,
  listenToChapterReactions,
  toggleChapterReaction
} from '../services/reactionService';
import { useAppTheme } from '../context/ThemeContext';

interface ChapterReactionsProps {
  chapterId: string;
  novelId?: string;
  onOpenDrawer?: () => void;
}

export const ChapterReactions: React.FC<ChapterReactionsProps> = ({
  chapterId,
  novelId,
  onOpenDrawer
}) => {
  const { theme } = useAppTheme();
  const reactionKey = getChapterReactionKey(chapterId, novelId);

  const [counts, setCounts] = useState<ReactionCounts>({ ...INITIAL_REACTION_COUNTS });
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Keep track of current user reaction in a ref to avoid stale closure during rapid clicks
  const userReactionRef = useRef<ReactionType | null>(null);
  userReactionRef.current = userReaction;

  // 1. Inisialisasi status reaksi tersimpan & dengarkan perubahan real-time dari Firebase
  useEffect(() => {
    // Ambil pilihan pengguna dari penyimpanan lokal HP
    const saved = getUserStoredReaction(reactionKey);
    setUserReaction(saved);
    userReactionRef.current = saved;

    // Dengarkan data real-time Firestore
    const unsubscribe = listenToChapterReactions(reactionKey, (newCounts) => {
      setCounts(newCounts);
    });

    return () => {
      unsubscribe();
    };
  }, [reactionKey]);

  // 2. Handler klik tombol reaksi dengan pembaruan instan & dukungan spam klik bebas kuota
  const handleReactionClick = async (type: ReactionType) => {
    const current = userReactionRef.current;
    const isUnreact = current === type;
    const nextReaction: ReactionType | null = isUnreact ? null : type;

    // Pembaruan instan (Optimistic UI) & simpan preferensi lokal
    setUserReaction(nextReaction);
    userReactionRef.current = nextReaction;
    setUserStoredReaction(reactionKey, nextReaction);

    setCounts((prev) => {
      const updated = { ...prev };
      if (isUnreact) {
        updated[type] = Math.max(0, updated[type] - 1);
      } else {
        if (current) {
          updated[current] = Math.max(0, updated[current] - 1);
        }
        updated[type] = updated[type] + 1;
      }
      return updated;
    });

    try {
      const confirmedReaction = await toggleChapterReaction(reactionKey, type, current, novelId);
      setUserReaction(confirmedReaction);
      userReactionRef.current = confirmedReaction;
      setUserStoredReaction(reactionKey, confirmedReaction);
    } catch (err) {
      console.warn('Reaksi tersimpan di antrean lokal:', err);
    }
  };

  // Format angka jika mencapai ribuan (misal 1.2k)
  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return count.toString();
  };

  return (
    <section 
      id="chapter-reactions-section"
      className={`mt-6 pt-5 pb-2 border-t w-full select-none transition-colors ${
        theme === 'dark'
          ? 'border-stone-850'
          : theme === 'sepia'
          ? 'border-[#DFD3B8]'
          : 'border-stone-200/90'
      }`}
    >
      {/* Label Pertanyaan Elegan */}
      <div className="text-center mb-3">
        <h4 className={`font-serif text-xs sm:text-[13px] font-semibold tracking-tight transition-colors ${
          theme === 'dark' ? 'text-stone-300' : theme === 'sepia' ? 'text-[#3B2C1C]' : 'text-stone-700'
        }`}>
          Bagaimana perasaanmu setelah membaca bab ini?
        </h4>
        <p className={`text-[10px] sm:text-[11px] font-serif italic mt-0.5 transition-colors ${
          theme === 'dark' ? 'text-stone-500' : theme === 'sepia' ? 'text-[#826E57]' : 'text-stone-400'
        }`}>
          {userReaction ? 'Klik lagi untuk membatalkan atau pilih ekspresi lain.' : 'Ketuk salah satu ekspresi untuk memberi apresiasi.'}
        </p>
      </div>

      {/* Baris 5 Tombol Reaksi Kompak */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-1">
        {REACTION_CONFIGS.map((config) => {
          const isSelected = userReaction === config.type;
          const count = counts[config.type] || 0;

          return (
            <button
              key={config.type}
              id={`reaction-btn-${config.type}`}
              onClick={() => handleReactionClick(config.type)}
              disabled={isProcessing}
              title={`${config.label} (${count})`}
              className={`group relative inline-flex items-center gap-1 sm:gap-1.5 py-1.5 px-2.5 sm:px-3 rounded-full border text-xs sm:text-[12.5px] font-medium transition-all duration-150 cursor-pointer outline-none active:scale-95 disabled:opacity-80 ${
                isSelected
                  ? `${config.activeColor} ring-2 ring-offset-1 ring-stone-300/60 scale-102`
                  : theme === 'dark'
                  ? 'bg-[#222222] hover:bg-[#2A2A2A] text-stone-200 border-[#333333] hover:border-stone-600 shadow-2xs'
                  : theme === 'sepia'
                  ? 'bg-[#EFE6D4] hover:bg-[#E8DEC8] text-[#2E2114] border-[#DFD3B8] hover:border-[#C5B090] shadow-2xs'
                  : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200/90 hover:border-stone-300 shadow-2xs'
              }`}
            >
              {/* Emoji dengan Micro-Animasi */}
              <span className={`text-sm sm:text-base leading-none select-none transition-transform ${
                isSelected ? REACTION_ANIMATION_CLASS[config.type] : 'group-hover:scale-115'
              }`}>
                {config.emoji}
              </span>

              {/* Label */}
              <span className="leading-none select-none">
                {config.label}
              </span>

              {/* Counter Badge */}
              <span
                className={`ml-0.5 text-[10px] sm:text-[11px] font-mono leading-none px-1.5 py-0.5 rounded-full min-w-4 text-center font-semibold transition-colors ${
                  isSelected
                    ? 'bg-black/20 text-white'
                    : count > 0
                    ? theme === 'dark'
                      ? 'bg-stone-800 text-stone-300'
                      : theme === 'sepia'
                      ? 'bg-[#E2D5BE] text-[#3B2C1C]'
                      : 'bg-stone-100 text-stone-600 group-hover:bg-stone-200/70'
                    : theme === 'dark'
                    ? 'text-stone-500'
                    : theme === 'sepia'
                    ? 'text-[#A08A72]'
                    : 'text-stone-400'
                }`}
              >
                {formatCount(count)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
