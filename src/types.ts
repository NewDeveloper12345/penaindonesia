export interface Chapter {
  id: string;
  title: string;
  content: string;
  order?: number;
  chapterNumber?: number;
  isLocked?: boolean;
  views?: number;
  coinPrice?: number;
  hasExplicitTitle?: boolean;
}

export interface BookCharacter {
  id: string;          // ID unik karakter
  bookId: string;      // ID buku pemilik karakter (relasi ke koleksi books)
  name: string;        // Nama karakter
  age?: string;        // Umur karakter
  gender?: string;     // Jenis kelamin / gender
  height?: string;     // Tinggi badan
  notes?: string;      // Catatan, bio, atau profil tokoh
  photoUrl?: string;   // URL foto karakter (Base64 JPEG rasio 9:16)
  orderIndex?: number; // Urutan tampil
  createdAt?: any;     // Timestamp pembuatan
  updatedAt?: any;     // Timestamp pembaruan
  // Alias / Fallback fields
  photo?: string;
  description?: string;
  role?: string;
  order?: number;
}

export type Character = BookCharacter;

export interface CustomCoverConfig {
  bgGradient?: string;
  titleColor?: string;
  accentColor?: string;
  pattern?: string;
}

export interface Novel {
  id: string;
  title: string;
  author?: string;
  genre?: string | string[];
  synopsis?: string;
  cover?: string;
  customCover?: CustomCoverConfig;
  chapters?: Chapter[];
  characters?: Character[];
  views?: number;
  rating?: number;
  ratingCount?: number;
  createdAt?: any;
  updatedAt?: any;
  // Series attributes
  seriesName?: string;
  seriesBanner?: string;
  seriesCover?: string;
  seriesSynopsis?: string;
  seriesOrder?: number;
  seriesOrderIndex?: number;
  orderIndex?: number;
}

export interface SeriesGroup {
  id?: string;
  seriesName: string;
  seriesBanner?: string;
  seriesCover?: string;
  seriesSynopsis?: string;
  orderIndex?: number;
  novels: Novel[];
}

export interface Announcement {
  id: string;
  title?: string;
  content: string;
  author?: string;
  type?: 'info' | 'event' | 'alert' | string;
  createdAt?: any;
  expiredAt?: any;
}

