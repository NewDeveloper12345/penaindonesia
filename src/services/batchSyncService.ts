import { 
  doc, 
  runTransaction, 
  serverTimestamp, 
  setDoc, 
  increment 
} from 'firebase/firestore';
import { db, ensureAuth } from '../firebase';
import { ReactionType, ReactionCounts } from './reactionService';
import { RatingStats, ReadingHistoryItem } from './novelRatingAndHistoryService';

// Storage Keys
const STORAGE_PENDING_REACTIONS = 'pending_firebase_sync_reactions';
const STORAGE_PENDING_RATINGS = 'pending_firebase_sync_ratings';
const STORAGE_PENDING_VIEWS = 'pending_firebase_sync_views';
const STORAGE_PENDING_HISTORY = 'pending_firebase_sync_history';

interface QueuedReaction {
  reactionKey: string;
  novelId: string;
  chapterId: string;
  initialReaction: ReactionType | null;
  finalReaction: ReactionType | null;
  timestamp: number;
}

interface QueuedRating {
  novelId: string;
  userId?: string;
  initialRating: number | null;
  finalRating: number | null; // null if cancelled
  timestamp: number;
}

interface QueuedView {
  novelId: string;
  chapterId: string;
  count: number;
}

interface QueuedHistory {
  novelId: string;
  chapterId: string;
  chapterTitle?: string;
  chapterNumber?: number;
  timestamp: number;
}

let isFlushing = false;

/**
 * Mengambil antrean reaksi dari localStorage
 */
function getPendingReactions(): Record<string, QueuedReaction> {
  try {
    const raw = localStorage.getItem(STORAGE_PENDING_REACTIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePendingReactions(queue: Record<string, QueuedReaction>) {
  try {
    if (Object.keys(queue).length === 0) {
      localStorage.removeItem(STORAGE_PENDING_REACTIONS);
    } else {
      localStorage.setItem(STORAGE_PENDING_REACTIONS, JSON.stringify(queue));
    }
  } catch {}
}

/**
 * Mengambil antrean rating dari localStorage
 */
function getPendingRatings(): Record<string, QueuedRating> {
  try {
    const raw = localStorage.getItem(STORAGE_PENDING_RATINGS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePendingRatings(queue: Record<string, QueuedRating>) {
  try {
    if (Object.keys(queue).length === 0) {
      localStorage.removeItem(STORAGE_PENDING_RATINGS);
    } else {
      localStorage.setItem(STORAGE_PENDING_RATINGS, JSON.stringify(queue));
    }
  } catch {}
}

/**
 * Mengambil antrean views dari localStorage
 */
function getPendingViews(): Record<string, QueuedView> {
  try {
    const raw = localStorage.getItem(STORAGE_PENDING_VIEWS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePendingViews(queue: Record<string, QueuedView>) {
  try {
    if (Object.keys(queue).length === 0) {
      localStorage.removeItem(STORAGE_PENDING_VIEWS);
    } else {
      localStorage.setItem(STORAGE_PENDING_VIEWS, JSON.stringify(queue));
    }
  } catch {}
}

/**
 * Mengambil antrean reading history dari localStorage
 */
function getPendingHistory(): Record<string, QueuedHistory> {
  try {
    const raw = localStorage.getItem(STORAGE_PENDING_HISTORY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePendingHistory(queue: Record<string, QueuedHistory>) {
  try {
    if (Object.keys(queue).length === 0) {
      localStorage.removeItem(STORAGE_PENDING_HISTORY);
    } else {
      localStorage.setItem(STORAGE_PENDING_HISTORY, JSON.stringify(queue));
    }
  } catch {}
}

/**
 * Catat reaksi ke antrean lokal (tanpa membebani Firebase saat pengguna spam klik)
 */
export function queueReactionChange(
  reactionKey: string,
  targetReaction: ReactionType,
  currentReaction: ReactionType | null,
  novelId: string,
  chapterId: string
): ReactionType | null {
  const nextReaction: ReactionType | null = currentReaction === targetReaction ? null : targetReaction;
  
  const queue = getPendingReactions();
  const existing = queue[reactionKey];

  if (!existing) {
    // Reaksi pertama dalam sesi ini
    queue[reactionKey] = {
      reactionKey,
      novelId,
      chapterId,
      initialReaction: currentReaction,
      finalReaction: nextReaction,
      timestamp: Date.now()
    };
  } else {
    // Pengguna terus mengklik / spam ganti reaksi:
    // Cukup perbarui finalReaction saja, initialReaction tetap yang asli sebelum sesi mulai
    existing.finalReaction = nextReaction;
    existing.timestamp = Date.now();
    
    // Jika ternyata finalReaction sama persis dengan initialReaction (net change = 0), bisa dihapus dari antrean
    if (existing.finalReaction === existing.initialReaction) {
      delete queue[reactionKey];
    }
  }

  savePendingReactions(queue);
  return nextReaction;
}

/**
 * Catat rating ke antrean lokal (tanpa membebani Firebase saat pengguna spam ganti bintang)
 */
export function queueRatingChange(
  novelId: string,
  selectedStar: number,
  currentRating: number | null
): { nextUserRating: number | null; ratingDelta: number } {
  // Toggle: klik bintang yang sama = batalkan/reset (null)
  const nextUserRating = currentRating === selectedStar ? null : selectedStar;
  
  const queue = getPendingRatings();
  const existing = queue[novelId];

  if (!existing) {
    queue[novelId] = {
      novelId,
      initialRating: currentRating,
      finalRating: nextUserRating,
      timestamp: Date.now()
    };
  } else {
    existing.finalRating = nextUserRating;
    existing.timestamp = Date.now();

    if (existing.finalRating === existing.initialRating) {
      delete queue[novelId];
    }
  }

  savePendingRatings(queue);
  
  // Hitung delta skor untuk update optimis lokal
  const oldScore = currentRating || 0;
  const newScore = nextUserRating || 0;
  const ratingDelta = newScore - oldScore;

  return { nextUserRating, ratingDelta };
}

/**
 * Catat views ke antrean lokal
 */
export function queueViewIncrement(novelId: string, chapterId: string) {
  const queue = getPendingViews();
  const key = `${novelId}_${chapterId}`;
  
  if (!queue[key]) {
    queue[key] = {
      novelId,
      chapterId,
      count: 1
    };
  } else {
    queue[key].count += 1;
  }

  savePendingViews(queue);
}

/**
 * Catat reading history ke antrean lokal
 */
export function queueReadingHistory(
  novelId: string,
  chapterId: string,
  chapterTitle?: string,
  chapterNumber?: number
) {
  const queue = getPendingHistory();
  queue[novelId] = {
    novelId,
    chapterId,
    chapterTitle,
    chapterNumber,
    timestamp: Date.now()
  };
  savePendingHistory(queue);
}

/**
 * SINKRONISASI BATCH KE FIREBASE:
 * Mengirim semua antrean interaksi (reaksi, rating, view, riwayat baca) ke Firebase sekaligus.
 * Dipanggil saat:
 * 1. Aplikasi ditutup / diminimalkan (visibilitychange, pagehide)
 * 2. Aplikasi dibuka kembali (on startup) sebagai jaminan jika sebelumnya tertunda
 */
export async function flushPendingSyncQueue(): Promise<void> {
  if (isFlushing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    // Masih offline, simpan di localStorage untuk nanti
    return;
  }
  if (!db) return;

  const reactionsQueue = getPendingReactions();
  const ratingsQueue = getPendingRatings();
  const viewsQueue = getPendingViews();
  const historyQueue = getPendingHistory();

  const totalPending = 
    Object.keys(reactionsQueue).length + 
    Object.keys(ratingsQueue).length + 
    Object.keys(viewsQueue).length + 
    Object.keys(historyQueue).length;

  if (totalPending === 0) return;

  isFlushing = true;

  try {
    const user = await ensureAuth();
    const userId = user?.uid || 'anonymous';

    // 1. SINKRONKAN REAKSI (Batch / Transaksi per bab yang berubah)
    const reactionKeys = Object.keys(reactionsQueue);
    for (const rKey of reactionKeys) {
      const item = reactionsQueue[rKey];
      if (!item || item.initialReaction === item.finalReaction) {
        delete reactionsQueue[rKey];
        continue;
      }

      try {
        const docRef = doc(db, 'chapter_reactions', item.reactionKey);
        const derivedNovelId = item.novelId.replace(/\//g, '_').trim();
        const novelDocRef = doc(db, 'novel_reactions', derivedNovelId);

        await runTransaction(db, async (t) => {
          const docSnap = await t.get(docRef);
          const novelSnap = await t.get(novelDocRef);

          const chData = docSnap.exists() ? docSnap.data() : {};
          const currentCounts: ReactionCounts = {
            fire: Math.max(0, Number(chData.fire) || 0),
            love: Math.max(0, Number(chData.love) || 0),
            sad: Math.max(0, Number(chData.sad) || 0),
            shock: Math.max(0, Number(chData.shock) || 0),
            clap: Math.max(0, Number(chData.clap) || 0)
          };

          // Kurangi initial jika ada
          if (item.initialReaction) {
            currentCounts[item.initialReaction] = Math.max(0, currentCounts[item.initialReaction] - 1);
          }
          // Tambah final jika ada
          if (item.finalReaction) {
            currentCounts[item.finalReaction] = (currentCounts[item.finalReaction] || 0) + 1;
          }

          t.set(docRef, {
            ...currentCounts,
            novelId: derivedNovelId,
            chapterId: item.chapterId,
            updatedAt: serverTimestamp()
          }, { merge: true });

          // Perbarui juga novel aggregated reactions
          if (novelSnap) {
            const nData = novelSnap.exists() ? novelSnap.data() : {};
            const novelCounts: ReactionCounts = {
              fire: Math.max(0, Number(nData.fire) || 0),
              love: Math.max(0, Number(nData.love) || 0),
              sad: Math.max(0, Number(nData.sad) || 0),
              shock: Math.max(0, Number(nData.shock) || 0),
              clap: Math.max(0, Number(nData.clap) || 0)
            };

            if (item.initialReaction) {
              novelCounts[item.initialReaction] = Math.max(0, novelCounts[item.initialReaction] - 1);
            }
            if (item.finalReaction) {
              novelCounts[item.finalReaction] = (novelCounts[item.finalReaction] || 0) + 1;
            }

            const total = novelCounts.fire + novelCounts.love + novelCounts.sad + novelCounts.shock + novelCounts.clap;
            t.set(novelDocRef, {
              ...novelCounts,
              total,
              novelId: derivedNovelId,
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
        });

        delete reactionsQueue[rKey];
        savePendingReactions(reactionsQueue);
      } catch (err) {
        console.warn('Error syncing reaction to Firestore:', err);
      }
    }

    // 2. SINKRONKAN RATING
    const ratingNovelIds = Object.keys(ratingsQueue);
    for (const nId of ratingNovelIds) {
      const item = ratingsQueue[nId];
      if (!item || item.initialRating === item.finalRating) {
        delete ratingsQueue[nId];
        continue;
      }

      try {
        const userRatingDocRef = doc(db, 'novel_user_ratings', `${item.novelId}_${userId}`);
        const statsDocRef = doc(db, 'novel_rating_stats', item.novelId);

        await runTransaction(db, async (t) => {
          const statsSnap = await t.get(statsDocRef);
          let currentScore = 0;
          let currentRaters = 0;

          if (statsSnap.exists()) {
            const sData = statsSnap.data();
            currentScore = Math.max(0, Number(sData.totalScore) || 0);
            currentRaters = Math.max(0, Number(sData.totalRaters) || 0);
          }

          if (item.finalRating === null) {
            // User membatalkan rating
            t.delete(userRatingDocRef);
            if (item.initialRating) {
              currentScore = Math.max(0, currentScore - item.initialRating);
              currentRaters = Math.max(0, currentRaters - 1);
            }
          } else {
            // User memberi atau mengubah rating
            t.set(userRatingDocRef, {
              novelId: item.novelId,
              userId,
              rating: item.finalRating,
              updatedAt: serverTimestamp()
            });

            if (item.initialRating) {
              currentScore = Math.max(0, currentScore - item.initialRating + item.finalRating);
            } else {
              currentScore = currentScore + item.finalRating;
              currentRaters = currentRaters + 1;
            }
          }

          const avg = currentRaters > 0 ? currentScore / currentRaters : 0;
          t.set(statsDocRef, {
            novelId: item.novelId,
            totalScore: currentScore,
            totalRaters: currentRaters,
            averageRating: Number(avg.toFixed(2)),
            updatedAt: serverTimestamp()
          });
        });

        delete ratingsQueue[nId];
        savePendingRatings(ratingsQueue);
      } catch (err) {
        console.warn('Error syncing rating to Firestore:', err);
      }
    }

    // 3. SINKRONKAN VIEWS
    const viewKeys = Object.keys(viewsQueue);
    for (const vKey of viewKeys) {
      const item = viewsQueue[vKey];
      if (!item || item.count <= 0) {
        delete viewsQueue[vKey];
        continue;
      }

      try {
        const viewStatsRef = doc(db, 'novel_view_stats', item.novelId);
        await setDoc(viewStatsRef, {
          novelId: item.novelId,
          totalViews: increment(item.count),
          lastViewedAt: serverTimestamp()
        }, { merge: true });

        const chapterViewRef = doc(db, 'chapter_view_stats', `${item.novelId}_${item.chapterId}`);
        await setDoc(chapterViewRef, {
          novelId: item.novelId,
          chapterId: item.chapterId,
          views: increment(item.count),
          lastViewedAt: serverTimestamp()
        }, { merge: true });

        delete viewsQueue[vKey];
        savePendingViews(viewsQueue);
      } catch (err) {
        console.warn('Error syncing views to Firestore:', err);
      }
    }

    // 4. SINKRONKAN READING HISTORY
    const historyNovelIds = Object.keys(historyQueue);
    for (const hNovelId of historyNovelIds) {
      const item = historyQueue[hNovelId];
      if (!item) {
        delete historyQueue[hNovelId];
        continue;
      }

      try {
        const historyDocRef = doc(db, 'reading_history', `${userId}_${item.novelId}`);
        await setDoc(historyDocRef, {
          userId,
          novelId: item.novelId,
          lastReadChapterId: item.chapterId,
          lastReadChapterTitle: item.chapterTitle || '',
          lastReadChapterNumber: item.chapterNumber || 0,
          updatedAt: serverTimestamp()
        }, { merge: true });

        delete historyQueue[hNovelId];
        savePendingHistory(historyQueue);
      } catch (err) {
        console.warn('Error syncing history to Firestore:', err);
      }
    }

  } catch (error) {
    console.warn('BatchSync execution error:', error);
  } finally {
    isFlushing = false;
  }
}

/**
 * Inisialisasi listener lifecycle aplikasi untuk flush otomatis saat tutup/buka
 */
export function initBatchSyncLifecycle() {
  if (typeof window === 'undefined') return;

  // 1. Saat aplikasi diminimalkan / pindah tab / latar belakang
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingSyncQueue();
    }
  });

  // 2. Saat jendela ditutup atau navigasi keluar
  window.addEventListener('pagehide', () => {
    flushPendingSyncQueue();
  });

  window.addEventListener('beforeunload', () => {
    flushPendingSyncQueue();
  });

  // 3. Saat koneksi internet kembali nyala
  window.addEventListener('online', () => {
    flushPendingSyncQueue();
  });

  // 4. Jaminan keamanan: Begitu aplikasi dibuka, kirim sisa antrean yang tertunda sebelumnya
  setTimeout(() => {
    flushPendingSyncQueue();
  }, 1500);
}
