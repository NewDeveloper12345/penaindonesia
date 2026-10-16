import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  onSnapshot, 
  query, 
  where 
} from 'firebase/firestore';
import { db, ensureAuth } from '../firebase';
import { Novel, Chapter, Character, SeriesGroup, Announcement } from '../types';

const CACHE_NOVELS_KEY = 'novel_reader_cached_novels';

export function parseTimestamp(t: any): number {
  if (!t) return 0;
  if (typeof t === 'number') return t < 1e10 ? t * 1000 : t;
  if (t && typeof t.toMillis === 'function') return t.toMillis();
  if (t && typeof t.toDate === 'function') return t.toDate().getTime();
  if (t && typeof t.seconds === 'number') return t.seconds * 1000 + (t.nanoseconds ? Math.floor(t.nanoseconds / 1e6) : 0);
  if (typeof t === 'string') {
    const e = Date.parse(t);
    if (!isNaN(e)) return e;
  }
  return 0;
}

export function parseAnnouncement(id: string, data: any): Announcement | null {
  if (!data || typeof data !== 'object') return null;
  const content = data.isi || data.content || data.pesan || data.message || data.text || data.teks || data.pengumuman || data.deskripsi || data.description || data.body;
  if (!content || typeof content !== 'string' || !content.trim()) return null;
  const title = data.judul || data.title || data.name || data.nama || data.subject;
  const author = data.penulis || data.author || data.admin || data.pembuat || data.creator;
  const createdAt = data.dibuatPada || data.createdAt || data.created_at || data.tanggal || data.date || data.timestamp;
  const expiredAt = data.expiredAt || data.kadaluarsaPada || data.expiresAt || data.expireAt || data.berlakuHingga || data.expired_at || data.expiryDate;
  return {
    id: data.id || id,
    title: title ? String(title).trim() : undefined,
    content: String(content).trim(),
    author: author ? String(author).trim() : undefined,
    createdAt,
    expiredAt
  };
}

export function subscribeToAnnouncements(
  onUpdate: (data: Announcement[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!db) {
    onUpdate([]);
    return () => {};
  }
  const map = new Map<string, Announcement>();
  const emit = () => {
    const now = Date.now();
    const list = Array.from(map.values()).filter((item) => {
      if (!item.expiredAt) return true;
      const exp = parseTimestamp(item.expiredAt);
      return exp === 0 ? true : exp > now;
    });
    list.sort((a, b) => {
      const timeA = parseTimestamp(a.createdAt);
      const timeB = parseTimestamp(b.createdAt);
      return timeB - timeA;
    });
    onUpdate(list);
  };

  const unsubs: (() => void)[] = [];
  let isCancelled = false;

  ensureAuth().then(() => {
    if (isCancelled || !db) return;
    try {
      const q = collection(db, 'announcements');
      const unsub = onSnapshot(
        q,
        (snap) => {
          if (isCancelled) return;
          map.clear();
          snap.docs.forEach((docSnap) => {
            const item = parseAnnouncement(docSnap.id, docSnap.data());
            if (item) map.set(item.id, item);
          });
          emit();
        },
        (err) => {
          console.warn('Error subscribing to announcements collection:', err);
          onError && onError(err);
        }
      );
      unsubs.push(unsub);
    } catch (e) {
      console.warn('Error setting up announcements listener:', e);
      onError && onError(e);
    }
  }).catch((err) => {
    onError && onError(err);
  });

  const timer = setInterval(() => {
    if (!isCancelled) emit();
  }, 30000);

  return () => {
    isCancelled = true;
    clearInterval(timer);
    unsubs.forEach((u) => {
      try { u(); } catch {}
    });
  };
}

export function normalizeChapterContent(raw: any): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') {
    let trimmed = raw.trim();
    if (!trimmed) return '';
    // Check if raw is a JSON string of array or object
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeChapterContent(parsed);
      } catch {}
    }
    // Unescape literal \n or \r\n if needed
    if (trimmed.includes('\\n') && !trimmed.includes('\n')) {
      trimmed = trimmed.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
    }
    return trimmed;
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => normalizeChapterContent(item))
      .filter((s) => s.length > 0)
      .join('\n\n');
  }
  if (typeof raw === 'object') {
    // Check Quill ops format
    if (Array.isArray(raw.ops)) {
      return raw.ops
        .map((op: any) => (typeof op?.insert === 'string' ? op.insert : ''))
        .join('');
    }
    // Check EditorJS blocks format
    if (Array.isArray(raw.blocks)) {
      return raw.blocks
        .map((b: any) => b?.data?.text || b?.text || '')
        .filter((s: string) => Boolean(s && s.trim()))
        .join('\n\n');
    }
    // Check standard content properties in object
    const propCandidates = [
      raw.isi, raw.content, raw.body, raw.text, raw.teks,
      raw.naskah, raw.cerita, raw.konten, raw.isiBab, raw.isi_bab,
      raw.value, raw.raw, raw.html, raw.markdown, raw.data
    ];
    for (const p of propCandidates) {
      if (p) {
        const norm = normalizeChapterContent(p);
        if (norm) return norm;
      }
    }
    return '';
  }
  return String(raw).trim();
}

export function getExplicitChapterTitle(data: any): string | null {
  if (!data) return null;
  if (typeof data === 'string') {
    const s = data.trim();
    if (!s) return null;
    return /^\d+$/.test(s) ? `Bab ${s}` : s;
  }

  // 1. Look for genuine title candidates
  const primaryTitle = data.judul ?? data.title ?? data.namaBab ?? data.nama_bab ??
                       data.judulBab ?? data.judul_bab ?? data.chapterTitle ?? data.chapter_title ??
                       data.chapterName ?? data.chapter_name ?? data.bab_title ?? data.title_chapter ??
                       data.nama ?? data.name ?? data.subjudul ?? data.subtitle;

  let titleStr = '';
  if (typeof primaryTitle === 'string') {
    titleStr = primaryTitle.trim();
  } else if (typeof primaryTitle === 'number') {
    titleStr = `Bab ${primaryTitle}`;
  } else if (typeof primaryTitle === 'object' && primaryTitle !== null) {
    titleStr = String(primaryTitle.title || primaryTitle.judul || primaryTitle.nama || primaryTitle.text || '').trim();
  }

  // 2. If primary title is missing or empty, check bab / label / header fields
  if (!titleStr || titleStr.toLowerCase() === 'undefined' || titleStr.toLowerCase() === 'null') {
    if (typeof data.bab === 'string' && data.bab.trim()) {
      titleStr = data.bab.trim();
    } else if (typeof data.label === 'string' && data.label.trim()) {
      titleStr = data.label.trim();
    } else if (typeof data.header === 'string' && data.header.trim()) {
      titleStr = data.header.trim();
    } else if (typeof data.caption === 'string' && data.caption.trim()) {
      titleStr = data.caption.trim();
    }
  }

  if (!titleStr || titleStr.toLowerCase() === 'undefined' || titleStr.toLowerCase() === 'null') {
    return null;
  }

  // 3. If title is purely digits like "1", format as "Bab 1"
  if (/^\d+$/.test(titleStr)) {
    titleStr = `Bab ${titleStr}`;
  }

  // 4. If title is generic like "Bab 1" and a subtitle exists
  const subCandidate = data.subjudul ?? data.subtitle ?? data.nama ?? data.nama_bab;
  if (typeof subCandidate === 'string' && subCandidate.trim()) {
    const sub = subCandidate.trim();
    if (/^bab\s+\d+$/i.test(titleStr) && !titleStr.toLowerCase().includes(sub.toLowerCase())) {
      titleStr = `${titleStr}: ${sub}`;
    }
  }

  return titleStr;
}

export function extractTitleChapterNumber(title: string): number | null {
  if (!title) return null;
  const t = title.trim();
  if (/prolog/i.test(t)) return 0;
  if (/epilog/i.test(t)) return 999999;
  const match = t.match(/(?:bab|chapter|ch|ep|episode|bagian|part)\s*(\d+)/i);
  if (match) return parseInt(match[1], 10);
  const pureNum = t.match(/^(\d+)$/);
  if (pureNum) return parseInt(pureNum[1], 10);
  return null;
}

export function extractChapterTitle(data: any, index: number, chapterNumber?: number, order?: number): string {
  const explicit = getExplicitChapterTitle(data);
  if (explicit) return explicit;
  const fallbackNum = chapterNumber || order || (index + 1);
  return `Bab ${fallbackNum}`;
}

export function formatChapterDisplayTitle(chap: Chapter, index?: number): string {
  const rawTitle = (chap?.title || '').trim();
  if (rawTitle) {
    return rawTitle;
  }
  return `Bab ${(typeof index === 'number' ? index + 1 : (chap?.order || 1))}`;
}

export function parseChapter(id: string, data: any, index: number = 0): Chapter {
  if (typeof data === 'string') {
    return {
      id,
      title: `Bab ${index + 1}`,
      content: normalizeChapterContent(data),
      order: index + 1,
      chapterNumber: index + 1,
      coinPrice: 0,
      hasExplicitTitle: false
    };
  }

  // 1. Extract explicit title if author wrote one
  const explicitTitle = getExplicitChapterTitle(data);
  const hasExplicitTitle = Boolean(explicitTitle);
  const rawTitle = explicitTitle || extractChapterTitle(data, index);
  const isProlog = /prolog/i.test(rawTitle);
  const isEpilog = /epilog/i.test(rawTitle);
  const titleNumber = extractTitleChapterNumber(rawTitle);

  let orderNum = typeof data?.urutan === 'number'
    ? data.urutan
    : typeof data?.order === 'number'
    ? data.order
    : typeof data?.orderIndex === 'number'
    ? data.orderIndex
    : typeof data?.nomor === 'number'
    ? data.nomor
    : typeof data?.nomorBab === 'number'
    ? data.nomorBab
    : typeof data?.chapterNumber === 'number'
    ? data.chapterNumber
    : typeof data?.no === 'number'
    ? data.no
    : (titleNumber !== null ? titleNumber : (isProlog ? 0 : (isEpilog ? 999999 : index + 1)));

  // If this chapter has an explicit title number, enforce it when no explicit numeric fields
  if (isProlog) {
    orderNum = 0;
  } else if (isEpilog) {
    orderNum = 999999;
  } else if (titleNumber !== null && typeof data?.order !== 'number' && typeof data?.urutan !== 'number' && typeof data?.nomor !== 'number') {
    orderNum = titleNumber;
  }

  let chapterNumber = typeof data?.chapterNumber === 'number'
    ? data.chapterNumber
    : typeof data?.nomor === 'number'
    ? data.nomor
    : typeof data?.nomorBab === 'number'
    ? data.nomorBab
    : (titleNumber !== null ? titleNumber : (isProlog ? 0 : orderNum));

  const title = rawTitle;

  const rawContent = data?.isi ?? data?.content ?? data?.body ?? data?.text ??
                     data?.teks ?? data?.naskah ?? data?.cerita ?? data?.isiBab ??
                     data?.isi_bab ?? data?.konten ?? data?.isiCerita ?? data?.isi_cerita ??
                     data?.story ?? data?.textContent ?? data?.text_content ??
                     data?.paragraphs ?? data?.paragraf ?? data?.lines ??
                     data?.data ?? data?.raw ?? data?.html ?? data?.markdown ?? data?.text_body;

  const content = normalizeChapterContent(rawContent);

  let isLocked: boolean | undefined;
  if (typeof data?.isLocked === 'boolean') isLocked = data.isLocked;
  else if (typeof data?.terkunci === 'boolean') isLocked = data.terkunci;
  else if (typeof data?.locked === 'boolean') isLocked = data.locked;
  else if (data?.isFree === true || data?.gratis === true) isLocked = false;
  else if (data?.isFree === false || data?.gratis === false) isLocked = true;

  let views = 0;
  if (typeof data?.views === 'number') views = data.views;
  else if (typeof data?.viewCount === 'number') views = data.viewCount;
  else if (typeof data?.dibaca === 'number') views = data.dibaca;
  else if (typeof data?.readCount === 'number') views = data.readCount;
  else if (typeof data?.view === 'number') views = data.view;
  else if (typeof data?.pembaca === 'number') views = data.pembaca;
  else if (data?.views && !isNaN(Number(data.views))) views = Number(data.views);

  let coinPrice = 0;
  const rawCoin = data?.coinPrice ?? data?.price ?? data?.koin ?? data?.hargaKoin ?? data?.coinCost ?? data?.harga ?? data?.coins;
  if (rawCoin !== undefined && rawCoin !== null && String(rawCoin).trim() !== '') {
    const parsedNum = Number(rawCoin);
    if (!isNaN(parsedNum)) {
      coinPrice = Math.max(0, parsedNum);
    }
  }

  return {
    id: data?.pengenal || id,
    title,
    content,
    order: orderNum,
    chapterNumber,
    isLocked,
    views,
    coinPrice,
    hasExplicitTitle
  };
}

export function parseNovel(id: string, data: any): Novel | null {
  if (!data || typeof data !== 'object') return null;
  const title = data.judul || data.title || data.name || data.nama || data.judulNovel || data.bookTitle;
  if (!title && !data.bab && !data.chapters && !data.ringkasan && !data.sinopsis) return null;

  const author = data.pengarang || data.penulis || data.author || data.authorName || data.writer || data.creator;
  const genre = data.genre || data.genres || data.kategori || data.category;
  const synopsis = data.ringkasan || data.sinopsis || data.synopsis || data.description || data.deskripsi;
  const cover = data['URL sampul'] || data.URL_sampul || data.urlSampul || data.sampul || data.cover || data.coverUrl || data.coverImage || data.image || data.imageUrl;
  const seriesName = data.namaSeri || data.seriesName || data.seri || data.series || data.seriesTitle || data.nama_seri || data.series_name || data.judulSeri || data['nama seri'];
  const seriesBanner = data.seriesBanner || data.bannerSeri || data.banner || data.urlBannerSeri || data.bannerUrl || data.urlBanner || data.headerImage;
  const seriesCover = data.sampulSeri || data.seriesCover || data.coverSeri || data.series_cover || data.urlSampulSeri || data.URL_sampul_seri || data['URL sampul seri'] || data['sampul seri'];
  const seriesSynopsis = data.sinopsisSeri || data.seriesSynopsis || data.ringkasanSeri || data.series_synopsis || data.deskripsiSeri || data['sinopsis seri'] || data['ringkasan seri'];
  const customCover = data.customCover || data.coverCustom || data.sampulKustom;

  let seriesOrder: number | undefined;
  if (typeof data.seriesOrder === 'number') seriesOrder = data.seriesOrder;
  else if (typeof data.urutanSeri === 'number') seriesOrder = data.urutanSeri;
  else if (data.seriesOrder !== undefined && data.seriesOrder !== null && !isNaN(Number(data.seriesOrder))) seriesOrder = Number(data.seriesOrder);
  else if (data.urutanSeri !== undefined && data.urutanSeri !== null && !isNaN(Number(data.urutanSeri))) seriesOrder = Number(data.urutanSeri);

  let orderIndex: number | undefined;
  if (typeof data.orderIndex === 'number') orderIndex = data.orderIndex;
  else if (typeof data.urutanSeri === 'number') orderIndex = data.urutanSeri;
  else if (typeof data.seriesOrder === 'number') orderIndex = data.seriesOrder;
  else if (typeof data.urutan === 'number') orderIndex = data.urutan;
  else if (typeof data.order === 'number') orderIndex = data.order;
  else if (data.orderIndex !== undefined && data.orderIndex !== null && !isNaN(Number(data.orderIndex))) orderIndex = Number(data.orderIndex);

  let seriesOrderIndex: number | undefined;
  if (typeof data.seriesOrderIndex === 'number') seriesOrderIndex = data.seriesOrderIndex;
  else if (typeof data.urutanDaftarSeri === 'number') seriesOrderIndex = data.urutanDaftarSeri;
  else if (data.seriesOrderIndex !== undefined && data.seriesOrderIndex !== null && !isNaN(Number(data.seriesOrderIndex))) seriesOrderIndex = Number(data.seriesOrderIndex);

  let chapters: Chapter[] | undefined;
  const chaptersRaw = data.bab || data.babs || data.chapters || data.daftarBab || 
                      data.daftar_bab || data.chapterList || data.listBab || data.list_bab ||
                      data.daftar_isi || data.daftarIsi || data.chapter_list || data.list_chapter ||
                      data.daftar_chapter || data.isi_bab || data.isiBab;
  if (Array.isArray(chaptersRaw)) {
    chapters = chaptersRaw
      .filter((item) => item?.status !== 'draft' && item?.status !== 'konsep')
      .map((item, idx) => parseChapter(item?.pengenal || item?.id || `ch-${idx + 1}`, item, idx));
  } else if (chaptersRaw && typeof chaptersRaw === 'object') {
    chapters = Object.entries(chaptersRaw)
      .filter(([_, chData]: [string, any]) => chData?.status !== 'draft' && chData?.status !== 'konsep')
      .map(([chId, chData], idx) => parseChapter(chId, chData, idx));
  }
  if (chapters && chapters.length > 0) {
    chapters = sortChapters(chapters);
  }

  let views: number | undefined;
  if (typeof data.views === 'number') views = data.views;
  else if (typeof data.viewCount === 'number') views = data.viewCount;
  else if (typeof data.dibaca === 'number') views = data.dibaca;
  else if (typeof data.totalViews === 'number') views = data.totalViews;
  else if (data.views && !isNaN(Number(data.views))) views = Number(data.views);

  let rating: number | undefined;
  if (typeof data.rating === 'number') rating = data.rating;
  else if (typeof data.averageRating === 'number') rating = data.averageRating;
  else if (data.rating && !isNaN(Number(data.rating))) rating = Number(data.rating);

  return {
    id: data.pengenal || id,
    title: String(title || id).trim(),
    author: author ? String(author).trim() : undefined,
    genre: Array.isArray(genre) ? genre.join(', ') : genre ? String(genre).trim() : undefined,
    synopsis: synopsis ? String(synopsis).trim() : undefined,
    cover: cover ? String(cover).trim() : undefined,
    customCover: customCover && typeof customCover === 'object' ? customCover : undefined,
    chapters,
    views,
    rating,
    createdAt: data.dibuatPada || data.createdAt,
    updatedAt: data.diperbaruiPada || data.updatedAt,
    seriesName: seriesName ? String(seriesName).trim() : undefined,
    seriesBanner: seriesBanner ? String(seriesBanner).trim() : undefined,
    seriesCover: seriesCover ? String(seriesCover).trim() : undefined,
    seriesSynopsis: seriesSynopsis ? String(seriesSynopsis).trim() : undefined,
    seriesOrder,
    seriesOrderIndex,
    orderIndex
  };
}

export function sortNovels(novels: Novel[]): Novel[] {
  return [...novels].sort((a, b) => {
    const hasOrderA = typeof a.orderIndex === 'number' && a.orderIndex < 9999;
    const hasOrderB = typeof b.orderIndex === 'number' && b.orderIndex < 9999;
    if (hasOrderA && hasOrderB) {
      if (a.orderIndex !== b.orderIndex) {
        return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
      }
    } else {
      if (hasOrderA) return -1;
      if (hasOrderB) return 1;
    }
    const timeA = parseTimestamp(a.updatedAt) || parseTimestamp(a.createdAt) || 0;
    const timeB = parseTimestamp(b.updatedAt) || parseTimestamp(b.createdAt) || 0;
    if (timeB !== timeA) return timeB - timeA;
    const cmp = a.title.localeCompare(b.title, 'id');
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });
}

function getCachedNovels(): Novel[] {
  try {
    const raw = localStorage.getItem(CACHE_NOVELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortNovels(parsed);
      }
    }
  } catch {}
  return [];
}

function setCachedNovels(novels: Novel[]) {
  try {
    localStorage.setItem(CACHE_NOVELS_KEY, JSON.stringify(novels));
  } catch {}
}

export function subscribeToNovels(
  onUpdate: (data: Novel[]) => void,
  onError?: (err: any) => void
): () => void {
  const cached = getCachedNovels();
  if (cached.length > 0) {
    onUpdate(cached);
  }
  if (!db) {
    onUpdate(cached);
    return () => {};
  }

  const collectionNovelMap = new Map<string, Map<string, Novel>>();
  const seriesInfoMap = new Map<string, { name: string; banner?: string; cover?: string; synopsis?: string; orderIndex?: number }>();

  const emit = () => {
    const merged = new Map<string, Novel>();
    collectionNovelMap.forEach((novelsMap) => {
      novelsMap.forEach((novel, id) => {
        if (novel.seriesName && novel.seriesName.trim()) {
          const sKey = novel.seriesName.trim().toLowerCase();
          const info = seriesInfoMap.get(sKey);
          if (info) {
            if (info.banner) novel.seriesBanner = info.banner;
            if (info.cover) novel.seriesCover = info.cover;
            if (info.synopsis) novel.seriesSynopsis = info.synopsis;
            if (info.orderIndex !== undefined) novel.seriesOrderIndex = info.orderIndex;
          }
        }
        merged.set(id, novel);
      });
    });

    const list = Array.from(merged.values());
    const sorted = sortNovels(list);
    setCachedNovels(sorted);
    onUpdate(sorted);
  };

  const unsubs: (() => void)[] = [];
  let isCancelled = false;

  ensureAuth().then(() => {
    if (isCancelled || !db) return;

    const novelCols = ['books', 'buku', 'novels', 'novel', 'karya'];
    const seriesCols = ['book_series', 'series', 'bookSeries', 'seri', 'daftarSeri', 'kumpulanSeri'];

    // Listen series metadata
    seriesCols.forEach((colName) => {
      try {
        const q = collection(db, colName);
        const unsub = onSnapshot(q, (snap) => {
          seriesInfoMap.clear();
          snap.docs.forEach((docSnap) => {
            const d = docSnap.data();
            const sName = d.seriesName || d.namaSeri || d.seri || d.series || d.name || d.title || d.judulSeri || docSnap.id;
            const banner = d.seriesBanner || d.bannerSeri || d.banner || d.urlBanner || d.bannerUrl || d.headerImage;
            const cover = d.seriesCover || d.sampulSeri || d.coverSeri || d.cover || d.urlSampul || d.imageUrl;
            const synopsis = d.seriesSynopsis || d.sinopsisSeri || d.ringkasanSeri || d.synopsis || d.sinopsis || d.description;
            let orderIdx: number | undefined;
            if (typeof d.orderIndex === 'number') orderIdx = d.orderIndex;
            else if (typeof d.order === 'number') orderIdx = d.order;
            else if (typeof d.urutan === 'number') orderIdx = d.urutan;
            else if (d.orderIndex !== undefined && !isNaN(Number(d.orderIndex))) orderIdx = Number(d.orderIndex);

            if (sName) {
              seriesInfoMap.set(String(sName).trim().toLowerCase(), {
                name: String(sName).trim(),
                banner: banner ? String(banner).trim() : undefined,
                cover: cover ? String(cover).trim() : undefined,
                synopsis: synopsis ? String(synopsis).trim() : undefined,
                orderIndex: orderIdx !== undefined ? orderIdx : 9999
              });
            }
          });
          emit();
        }, () => {});
        unsubs.push(unsub);
      } catch {}
    });

    // Listen novel collections
    novelCols.forEach((colName) => {
      try {
        const q = collection(db, colName);
        const unsub = onSnapshot(
          q,
          (snap) => {
            const m = new Map<string, Novel>();
            snap.docs.forEach((docSnap) => {
              const novel = parseNovel(docSnap.id, docSnap.data());
              if (novel) m.set(docSnap.id, novel);
            });
            collectionNovelMap.set(colName, m);
            emit();
          },
          (err) => {
            if (collectionNovelMap.size > 0) {
              emit();
            } else {
              onError && onError(err);
            }
          }
        );
        unsubs.push(unsub);
      } catch (err) {
        console.warn('Collection listen error:', err);
      }
    });
  }).catch((err) => {
    onError && onError(err);
  });

  return () => {
    isCancelled = true;
    unsubs.forEach((u) => {
      try { u(); } catch {}
    });
  };
}

export function sortChapters(chapters: Chapter[]): Chapter[] {
  return [...chapters].sort((a, b) => {
    // 1. Prolog always comes first (before Bab 1)
    const isPrologA = /prolog/i.test(a.title);
    const isPrologB = /prolog/i.test(b.title);
    if (isPrologA && !isPrologB) return -1;
    if (!isPrologA && isPrologB) return 1;

    // 2. Epilog always comes last
    const isEpilogA = /epilog/i.test(a.title);
    const isEpilogB = /epilog/i.test(b.title);
    if (isEpilogA && !isEpilogB) return 1;
    if (!isEpilogA && isEpilogB) return -1;

    // 3. Natural title chapter numbers (e.g. "Bab 1" -> 1, "Bab 2" -> 2)
    const titleNumA = extractTitleChapterNumber(a.title);
    const titleNumB = extractTitleChapterNumber(b.title);
    if (titleNumA !== null && titleNumB !== null && titleNumA !== titleNumB) {
      return titleNumA - titleNumB;
    }

    // 4. Numeric order comparison
    const numA = typeof a.order === 'number' ? a.order : (a.chapterNumber ?? 0);
    const numB = typeof b.order === 'number' ? b.order : (b.chapterNumber ?? 0);
    if (numA !== numB) return numA - numB;

    // 5. Creation timestamp comparison from ID if both have unix timestamps like 1788013282095_...
    const tsA = parseInt(a.id.split('_')[0], 10);
    const tsB = parseInt(b.id.split('_')[0], 10);
    if (!isNaN(tsA) && !isNaN(tsB) && tsA > 1000000000000 && tsB > 1000000000000 && tsA !== tsB) {
      return tsA - tsB;
    }

    // 6. Fallback to alphanumeric title sorting
    return a.title.localeCompare(b.title, undefined, { numeric: true });
  });
}

export function subscribeToNovelChapters(
  novel: Novel,
  onUpdate: (data: Chapter[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!db) {
    onUpdate(novel.chapters ? sortChapters([...novel.chapters]) : []);
    return () => {};
  }

  const map = new Map<string, Chapter>();
  if (novel.chapters && novel.chapters.length > 0) {
    novel.chapters.forEach((c) => map.set(c.id, c));
    onUpdate(sortChapters(Array.from(map.values())));
  }

  const emit = () => {
    onUpdate(sortChapters(Array.from(map.values())));
  };

  // Safe merge function to guarantee content and descriptive titles are never wiped out
  const mergeChapterIntoMap = (ch: Chapter) => {
    // 1. Check if an existing entry matches by exact ID
    let existingKey = map.has(ch.id) ? ch.id : undefined;

    // 2. If not matched by exact ID, reconcile ONLY when titles genuinely match or are expansions
    if (!existingKey) {
      for (const [key, item] of map.entries()) {
        const itemTitleClean = (item.title || '').trim().toLowerCase();
        const chTitleClean = (ch.title || '').trim().toLowerCase();

        // If both have explicit titles, and they are distinct (e.g. "Prolog" vs "Bab 1", or "Bab 1" vs "Bab 2"),
        // they must NEVER be merged!
        if (itemTitleClean && chTitleClean) {
          const isExactTitle = itemTitleClean === chTitleClean;
          const isSubtitleExpansion = (
            itemTitleClean.startsWith(chTitleClean + ':') ||
            itemTitleClean.startsWith(chTitleClean + ' -') ||
            chTitleClean.startsWith(itemTitleClean + ':') ||
            chTitleClean.startsWith(itemTitleClean + ' -')
          );

          if (isExactTitle || isSubtitleExpansion) {
            existingKey = key;
            break;
          }
          // Distinct titles -> NEVER merge!
          continue;
        }

        // If one lacks an explicit title, match by number ONLY if neither is a special title like Prolog/Epilog
        const isSpecialA = /prolog|epilog|interlude|extra/i.test(item.title);
        const isSpecialB = /prolog|epilog|interlude|extra/i.test(ch.title);
        if (!isSpecialA && !isSpecialB && !item.hasExplicitTitle && !ch.hasExplicitTitle) {
          const itemNum = item.chapterNumber ?? item.order;
          const chNum = ch.chapterNumber ?? ch.order;
          if (itemNum !== undefined && chNum !== undefined && itemNum === chNum) {
            existingKey = key;
            break;
          }
        }
      }
    }

    if (!existingKey) {
      map.set(ch.id, ch);
      return;
    }

    const existing = map.get(existingKey)!;

    // Preserve non-empty content
    const hasIncomingContent = Boolean(ch.content && ch.content.trim().length > 0);
    const hasExistingContent = Boolean(existing.content && existing.content.trim().length > 0);
    const mergedContent = hasIncomingContent ? ch.content : (hasExistingContent ? existing.content : '');

    // Prefer authoritative incoming title from live Firestore
    const hasExplicitTitle = Boolean(ch.hasExplicitTitle || existing.hasExplicitTitle);
    let mergedTitle = ch.title || existing.title;
    if (ch.hasExplicitTitle) {
      mergedTitle = ch.title;
    } else if (existing.hasExplicitTitle && !ch.hasExplicitTitle) {
      mergedTitle = existing.title;
    }

    // Determine natural order from title
    const titleNum = extractTitleChapterNumber(mergedTitle);
    const bestOrder = titleNum !== null
      ? titleNum
      : (typeof existing.order === 'number' && existing.order >= 0)
      ? existing.order
      : ch.order;

    const bestChapterNum = titleNum !== null
      ? titleNum
      : (typeof existing.chapterNumber === 'number' && existing.chapterNumber >= 0)
      ? existing.chapterNumber
      : ch.chapterNumber;

    // Determine the most authoritative ID: prefer a real Firestore document ID over synthetic 'ch-X'
    const bestId = (!ch.id.startsWith('ch-') && ch.id) ? ch.id : (!existing.id.startsWith('ch-') && existing.id ? existing.id : ch.id);

    // If ID upgraded, remove the old synthetic key to prevent duplicate chapters in the list
    if (existingKey !== bestId) {
      map.delete(existingKey);
    }

    const incomingPrice = (ch.coinPrice !== undefined && ch.coinPrice !== null && !isNaN(Number(ch.coinPrice))) ? Number(ch.coinPrice) : undefined;
    const existingPrice = (existing.coinPrice !== undefined && existing.coinPrice !== null && !isNaN(Number(existing.coinPrice))) ? Number(existing.coinPrice) : undefined;
    const resolvedCoinPrice = incomingPrice !== undefined ? incomingPrice : (existingPrice !== undefined ? existingPrice : 0);

    map.set(bestId, {
      ...existing,
      ...ch,
      id: bestId,
      title: mergedTitle,
      content: mergedContent,
      coinPrice: resolvedCoinPrice,
      isLocked: ch.isLocked !== undefined ? ch.isLocked : existing.isLocked,
      views: Math.max(ch.views || 0, existing.views || 0),
      order: bestOrder,
      chapterNumber: bestChapterNum,
      hasExplicitTitle
    });
  };

  const unsubs: (() => void)[] = [];
  let isCancelled = false;

  ensureAuth().then(() => {
    if (isCancelled || !db) return;
    const parentCols = ['books', 'buku', 'novels', 'novel', 'karya'];

    // 1. Listen to parent document
    parentCols.forEach((colName) => {
      try {
        const dRef = doc(db, colName, novel.id);
        const unsub = onSnapshot(dRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const b = data.bab || data.babs || data.chapters || data.daftarBab || 
                      data.daftar_bab || data.chapterList || data.listBab || data.list_bab ||
                      data.daftar_isi || data.daftarIsi || data.chapter_list || data.list_chapter ||
                      data.isi_bab || data.isiBab;
            if (Array.isArray(b) && b.length > 0) {
              b.forEach((item, idx) => {
                if (item?.status === 'draft' || item?.status === 'konsep') return;
                const ch = parseChapter(item?.pengenal || item?.id || `ch-${idx + 1}`, item, idx);
                mergeChapterIntoMap(ch);
              });
              emit();
            } else if (b && typeof b === 'object') {
              Object.entries(b).forEach(([k, item]: [string, any], idx) => {
                if (item?.status === 'draft' || item?.status === 'konsep') return;
                const ch = parseChapter(k, item, idx);
                mergeChapterIntoMap(ch);
              });
              emit();
            }
          }
        }, () => {});
        unsubs.push(unsub);
      } catch {}
    });

    // 2. Listen to subcollections inside book document
    const subColNames = ['bab', 'chapters', 'daftarBab', 'daftar_bab', 'isi_bab', 'chapterList', 'contents', 'chapter', 'listBab'];
    subColNames.forEach((subCol) => {
      parentCols.forEach((pCol) => {
        try {
          const subRef = collection(db, pCol, novel.id, subCol);
          const unsub = onSnapshot(subRef, (snap) => {
            if (!snap.empty) {
              snap.docs.forEach((dSnap, idx) => {
                const data = dSnap.data();
                if (data?.status === 'draft' || data?.status === 'konsep') return;
                const ch = parseChapter(dSnap.id, data, idx);
                mergeChapterIntoMap(ch);
              });
              emit();
            }
          }, () => {});
          unsubs.push(unsub);
        } catch {}
      });
    });

    // 3. Listen to root collections 'chapters' and 'bab' if queried by bookId or novelId
    ['chapters', 'bab', 'chapter'].forEach((rootCol) => {
      ['bookId', 'novelId', 'bukuId', 'karyaId', 'storyId', 'idBuku', 'idNovel'].forEach((idField) => {
        try {
          const qRoot = query(collection(db, rootCol), where(idField, '==', novel.id));
          const unsubRoot = onSnapshot(qRoot, (snap) => {
            if (!snap.empty) {
              snap.docs.forEach((dSnap, idx) => {
                const data = dSnap.data();
                if (data?.status === 'draft' || data?.status === 'konsep') return;
                const ch = parseChapter(dSnap.id, data, idx);
                mergeChapterIntoMap(ch);
              });
              emit();
            }
          }, () => {});
          unsubs.push(unsubRoot);
        } catch {}
      });
    });
  }).catch((err) => {
    onError && onError(err);
  });

  return () => {
    isCancelled = true;
    unsubs.forEach((u) => {
      try { u(); } catch {}
    });
  };
}

/**
 * Direct single chapter content fetcher fallback if a chapter is opened before content arrives
 */
export async function fetchSingleChapterContent(
  novelId: string, 
  chapterId: string,
  chapterNumber?: number
): Promise<{ content: string; title?: string } | null> {
  if (!db || (!chapterId && !chapterNumber)) return null;
  try {
    await ensureAuth();

    const parentCols = ['books', 'buku', 'novels', 'novel', 'karya'];
    const subCols = ['chapters', 'bab', 'daftarBab', 'daftar_bab', 'isi_bab', 'chapterList', 'contents'];

    // 1. Direct doc lookup in subcollections if chapterId exists
    if (novelId && chapterId) {
      for (const pCol of parentCols) {
        for (const sCol of subCols) {
          try {
            const dRef = doc(db, pCol, novelId, sCol, chapterId);
            const snap = await getDoc(dRef);
            if (snap.exists()) {
              const ch = parseChapter(snap.id, snap.data());
              if (ch.content && ch.content.trim()) {
                return { content: ch.content, title: ch.title };
              }
            }
          } catch {}
        }
      }
    }

    // 2. Direct doc lookup in root collections
    if (chapterId) {
      for (const rCol of ['chapters', 'bab', 'chapter']) {
        try {
          const dRef = doc(db, rCol, chapterId);
          const snap = await getDoc(dRef);
          if (snap.exists()) {
            const ch = parseChapter(snap.id, snap.data());
            if (ch.content && ch.content.trim()) {
              return { content: ch.content, title: ch.title };
            }
          }
        } catch {}
      }
    }

    // 3. Fallback: If chapterId was synthetic (e.g. "ch-1") or content not found by direct ID,
    // scan subcollection documents for a matching order / chapterNumber
    if (novelId) {
      for (const pCol of parentCols) {
        for (const sCol of subCols) {
          try {
            const cRef = collection(db, pCol, novelId, sCol);
            const snaps = await getDocs(cRef);
            if (!snaps.empty) {
              for (const dSnap of snaps.docs) {
                const ch = parseChapter(dSnap.id, dSnap.data());
                const numMatch = chapterNumber !== undefined && (ch.chapterNumber === chapterNumber || ch.order === chapterNumber);
                const idMatch = dSnap.id === chapterId;
                if ((idMatch || numMatch) && ch.content && ch.content.trim()) {
                  return { content: ch.content, title: ch.title };
                }
              }
            }
          } catch {}
        }
      }
    }

    // 4. Fallback: Check parent novel document again
    if (novelId) {
      for (const pCol of parentCols) {
        try {
          const pRef = doc(db, pCol, novelId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const data = pSnap.data();
            const b = data.bab || data.babs || data.chapters || data.daftarBab || data.daftar_bab || 
                      data.chapterList || data.listBab || data.list_bab || data.daftar_isi || data.daftarIsi;
            if (Array.isArray(b)) {
              for (let i = 0; i < b.length; i++) {
                const item = b[i];
                const ch = parseChapter(item?.pengenal || item?.id || `ch-${i + 1}`, item, i);
                const idMatch = ch.id === chapterId;
                const numMatch = chapterNumber !== undefined && (ch.chapterNumber === chapterNumber || ch.order === chapterNumber || i + 1 === chapterNumber);
                if ((idMatch || numMatch) && ch.content && ch.content.trim()) {
                  return { content: ch.content, title: ch.title };
                }
              }
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('Error fetching single chapter content:', err);
  }
  return null;
}

export function groupNovelsBySeries(novels: Novel[]): SeriesGroup[] {
  const map = new Map<string, { seriesName: string; seriesBanner?: string; seriesCover?: string; seriesSynopsis?: string; orderIndex?: number; novels: Novel[] }>();

  novels.forEach((n) => {
    if (n.seriesName && n.seriesName.trim()) {
      const sName = n.seriesName.trim();
      const sKey = sName.toLowerCase();
      if (!map.has(sKey)) {
        map.set(sKey, {
          seriesName: sName,
          seriesBanner: n.seriesBanner,
          seriesCover: n.seriesCover,
          seriesSynopsis: n.seriesSynopsis,
          orderIndex: n.seriesOrderIndex,
          novels: []
        });
      }
      const group = map.get(sKey)!;
      if (!group.seriesBanner && n.seriesBanner) group.seriesBanner = n.seriesBanner;
      if (!group.seriesCover && n.seriesCover) group.seriesCover = n.seriesCover;
      if (!group.seriesSynopsis && n.seriesSynopsis) group.seriesSynopsis = n.seriesSynopsis;
      if (group.orderIndex === undefined && typeof n.seriesOrderIndex === 'number') {
        group.orderIndex = n.seriesOrderIndex;
      }
      group.novels.push(n);
    }
  });

  return Array.from(map.values()).map((g) => {
    const sorted = [...g.novels].sort((a, b) => {
      const ordA = typeof a.seriesOrder === 'number' ? a.seriesOrder : typeof a.orderIndex === 'number' ? a.orderIndex : 9999;
      const ordB = typeof b.seriesOrder === 'number' ? b.seriesOrder : typeof b.orderIndex === 'number' ? b.orderIndex : 9999;
      if (ordA !== ordB) return ordA - ordB;
      const cmp = a.title.localeCompare(b.title, 'id');
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    });

    let sOrd = g.orderIndex;
    if (typeof sOrd !== 'number' && sorted.length > 0 && typeof sorted[0].orderIndex === 'number') {
      sOrd = sorted[0].orderIndex;
    }

    return {
      seriesName: g.seriesName,
      seriesBanner: g.seriesBanner,
      seriesCover: g.seriesCover,
      seriesSynopsis: g.seriesSynopsis,
      orderIndex: sOrd,
      novels: sorted
    };
  }).sort((a, b) => {
    const oA = typeof a.orderIndex === 'number' ? a.orderIndex : 9999;
    const oB = typeof b.orderIndex === 'number' ? b.orderIndex : 9999;
    return oA !== oB ? oA - oB : a.seriesName.localeCompare(b.seriesName, 'id');
  });
}

export function parseCharacter(id: string, data: any, index: number = 0, defaultBookId: string = ''): Character | null {
  if (!data || typeof data !== 'object') return null;
  const name = data.name || data.nama || data.characterName || data.namaKarakter || data.namaTokoh || data.tokoh || data.title || data.judul || 'Tanpa Nama';
  const photo = data.photoUrl || data.photo || data.foto || data.urlFoto || data.image || data.imageUrl || data.gambar || data.urlGambar || data.avatar || data.cover || data['URL foto'];
  const gender = data.gender || data.jenisKelamin || data.kelamin || data.sex;
  const age = data.age || data.umur || data.usia;
  const height = data.height || data.tinggi || data.tinggiBadan || data.tinggi_badan;
  const notes = data.notes || data.catatan || data.description || data.deskripsi || data.profile || data.profil || data.bio || data.tentang || data.ringkasan;
  const role = data.role || data.peran || data.status;
  const orderIndex = typeof data.orderIndex === 'number' ? data.orderIndex : typeof data.order === 'number' ? data.order : typeof data.urutan === 'number' ? data.urutan : index;
  const bookId = data.bookId || data.novelId || data.bukuId || defaultBookId;
  const createdAt = data.createdAt || data.dibuatPada || data.tanggal;
  const updatedAt = data.updatedAt || data.diperbaruiPada || createdAt;

  return {
    id: data.id || id,
    bookId: String(bookId || defaultBookId || '').trim(),
    name: String(name).trim(),
    photoUrl: photo ? String(photo).trim() : undefined,
    photo: photo ? String(photo).trim() : undefined,
    gender: gender ? String(gender).trim() : undefined,
    age: age != null && String(age).trim() !== '' ? (typeof age === 'number' ? `${age} thn` : String(age).trim()) : undefined,
    height: height != null && String(height).trim() !== '' ? (typeof height === 'number' ? `${height} cm` : String(height).trim()) : undefined,
    notes: notes ? String(notes).trim() : undefined,
    description: notes ? String(notes).trim() : undefined,
    role: role ? String(role).trim() : undefined,
    orderIndex,
    order: orderIndex,
    createdAt,
    updatedAt
  };
}

const getLocalCharactersKey = (novelId: string) => `cached_characters_${novelId}`;

export function getCachedNovelCharacters(novelId: string): Character[] {
  if (typeof window === 'undefined' || !novelId) return [];
  try {
    const raw = localStorage.getItem(getLocalCharactersKey(novelId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

interface CharacterSubEntry {
  unsubs: (() => void)[];
  subscribers: Set<(data: Character[]) => void>;
  errorHandlers: Set<(err: any) => void>;
  keepAliveTimer: any;
  currentData: Character[] | null;
}

const activeCharacterSubscriptions = new Map<string, CharacterSubEntry>();

export function clearAllLocalCaches(): void {
  try {
    localStorage.removeItem(CACHE_NOVELS_KEY);
    if (typeof window !== 'undefined') {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('cached_characters_') || key.startsWith('cached_novels_'))) {
          localStorage.removeItem(key);
        }
      }
    }
    activeCharacterSubscriptions.clear();
  } catch {}
}

export function subscribeToNovelCharacters(
  novelOrId: Novel | string,
  onUpdate: (data: Character[]) => void,
  onError?: (err: any) => void
): () => void {
  const novelId = typeof novelOrId === 'string' ? novelOrId : novelOrId?.id;
  const fallback = typeof novelOrId !== 'string' && novelOrId?.characters ? novelOrId.characters : [];

  if (!novelId || typeof novelId !== 'string' || !novelId.trim()) {
    if (fallback.length > 0) onUpdate(fallback);
    else if (onError) onError(new Error('ID buku (bookId) tidak ditemukan atau tidak valid.'));
    else onUpdate([]);
    return () => {};
  }

  // Check if an active connection or keep-alive exists for this novelId
  const existing = activeCharacterSubscriptions.get(novelId);
  if (existing) {
    if (existing.keepAliveTimer) {
      clearTimeout(existing.keepAliveTimer);
      existing.keepAliveTimer = null;
    }
    existing.subscribers.add(onUpdate);
    if (onError) existing.errorHandlers.add(onError);

    // If we already have live data in memory, supply it immediately (0ms, 0 database reads)
    if (existing.currentData) {
      onUpdate(existing.currentData);
    } else {
      const cached = getCachedNovelCharacters(novelId);
      if (cached.length > 0) onUpdate(cached);
      else if (fallback.length > 0) onUpdate(fallback);
    }

    return () => {
      existing.subscribers.delete(onUpdate);
      if (onError) existing.errorHandlers.delete(onError);

      // If no components are currently viewing this gallery, keep listener alive for 90s
      // to prevent re-querying Firestore if the user opens and closes the gallery repeatedly
      if (existing.subscribers.size === 0) {
        existing.keepAliveTimer = setTimeout(() => {
          existing.unsubs.forEach((u) => {
            try { u(); } catch {}
          });
          activeCharacterSubscriptions.delete(novelId);
        }, 90000);
      }
    };
  }

  // 1. Initial cached map for instant 0-second display without spinner
  const cacheMap = new Map<string, Character>();
  fallback.forEach((c) => cacheMap.set(c.id, c));
  const cached = getCachedNovelCharacters(novelId);
  cached.forEach((c) => cacheMap.set(c.id, c));

  const entry: CharacterSubEntry = {
    unsubs: [],
    subscribers: new Set([onUpdate]),
    errorHandlers: new Set(onError ? [onError] : []),
    keepAliveTimer: null,
    currentData: cacheMap.size > 0 ? Array.from(cacheMap.values()) : null
  };
  activeCharacterSubscriptions.set(novelId, entry);

  // Authoritative live collections from Firestore
  const rootCharsMap = new Map<string, Character>();
  const subCharsMap = new Map<string, Character>();
  const parentDocCharsMap = new Map<string, Character>();
  let hasReceivedLiveSnapshot = false;

  const emit = () => {
    let sourceList: Character[];
    if (hasReceivedLiveSnapshot) {
      // Reconcile live maps: root collection + subcollection + parent doc
      const combined = new Map<string, Character>();
      parentDocCharsMap.forEach((c, k) => combined.set(k, c));
      subCharsMap.forEach((c, k) => combined.set(k, c));
      rootCharsMap.forEach((c, k) => combined.set(k, c));
      sourceList = Array.from(combined.values());
    } else {
      sourceList = Array.from(cacheMap.values());
    }

    sourceList.sort((a, b) => {
      const oA = typeof a.orderIndex === 'number' ? a.orderIndex : typeof a.order === 'number' ? a.order : 999;
      const oB = typeof b.orderIndex === 'number' ? b.orderIndex : typeof b.order === 'number' ? b.order : 999;
      return oA !== oB ? oA - oB : a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    entry.currentData = sourceList;

    // Update local cache so next opening is also fast and strictly accurate
    if (hasReceivedLiveSnapshot) {
      try {
        if (sourceList.length > 0) {
          localStorage.setItem(getLocalCharactersKey(novelId), JSON.stringify(sourceList));
        } else {
          localStorage.removeItem(getLocalCharactersKey(novelId));
        }
      } catch {}
    }

    entry.subscribers.forEach((cb) => {
      try { cb(sourceList); } catch {}
    });
  };

  // Immediate 0-second emission if cache exists
  if (cacheMap.size > 0) {
    emit();
  }

  if (!db) {
    return () => {
      activeCharacterSubscriptions.delete(novelId);
    };
  }

  ensureAuth().then(() => {
    if (!activeCharacterSubscriptions.has(novelId) || !db) return;

    const matchesNovel = (d: any): boolean => {
      if (!d) return false;
      const bId = String(d.bookId ?? d.novelId ?? d.bukuId ?? d.idBuku ?? d.idNovel ?? d.book_id ?? '').trim();
      return Boolean(bId && (bId === novelId || bId === String(novelId)));
    };

    // 1. Root collections: 'characters', 'karakter', 'tokoh', 'bookCharacters'
    const rootCharCols = ['characters', 'karakter', 'tokoh', 'bookCharacters'];
    rootCharCols.forEach((colName) => {
      try {
        const unsub = onSnapshot(collection(db, colName), (snap) => {
          let updated = false;
          snap.docs.forEach((dSnap, idx) => {
            const d = dSnap.data();
            if (matchesNovel(d)) {
              const ch = parseCharacter(dSnap.id, d, idx, novelId);
              if (ch) {
                rootCharsMap.set(ch.id, ch);
                updated = true;
              }
            } else if (rootCharsMap.has(dSnap.id)) {
              rootCharsMap.delete(dSnap.id);
              updated = true;
            }
          });
          hasReceivedLiveSnapshot = true;
          emit();
        }, () => {});
        entry.unsubs.push(unsub);
      } catch {}
    });

    // 2. Subcollections inside parent book documents: books/{id}/characters, books/{id}/karakter, etc.
    const parentCols = ['books', 'buku', 'novels', 'novel'];
    const subColNames = ['characters', 'karakter', 'tokoh', 'bookCharacters'];
    parentCols.forEach((pCol) => {
      subColNames.forEach((sCol) => {
        try {
          const subRef = collection(db, pCol, novelId, sCol);
          const unsubSub = onSnapshot(subRef, (snap) => {
            snap.docs.forEach((dSnap, idx) => {
              const ch = parseCharacter(dSnap.id, dSnap.data(), idx, novelId);
              if (ch) subCharsMap.set(ch.id, ch);
            });
            hasReceivedLiveSnapshot = true;
            emit();
          }, () => {});
          entry.unsubs.push(unsubSub);
        } catch {}
      });
    });

    // 3. Parent document (e.g. books/{id} with embedded characters/karakter array)
    try {
      parentCols.forEach((col) => {
        try {
          const pRef = doc(db, col, novelId);
          const unsubP = onSnapshot(pRef, (pSnap) => {
            if (pSnap.exists()) {
              const data = pSnap.data();
              const chars = data.characters || data.karakter || data.tokoh || data.bookCharacters || data.daftarKarakter || data.listKarakter;
              if (Array.isArray(chars)) {
                parentDocCharsMap.clear();
                chars.forEach((c, idx) => {
                  const ch = parseCharacter(c?.id || `char-${idx + 1}`, c, idx, novelId);
                  if (ch) parentDocCharsMap.set(ch.id, ch);
                });
                hasReceivedLiveSnapshot = true;
                emit();
              }
            }
          }, () => {});
          entry.unsubs.push(unsubP);
        } catch {}
      });
    } catch {}
  }).catch((err) => {
    if (fallback.length > 0) onUpdate(fallback);
    else {
      entry.errorHandlers.forEach((handler) => {
        try { handler(err); } catch {}
      });
    }
  });

  return () => {
    entry.subscribers.delete(onUpdate);
    if (onError) entry.errorHandlers.delete(onError);

    if (entry.subscribers.size === 0) {
      entry.keepAliveTimer = setTimeout(() => {
        entry.unsubs.forEach((u) => {
          try { u(); } catch {}
        });
        activeCharacterSubscriptions.delete(novelId);
      }, 90000);
    }
  };
}
