import { 
  doc, 
  onSnapshot, 
  runTransaction, 
  setDoc, 
  updateDoc,
  serverTimestamp, 
  deleteDoc,
  increment,
  Unsubscribe 
} from 'firebase/firestore';
import { db, ensureAuth } from '../firebase';
import { 
  queueRatingChange, 
  queueReadingHistory, 
  queueViewIncrement 
} from './batchSyncService';

export interface RatingStats {
  average: number;
  totalRaters: number;
  userRating: number | null;
}

export interface ReadingHistoryItem {
  chapterId: string;
  chapterTitle?: string;
  chapterNumber?: number;
  updatedAt?: any;
}

// Key helpers for localStorage cache
const getLocalRatingKey = (novelId: string, userId: string) => `user_novel_rating_${novelId}_${userId}`;
const getLocalStatsKey = (novelId: string) => `novel_rating_stats_${novelId}`;
const getLocalHistoryKey = (novelId: string) => `reading_history_${novelId}`;

/**
 * Mendengarkan secara real-time rating rata-rata novel dan rating milik user saat ini
 */
export function listenToNovelRating(
  novelId: string,
  initialFallbackRating: number = 0,
  onUpdate: (stats: RatingStats) => void
): () => void {
  if (!db || !novelId) {
    onUpdate({ average: initialFallbackRating, totalRaters: initialFallbackRating > 0 ? 1 : 0, userRating: null });
    return () => {};
  }

  let isCancelled = false;
  const unsubs: Unsubscribe[] = [];

  let currentAverage = initialFallbackRating;
  let currentTotalRaters = initialFallbackRating > 0 ? 1 : 0;
  let currentUserRating: number | null = null;

  // Baca cache localStorage terlebih dahulu untuk tampilan instan tanpa flicker
  try {
    const cachedStatsRaw = localStorage.getItem(getLocalStatsKey(novelId));
    if (cachedStatsRaw) {
      const parsed = JSON.parse(cachedStatsRaw);
      if (typeof parsed?.average === 'number') {
        currentAverage = parsed.average;
        currentTotalRaters = parsed.totalRaters || 0;
      }
    }
  } catch {}

  const emit = () => {
    if (isCancelled) return;
    onUpdate({
      average: Number(currentAverage.toFixed(1)),
      totalRaters: currentTotalRaters,
      userRating: currentUserRating
    });
  };

  emit();

  ensureAuth().then((user) => {
    if (isCancelled || !db) return;
    const userId = user?.uid || 'anonymous';

    // Baca user rating lokal
    try {
      const cachedUserRating = localStorage.getItem(getLocalRatingKey(novelId, userId));
      if (cachedUserRating) {
        const num = Number(cachedUserRating);
        if (num >= 1 && num <= 5) {
          currentUserRating = num;
          emit();
        }
      }
    } catch {}

    // 1. Listen to novel_rating_stats doc
    try {
      const statsRef = doc(db, 'novel_rating_stats', novelId);
      const unsubStats = onSnapshot(statsRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const totalScore = Number(data.totalScore) || 0;
          const totalRaters = Number(data.totalRaters) || 0;
          const avg = totalRaters > 0 ? totalScore / totalRaters : 0;
          currentAverage = avg;
          currentTotalRaters = totalRaters;
          try {
            localStorage.setItem(getLocalStatsKey(novelId), JSON.stringify({ average: avg, totalRaters }));
          } catch {}
        } else if (initialFallbackRating > 0) {
          currentAverage = initialFallbackRating;
          currentTotalRaters = 1;
        } else {
          currentAverage = 0;
          currentTotalRaters = 0;
        }
        emit();
      }, (err) => {
        console.warn('Silent fallback listening to rating stats:', err);
      });
      unsubs.push(unsubStats);
    } catch (e) {
      console.warn('Error attaching stats listener:', e);
    }

    // 2. Listen to user's personal rating doc
    try {
      const userRatingDocRef = doc(db, 'novel_user_ratings', `${novelId}_${userId}`);
      const unsubUser = onSnapshot(userRatingDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const r = Number(data.rating);
          currentUserRating = (r >= 1 && r <= 5) ? r : null;
          try {
            if (currentUserRating) {
              localStorage.setItem(getLocalRatingKey(novelId, userId), String(currentUserRating));
            } else {
              localStorage.removeItem(getLocalRatingKey(novelId, userId));
            }
          } catch {}
        } else {
          currentUserRating = null;
          try {
            localStorage.removeItem(getLocalRatingKey(novelId, userId));
          } catch {}
        }
        emit();
      }, (err) => {
        console.warn('Silent fallback listening to user rating:', err);
      });
      unsubs.push(unsubUser);
    } catch (e) {
      console.warn('Error attaching user rating listener:', e);
    }
  });

  return () => {
    isCancelled = true;
    unsubs.forEach((fn) => {
      try { fn(); } catch {}
    });
  };
}

/**
 * Toggle / ubah rating dari user pada sebuah novel secara instan dan hemat Firebase:
 * - Skor dan status bintang langsung diperbarui di antrean lokal (Optimistic UI).
 * - Pengguna bebas mengklik / mengganti rating sepuasnya tanpa memicu transaksi Firebase berulang.
 * - Perubahan final akan disinkronkan ke Firebase secara otomatis saat aplikasi ditutup atau dibuka kembali.
 */
export async function toggleNovelUserRating(
  novelId: string,
  selectedStar: number,
  initialFallbackRating: number = 0
): Promise<RatingStats> {
  const user = await ensureAuth();
  const userId = user?.uid || 'anonymous';

  // Baca status rating user saat ini dari cache
  let currentRating: number | null = null;
  try {
    const cached = localStorage.getItem(getLocalRatingKey(novelId, userId));
    if (cached) {
      const num = Number(cached);
      if (num >= 1 && num <= 5) currentRating = num;
    }
  } catch {}

  // Baca statistik rating saat ini dari cache
  let currentAverage = initialFallbackRating;
  let currentTotalRaters = initialFallbackRating > 0 ? 1 : 0;
  try {
    const rawStats = localStorage.getItem(getLocalStatsKey(novelId));
    if (rawStats) {
      const parsed = JSON.parse(rawStats);
      if (typeof parsed?.average === 'number') {
        currentAverage = parsed.average;
        currentTotalRaters = parsed.totalRaters || 0;
      }
    }
  } catch {}

  // Catat perubahan ke antrean sinkronisasi batch
  const { nextUserRating } = queueRatingChange(novelId, selectedStar, currentRating);

  // Hitung ulang average dan total raters secara instan (optimistic)
  let nextTotalScore = currentAverage * currentTotalRaters;
  let nextTotalRaters = currentTotalRaters;

  if (currentRating === selectedStar) {
    // Pengguna membatalkan rating miliknya
    nextTotalScore = Math.max(0, nextTotalScore - selectedStar);
    nextTotalRaters = Math.max(0, currentTotalRaters - 1);
  } else if (currentRating !== null && currentRating > 0) {
    // Pengguna mengganti rating
    nextTotalScore = Math.max(0, nextTotalScore - currentRating + selectedStar);
  } else {
    // Rating baru
    nextTotalScore = nextTotalScore + selectedStar;
    nextTotalRaters = currentTotalRaters + 1;
  }

  const nextAverage = nextTotalRaters > 0 ? nextTotalScore / nextTotalRaters : 0;

  const result: RatingStats = {
    average: Number(nextAverage.toFixed(1)),
    totalRaters: nextTotalRaters,
    userRating: nextUserRating
  };

  // Simpan ke localStorage agar UI tetap konsisten dan instan
  try {
    if (nextUserRating) {
      localStorage.setItem(getLocalRatingKey(novelId, userId), String(nextUserRating));
    } else {
      localStorage.removeItem(getLocalRatingKey(novelId, userId));
    }
    localStorage.setItem(getLocalStatsKey(novelId), JSON.stringify({
      average: result.average,
      totalRaters: result.totalRaters
    }));
  } catch {}

  return result;
}

/**
 * Menyimpan bab terakhir yang dibaca user ke cache instan dan antrean batch Firebase
 */
export async function saveReadingHistory(
  novelId: string,
  chapterId: string,
  chapterTitle?: string,
  chapterNumber?: number
): Promise<void> {
  if (!novelId || !chapterId) return;

  const item: ReadingHistoryItem = {
    chapterId,
    chapterTitle: chapterTitle || '',
    chapterNumber: chapterNumber || 0
  };

  // 1. Simpan langsung ke localStorage untuk akses instan tanpa jeda
  try {
    localStorage.setItem(getLocalHistoryKey(novelId), JSON.stringify({
      ...item,
      updatedAt: Date.now()
    }));
  } catch {}

  // 2. Masukkan ke antrean batch sync (tanpa request Firebase saat ganti bab)
  queueReadingHistory(novelId, chapterId, chapterTitle, chapterNumber);
}

/**
 * Mendengarkan riwayat bab terakhir yang dibaca user untuk novel tertentu
 */
export function listenToReadingHistory(
  novelId: string,
  onUpdate: (history: ReadingHistoryItem | null) => void
): () => void {
  if (!novelId) {
    onUpdate(null);
    return () => {};
  }

  let isCancelled = false;
  let currentItem: ReadingHistoryItem | null = null;

  // 1. Baca localStorage terlebih dahulu agar tombol langsung akurat
  try {
    const raw = localStorage.getItem(getLocalHistoryKey(novelId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.chapterId) {
        currentItem = {
          chapterId: parsed.chapterId,
          chapterTitle: parsed.chapterTitle,
          chapterNumber: parsed.chapterNumber
        };
        onUpdate(currentItem);
      }
    }
  } catch {}

  // 2. Dengarkan dari Firestore secara real-time
  let unsubFirestore: Unsubscribe | null = null;

  ensureAuth().then((user) => {
    if (isCancelled || !db) return;
    const userId = user?.uid || 'anonymous';

    try {
      const historyDocRef = doc(db, 'reading_history', `${userId}_${novelId}`);
      unsubFirestore = onSnapshot(historyDocRef, (snap) => {
        if (isCancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          const chId = data.lastReadChapterId || data.chapterId;
          if (chId) {
            const item: ReadingHistoryItem = {
              chapterId: String(chId),
              chapterTitle: data.lastReadChapterTitle || data.chapterTitle,
              chapterNumber: typeof data.lastReadChapterNumber === 'number' ? data.lastReadChapterNumber : data.chapterNumber
            };
            currentItem = item;
            onUpdate(item);
            try {
              localStorage.setItem(getLocalHistoryKey(novelId), JSON.stringify(item));
            } catch {}
          }
        }
      }, (err) => {
        console.warn('Silent fallback reading history listener:', err);
      });
    } catch (e) {
      console.warn('Error setting up reading history listener:', e);
    }
  });

  return () => {
    isCancelled = true;
    if (unsubFirestore) {
      try { unsubFirestore(); } catch {}
    }
  };
}

/**
 * Mendengarkan penambahan total views novel secara real-time dari Firestore
 */
export function listenToNovelViews(
  novelId: string,
  initialBaseViews: number = 0,
  onUpdate: (views: number) => void
): () => void {
  if (!db || !novelId) {
    onUpdate(initialBaseViews);
    return () => {};
  }

  let isCancelled = false;
  let currentViews = initialBaseViews;

  // Baca cache localStorage terlebih dahulu
  try {
    const cached = localStorage.getItem(`novel_views_${novelId}`);
    if (cached && !isNaN(Number(cached))) {
      currentViews = Math.max(initialBaseViews, Number(cached));
    }
  } catch {}

  onUpdate(currentViews);

  let unsubFirestore: Unsubscribe | null = null;

  ensureAuth().then(() => {
    if (isCancelled || !db) return;

    try {
      const statsRef = doc(db, 'novel_view_stats', novelId);
      unsubFirestore = onSnapshot(statsRef, (snap) => {
        if (isCancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          const countedViews = Number(data.totalViews) || 0;
          // Gunakan nilai terbesar antara base data awal novel dan akumulasi counter Firestore
          const finalViews = Math.max(initialBaseViews, countedViews);
          currentViews = finalViews;
          onUpdate(finalViews);
          try {
            localStorage.setItem(`novel_views_${novelId}`, String(finalViews));
          } catch {}
        }
      }, (err) => {
        console.warn('Silent fallback listening to novel views:', err);
      });
    } catch (e) {
      console.warn('Error setting up novel views listener:', e);
    }
  });

  return () => {
    isCancelled = true;
    if (unsubFirestore) {
      try { unsubFirestore(); } catch {}
    }
  };
}

/**
 * Mencatat penambahan view ketika bab dibaca di ChapterReader.
 * Menggunakan sessionStorage anti-spam per sesi (hanya bertambah 1x per bab dalam 1 sesi pembacaan).
 */
export async function recordNovelAndChapterView(
  novelId: string,
  chapterId: string
): Promise<void> {
  if (!db || !novelId || !chapterId) return;

  // Cek anti-spam per sesi browser
  const sessionKey = `viewed_${novelId}_${chapterId}`;
  try {
    if (sessionStorage.getItem(sessionKey)) {
      // Sudah dihitung di sesi ini, hindari duplikasi spam
      return;
    }
    sessionStorage.setItem(sessionKey, '1');
  } catch {}

  // Masukkan ke antrean batch sync dan update cache lokal secara instan
  queueViewIncrement(novelId, chapterId);

  // Perbarui cache tampilan lokal agar angka pembaca langsung naik di UI
  try {
    const cachedViewsKey = `novel_views_${novelId}`;
    const prevViews = Number(localStorage.getItem(cachedViewsKey)) || 0;
    localStorage.setItem(cachedViewsKey, String(prevViews + 1));
  } catch {}
}

