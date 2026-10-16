import { useEffect, useState } from 'react';
import { Novel, Chapter, SeriesGroup, Announcement } from './types';
import { subscribeToNovels, subscribeToAnnouncements, groupNovelsBySeries, clearAllLocalCaches } from './services/novelService';
import { flushPendingSyncQueue } from './services/batchSyncService';
import { Header } from './components/Header';
import { NovelList } from './components/NovelList';
import { NovelDetail } from './components/NovelDetail';
import { SeriesDetail } from './components/SeriesDetail';
import { ChapterReader } from './components/ChapterReader';
import { HomeDrawer } from './components/HomeDrawer';
import { CharacterGallery } from './components/CharacterGallery';
import { AnnouncementModal } from './components/AnnouncementModal';
import { ThemeModal } from './components/ThemeModal';
import { LiterarySplash } from './components/LiterarySplash';
import { useAppTheme } from './context/ThemeContext';

export default function App() {
  const { theme } = useAppTheme();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInitialSplash, setShowInitialSplash] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [selectedAnnouncementIndex, setSelectedAnnouncementIndex] = useState(0);
  const [activeHomeTab, setActiveHomeTab] = useState<'all' | 'series'>('all');
  const [selectedSeries, setSelectedSeries] = useState<SeriesGroup | null>(null);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [isViewingCharacters, setIsViewingCharacters] = useState(false);
  const [currentChapterList, setCurrentChapterList] = useState<Chapter[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isHomeDrawerOpen, setIsHomeDrawerOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isConnectionError, setIsConnectionError] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Monitor browser online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsConnectionError(false);
      setRetryTrigger((prev) => prev + 1);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen to in-app soft refresh event from native swipe-to-refresh
  // Ini menyegarkan data halaman yang sedang aktif TANPA keluar ke halaman utama dan TANPA memutar splash screen!
  useEffect(() => {
    const handleSoftRefresh = () => {
      // Bersihkan seluruh cache lokal (novel, karakter, bab) agar terpaksa fetch ulang dari Firebase
      clearAllLocalCaches();

      // Pastikan splash screen TIDAK PERNAH terulang saat refresh di dalam aplikasi
      setShowInitialSplash(false);

      // Jika sedang di beranda, aktifkan skeleton sebentar saat data di-sync
      if (!selectedNovel && !selectedSeries && !selectedChapter) {
        setLoading(true);
      }

      // Picu reload listener data
      setRetryTrigger((prev) => prev + 1);
    };

    window.addEventListener('pena_soft_refresh', handleSoftRefresh);
    return () => {
      window.removeEventListener('pena_soft_refresh', handleSoftRefresh);
    };
  }, [selectedNovel, selectedSeries, selectedChapter]);

  // Flush pending interactions queue from previous session on app open
  useEffect(() => {
    flushPendingSyncQueue();
  }, []);

  // Pastikan aplikasi selalu mulai bersih di Beranda (Halaman Utama) saat dibuka atau direfresh
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch {}
    }
  }, []);

  // Dynamic Document Title for Web
  useEffect(() => {
    if (selectedChapter) {
      document.title = `${selectedChapter.title || 'Membaca Bab'} - ${selectedNovel?.title || 'Pena Indonesia'}`;
    } else if (isViewingCharacters && selectedNovel) {
      document.title = `Galeri Karakter: ${selectedNovel.title} - Pena Indonesia`;
    } else if (selectedNovel) {
      document.title = `${selectedNovel.title} - Pena Indonesia`;
    } else if (selectedSeries) {
      document.title = `Seri ${selectedSeries.seriesName} - Pena Indonesia`;
    } else {
      document.title = 'Pena Indonesia - Membaca Novel Karya Anak Bangsa';
    }
  }, [selectedChapter, selectedNovel, selectedSeries, isViewingCharacters]);

  // Tangani tombol Back browser dengan history state tanpa merusak URL utama
  useEffect(() => {
    const handlePopState = () => {
      if (selectedChapter) {
        setSelectedChapter(null);
      } else if (isViewingCharacters) {
        setIsViewingCharacters(false);
      } else if (selectedNovel) {
        setSelectedNovel(null);
      } else if (selectedSeries) {
        setSelectedSeries(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedChapter, isViewingCharacters, selectedNovel, selectedSeries]);

  // Subscribe to novels
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToNovels(
      (data: Novel[]) => {
        setNovels(data);
        setLoading(false);
        setIsConnectionError(false);

        // Keep selectedNovel in sync if updated, or clear if deleted
        setSelectedNovel((prev) => {
          if (!prev) return null;
          const updated = data.find((n: Novel) => n.id === prev.id);
          if (updated) return updated;
          if (data.length > 0) {
            setSelectedChapter(null);
            setIsViewingCharacters(false);
            return null;
          }
          return prev;
        });

        // Keep selectedSeries in sync with real-time order changes if currently viewed, or clear if deleted
        setSelectedSeries((prev) => {
          if (!prev) return null;
          const allGroups = groupNovelsBySeries(data);
          const updatedSeries = allGroups.find(
            (g: SeriesGroup) => g.seriesName.toLowerCase() === prev.seriesName.toLowerCase()
          );
          if (updatedSeries && updatedSeries.novels.length > 0) {
            return updatedSeries;
          }
          if (data.length > 0) {
            return null;
          }
          return prev;
        });
      },
      (err: any) => {
        console.error('Error fetching novels:', err);
        setLoading(false);
        setIsConnectionError(true);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [retryTrigger]);

  // Subscribe to announcements (filtered by expiredAt > Date.now() and sorted desc by createdAt)
  useEffect(() => {
    const unsubAnnouncements = subscribeToAnnouncements(
      (activeAnnouncements: Announcement[]) => {
        setAnnouncements(activeAnnouncements);
      },
      (err: any) => {
        console.error('Error fetching announcements:', err);
      }
    );

    return () => {
      if (unsubAnnouncements) unsubAnnouncements();
    };
  }, []);

  const handleOpenAnnouncementModal = (index: number = 0) => {
    setSelectedAnnouncementIndex(index);
    setIsAnnouncementModalOpen(true);
  };

  const handleSelectNovel = (novel: Novel) => {
    setSelectedNovel(novel);
    setSelectedChapter(null);
    setIsViewingCharacters(false);
    setIsDrawerOpen(false);
    setIsHomeDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleSelectSeries = (series: SeriesGroup) => {
    setSelectedSeries(series);
    setSelectedNovel(null);
    setSelectedChapter(null);
    setIsViewingCharacters(false);
    setIsDrawerOpen(false);
    setIsHomeDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleSelectChapter = (chapter: Chapter, allChapters?: Chapter[]) => {
    setSelectedChapter(chapter);
    if (allChapters) {
      setCurrentChapterList(allChapters);
    }
    setIsViewingCharacters(false);
    setIsDrawerOpen(false);
    setIsHomeDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleBackToHome = () => {
    setSelectedNovel(null);
    setSelectedSeries(null);
    setSelectedChapter(null);
    setIsViewingCharacters(false);
    setIsDrawerOpen(false);
    setIsHomeDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleBackFromSeriesDetail = () => {
    setSelectedSeries(null);
    setSelectedNovel(null);
    setSelectedChapter(null);
    setIsViewingCharacters(false);
    setActiveHomeTab('series');
    setIsDrawerOpen(false);
    setIsHomeDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleBackToDetail = () => {
    setSelectedChapter(null);
    setIsViewingCharacters(false);
    setIsDrawerOpen(false);
    setIsHomeDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleOpenCharacters = () => {
    setIsViewingCharacters(true);
    setSelectedChapter(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleBackFromCharacters = () => {
    setIsViewingCharacters(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const currentView = selectedChapter 
    ? 'reader' 
    : (isViewingCharacters && selectedNovel 
        ? 'characters' 
        : (selectedNovel ? 'detail' : (selectedSeries ? 'series_detail' : 'home')));

  const headerTitle = selectedChapter 
    ? (selectedChapter.title || 'Membaca Bab')
    : (isViewingCharacters && selectedNovel 
        ? `Karakter: ${selectedNovel.title}` 
        : (selectedNovel ? selectedNovel.title : (selectedSeries ? selectedSeries.seriesName : undefined)));

  // Keep selectedChapter synced if chapter list updates with new/loaded content
  useEffect(() => {
    if (selectedChapter && currentChapterList.length > 0) {
      const enriched = currentChapterList.find((c) => c.id === selectedChapter.id);
      if (enriched) {
        const currentLen = selectedChapter.content?.trim().length || 0;
        const enrichedLen = enriched.content?.trim().length || 0;
        if (enrichedLen > currentLen || (!selectedChapter.title && enriched.title)) {
          setSelectedChapter(enriched);
        }
      }
    }
  }, [currentChapterList, selectedChapter]);

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-150 ${
      theme === 'dark'
        ? 'bg-[#121212] text-[#EDE8DF]'
        : theme === 'sepia'
        ? 'bg-[#F4EDE0] text-[#2E2114]'
        : 'bg-[#FAF9F5] text-stone-900'
    }`}>
      <Header
        currentView={currentView}
        novelTitle={headerTitle}
        hasActiveAnnouncements={announcements.length > 0}
        announcements={announcements}
        isSplashActive={showInitialSplash}
        onBackToHome={selectedSeries ? handleBackFromSeriesDetail : handleBackToHome}
        onBackToDetail={isViewingCharacters ? handleBackFromCharacters : handleBackToDetail}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenHomeDrawer={() => setIsHomeDrawerOpen(true)}
      />

      {/* Side Drawer Halaman Utama (Hanya bisa dibuka lewat logo header di halaman utama) */}
      <HomeDrawer
        isOpen={isHomeDrawerOpen && currentView === 'home'}
        onClose={() => setIsHomeDrawerOpen(false)}
        announcements={announcements}
        onOpenAnnouncementModal={(idx) => {
          setIsHomeDrawerOpen(false);
          handleOpenAnnouncementModal(idx);
        }}
      />

      {/* Layar Animasi Pembuka Literasi saat Aplikasi Dibuka */}
      <LiterarySplash
        isOpen={showInitialSplash}
        onFinish={() => setShowInitialSplash(false)}
        appName="Pena Indonesia"
        duration={2800}
      />

      {/* Dynamic Announcement Modal */}
      <AnnouncementModal
        isOpen={isAnnouncementModalOpen}
        announcements={announcements}
        initialIndex={selectedAnnouncementIndex}
        onClose={() => setIsAnnouncementModalOpen(false)}
      />

      {/* Modal Pemilih 3 Tema (Terang, Sepia, Gelap) */}
      <ThemeModal />

      <main className="flex-1">
        {currentView === 'home' && (
          <NovelList
            novels={novels}
            loading={loading}
            activeTab={activeHomeTab}
            onChangeTab={setActiveHomeTab}
            onSelectNovel={handleSelectNovel}
            onSelectSeries={handleSelectSeries}
            isOffline={!isOnline || (isConnectionError && novels.length === 0)}
            onRetry={() => setRetryTrigger((prev) => prev + 1)}
          />
        )}

        {currentView === 'series_detail' && selectedSeries && (
          <SeriesDetail
            series={selectedSeries}
            onBack={handleBackFromSeriesDetail}
            onSelectNovel={handleSelectNovel}
          />
        )}

        {currentView === 'detail' && selectedNovel && (
          <NovelDetail
            novel={selectedNovel}
            allNovels={novels}
            onBack={selectedSeries ? () => setSelectedNovel(null) : handleBackToHome}
            onSelectChapter={handleSelectChapter}
            onOpenCharacters={handleOpenCharacters}
            onSelectSeries={handleSelectSeries}
          />
        )}

        {currentView === 'characters' && selectedNovel && (
          <CharacterGallery
            novel={selectedNovel}
            onBack={handleBackFromCharacters}
          />
        )}

        {currentView === 'reader' && selectedChapter && (
          <ChapterReader
            chapter={selectedChapter}
            chapters={currentChapterList}
            onSelectChapter={(chap) => handleSelectChapter(chap, currentChapterList)}
            isDrawerOpen={isDrawerOpen}
            onCloseDrawer={() => setIsDrawerOpen(false)}
            onOpenDrawer={() => setIsDrawerOpen(true)}
            novelId={selectedNovel?.id}
          />
        )}
      </main>
    </div>
  );
}
