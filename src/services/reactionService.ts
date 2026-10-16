import { 
  doc, 
  onSnapshot, 
  serverTimestamp, 
  collection, 
  query, 
  where, 
  setDoc,
  Unsubscribe 
} from 'firebase/firestore';
import { db, ensureAuth } from '../firebase';
import { queueReactionChange } from './batchSyncService';

export type ReactionType = 'fire' | 'love' | 'sad' | 'shock' | 'clap';

export interface ReactionCounts {
  fire: number;
  love: number;
  sad: number;
  shock: number;
  clap: number;
}

export interface ReactionConfig {
  type: ReactionType;
  emoji: string;
  label: string;
  activeColor: string; // Tailwind styling for active button
}

export const REACTION_CONFIGS: ReactionConfig[] = [
  {
    type: 'fire',
    emoji: '🔥',
    label: 'Seru',
    activeColor: 'bg-amber-500 text-white border-amber-600 shadow-xs'
  },
  {
    type: 'love',
    emoji: '❤️',
    label: 'Baper',
    activeColor: 'bg-rose-500 text-white border-rose-600 shadow-xs'
  },
  {
    type: 'sad',
    emoji: '😭',
    label: 'Nyesek',
    activeColor: 'bg-blue-500 text-white border-blue-600 shadow-xs'
  },
  {
    type: 'shock',
    emoji: '🤯',
    label: 'Plot Twist',
    activeColor: 'bg-purple-600 text-white border-purple-700 shadow-xs'
  },
  {
    type: 'clap',
    emoji: '👏',
    label: 'Mantap',
    activeColor: 'bg-[#50553C] text-white border-[#434832] shadow-xs'
  }
];

// Mapping kelas animasi CSS yang mulus untuk tiap emoji (hardware accelerated di WebView)
export const REACTION_ANIMATION_CLASS: Record<ReactionType, string> = {
  fire: 'animate-reaction-flame',
  love: 'animate-reaction-heart',
  sad: 'animate-reaction-crying',
  shock: 'animate-reaction-shock',
  clap: 'animate-reaction-clap'
};

export const INITIAL_REACTION_COUNTS: ReactionCounts = {
  fire: 0,
  love: 0,
  sad: 0,
  shock: 0,
  clap: 0
};

export interface TopReactionInfo {
  type: ReactionType;
  emoji: string;
  label: string;
  count: number;
}

export interface NovelReactionSummary extends ReactionCounts {
  total: number;
  topReaction: TopReactionInfo | null;
}

/**
 * Mencari reaksi terbanyak dari kumpulan angka reaksi
 */
export function getTopReactionFromCounts(counts: ReactionCounts): TopReactionInfo | null {
  const list: { type: ReactionType; count: number }[] = [
    { type: 'fire', count: counts.fire },
    { type: 'love', count: counts.love },
    { type: 'sad', count: counts.sad },
    { type: 'shock', count: counts.shock },
    { type: 'clap', count: counts.clap }
  ];

  list.sort((a, b) => b.count - a.count);
  const best = list[0];
  if (!best || best.count <= 0) return null;

  const config = REACTION_CONFIGS.find((c) => c.type === best.type);
  if (!config) return null;

  return {
    type: best.type,
    emoji: config.emoji,
    label: config.label,
    count: best.count
  };
}

// Generate consistent document ID for chapter reactions
export function getChapterReactionKey(chapterId: string, novelId?: string): string {
  const cleanChapterId = chapterId.replace(/\//g, '_').trim();
  if (novelId) {
    const cleanNovelId = novelId.replace(/\//g, '_').trim();
    return `${cleanNovelId}_${cleanChapterId}`;
  }
  return cleanChapterId;
}

// LocalStorage key for user's selected reaction on a given chapter
export function getLocalReactionKey(reactionKey: string): string {
  return `user_reaction_${reactionKey}`;
}

/**
 * Get user's saved reaction from localStorage for this chapter
 */
export function getUserStoredReaction(reactionKey: string): ReactionType | null {
  try {
    const val = localStorage.getItem(getLocalReactionKey(reactionKey));
    if (val && ['fire', 'love', 'sad', 'shock', 'clap'].includes(val)) {
      return val as ReactionType;
    }
  } catch {
    // LocalStorage error fallback
  }
  return null;
}

/**
 * Save or clear user's reaction in localStorage
 */
export function setUserStoredReaction(reactionKey: string, reaction: ReactionType | null): void {
  try {
    const storageKey = getLocalReactionKey(reactionKey);
    if (reaction) {
      localStorage.setItem(storageKey, reaction);
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch {
    // LocalStorage error fallback
  }
}

/**
 * Real-time listener for chapter reactions from Firestore with local cache support
 */
export function listenToChapterReactions(
  reactionKey: string,
  onUpdate: (counts: ReactionCounts) => void
): () => void {
  // 1. Baca cache lokal terlebih dahulu untuk kecepatan render tanpa flicker
  const cacheKey = `chapter_reactions_counts_${reactionKey}`;
  let currentCounts: ReactionCounts = { ...INITIAL_REACTION_COUNTS };
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.fire === 'number') {
        currentCounts = {
          fire: Math.max(0, Number(parsed.fire) || 0),
          love: Math.max(0, Number(parsed.love) || 0),
          sad: Math.max(0, Number(parsed.sad) || 0),
          shock: Math.max(0, Number(parsed.shock) || 0),
          clap: Math.max(0, Number(parsed.clap) || 0)
        };
        onUpdate(currentCounts);
      }
    }
  } catch {}

  if (!db) {
    onUpdate(currentCounts);
    return () => {};
  }

  try {
    const docRef = doc(db, 'chapter_reactions', reactionKey);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const freshCounts: ReactionCounts = {
            fire: Math.max(0, Number(data.fire) || 0),
            love: Math.max(0, Number(data.love) || 0),
            sad: Math.max(0, Number(data.sad) || 0),
            shock: Math.max(0, Number(data.shock) || 0),
            clap: Math.max(0, Number(data.clap) || 0)
          };
          try {
            localStorage.setItem(cacheKey, JSON.stringify(freshCounts));
          } catch {}
          onUpdate(freshCounts);
        } else {
          onUpdate({ ...INITIAL_REACTION_COUNTS });
        }
      },
      (error) => {
        console.warn('Silent fallback: Gagal mendengarkan reaksi real-time:', error);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Silent error setting up reactions listener:', err);
    return () => {};
  }
}

/**
 * Real-time listener untuk total seluruh reaksi dari semua bab pada sebuah novel.
 * Menghitung langsung jumlah akumulasi reaksi dari semua bab novel secara akurat.
 */
export function listenToNovelTotalReactions(
  novelId: string,
  onUpdate: (summary: NovelReactionSummary) => void,
  knownChapterIds?: string[]
): () => void {
  const initialSummary: NovelReactionSummary = {
    fire: 0,
    love: 0,
    sad: 0,
    shock: 0,
    clap: 0,
    total: 0,
    topReaction: null
  };

  if (!novelId || !db) {
    onUpdate(initialSummary);
    return () => {};
  }

  const cleanNovelId = novelId.replace(/\//g, '_').trim();
  let isCancelled = false;
  const unsubs: Unsubscribe[] = [];

  const buildSummary = (counts: ReactionCounts): NovelReactionSummary => {
    const total = counts.fire + counts.love + counts.sad + counts.shock + counts.clap;
    const top = total > 0 ? getTopReactionFromCounts(counts) : null;
    return {
      ...counts,
      total,
      topReaction: top
    };
  };

  // Map untuk menyimpan reaksi per bab (kunci: docId)
  const chapterCountsMap = new Map<string, ReactionCounts>();

  const emitAggregated = () => {
    if (isCancelled) return;
    const sum: ReactionCounts = { fire: 0, love: 0, sad: 0, shock: 0, clap: 0 };
    chapterCountsMap.forEach((counts) => {
      sum.fire += counts.fire || 0;
      sum.love += counts.love || 0;
      sum.sad += counts.sad || 0;
      sum.shock += counts.shock || 0;
      sum.clap += counts.clap || 0;
    });

    const summary = buildSummary(sum);
    onUpdate(summary);

    // Sinkronkan total akurat ke dokumen novel_reactions agar cache dokumen selalu sinkron
    try {
      const novelDocRef = doc(db, 'novel_reactions', cleanNovelId);
      setDoc(
        novelDocRef,
        {
          ...sum,
          total: summary.total,
          novelId: cleanNovelId,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      ).catch(() => {});
    } catch {}
  };

  // 1. Query semua chapter_reactions dengan novelId == cleanNovelId
  try {
    const q = query(collection(db, 'chapter_reactions'), where('novelId', '==', cleanNovelId));
    const unsubQuery = onSnapshot(
      q,
      (snap) => {
        if (isCancelled) return;
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          chapterCountsMap.set(docSnap.id, {
            fire: Math.max(0, Number(d.fire) || 0),
            love: Math.max(0, Number(d.love) || 0),
            sad: Math.max(0, Number(d.sad) || 0),
            shock: Math.max(0, Number(d.shock) || 0),
            clap: Math.max(0, Number(d.clap) || 0)
          });
        });
        emitAggregated();
      },
      (err) => {
        console.warn('Silent error querying chapter_reactions by novelId:', err);
      }
    );
    unsubs.push(unsubQuery);
  } catch (err) {
    console.warn('Error setting up query on chapter_reactions:', err);
  }

  // 2. Jika knownChapterIds disediakan, dengarkan langsung setiap dokumen bab spesifik
  // Ini mengantisipasi jika dokumen bab dibuat sebelum field novelId ada
  if (knownChapterIds && knownChapterIds.length > 0) {
    knownChapterIds.forEach((chId) => {
      try {
        const key = getChapterReactionKey(chId, cleanNovelId);
        const chapterDocRef = doc(db, 'chapter_reactions', key);
        const unsubDoc = onSnapshot(
          chapterDocRef,
          (docSnap) => {
            if (isCancelled) return;
            if (docSnap.exists()) {
              const d = docSnap.data();
              chapterCountsMap.set(docSnap.id, {
                fire: Math.max(0, Number(d.fire) || 0),
                love: Math.max(0, Number(d.love) || 0),
                sad: Math.max(0, Number(d.sad) || 0),
                shock: Math.max(0, Number(d.shock) || 0),
                clap: Math.max(0, Number(d.clap) || 0)
              });
            }
            emitAggregated();
          },
          () => {}
        );
        unsubs.push(unsubDoc);
      } catch {}
    });
  }

  return () => {
    isCancelled = true;
    unsubs.forEach((fn) => {
      try { fn(); } catch {}
    });
  };
}

/**
 * Toggle or change user's reaction using Batch Sync:
 * - Skor dan pilihan reaksi langsung diperbarui secara instan di UI dan cache lokal.
 * - Pengguna bebas mengklik / mengganti reaksi / spam reaksi tanpa membuat kuota Firebase habis.
 * - Perubahan final akan disinkronkan ke Firebase secara otomatis saat aplikasi ditutup atau dibuka kembali.
 */
export async function toggleChapterReaction(
  reactionKey: string,
  targetReaction: ReactionType,
  currentReaction: ReactionType | null,
  novelId?: string
): Promise<ReactionType | null> {
  const derivedNovelId = (novelId || (reactionKey.includes('_') ? reactionKey.split('_')[0] : '')).replace(/\//g, '_').trim();
  const chapterId = reactionKey.includes('_') ? reactionKey.split('_').slice(1).join('_') : reactionKey;

  // Catat perubahan ke antrean sinkronisasi batch
  const newSelectedReaction = queueReactionChange(
    reactionKey,
    targetReaction,
    currentReaction,
    derivedNovelId,
    chapterId
  );

  // Perbarui cache jumlah reaksi lokal agar tampilan UI di halaman pembaca langsung sinkron
  try {
    const cacheKey = `chapter_reactions_counts_${reactionKey}`;
    const raw = localStorage.getItem(cacheKey);
    const counts: ReactionCounts = raw ? JSON.parse(raw) : { ...INITIAL_REACTION_COUNTS };

    if (currentReaction === targetReaction) {
      // Batal reaksi (-1)
      counts[targetReaction] = Math.max(0, (counts[targetReaction] || 0) - 1);
    } else if (currentReaction && currentReaction !== targetReaction) {
      // Pindah reaksi (-1 lama, +1 baru)
      counts[currentReaction] = Math.max(0, (counts[currentReaction] || 0) - 1);
      counts[targetReaction] = (counts[targetReaction] || 0) + 1;
    } else {
      // Reaksi baru (+1)
      counts[targetReaction] = (counts[targetReaction] || 0) + 1;
    }

    localStorage.setItem(cacheKey, JSON.stringify(counts));
  } catch {}

  setUserStoredReaction(reactionKey, newSelectedReaction);
  return newSelectedReaction;
}


