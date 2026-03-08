import { useState, useEffect } from 'react';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DebugProvider } from './contexts/DebugContext';
import { ScanProvider } from './contexts/ScanContext';
import { useProducts } from './hooks/useProducts';
import Home from './components/Home';
import Marketplace from './components/Marketplace';
import Supply from './components/Supply';
import Calculator from './components/Calculator';
import Profile from './components/Profile';
import ProducerDashboard from './components/ProducerDashboard';
import Auth from './components/Auth';
import LandingPage from './components/LandingPage';
import BottomNav from './components/BottomNav';
import ManageProducts from './pages/ManageProducts';
import AIScan from './components/AIScan';
import RobotCommandCenter from './components/RobotCommandCenter';
import PickupStatus from './components/PickupStatus';
import { Toaster } from 'sonner';

export interface AIScanResult {
  wasteType: string;
  grade: string;
  confidenceScore: number;
  imageDataUrl: string;
  technicalData?: Record<string, unknown>;
  ecoPartnerMessage?: string;
}

type NavigationPage = 'home' | 'marketplace' | 'supply' | 'calculator' | 'profile' | 'producer' | 'manage-products' | 'scan' | 'robot' | 'pickup';

// Navigation history stack for back button support

function AppContent() {
  const { session, profile, loading: authLoading } = useAuth();
  const { products, loading: productsLoading } = useProducts();
  const [currentPage, setCurrentPage] = useState<NavigationPage>('home');
  const [showAuth, setShowAuth] = useState(false);
  const [aiScanResult, setAiScanResult] = useState<AIScanResult | null>(null);
  const [, setNavHistory] = useState<NavigationPage[]>(['home']);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      const state = e.state as { page?: NavigationPage } | null;
      
      if (state?.page) {
        setCurrentPage(state.page);
        setNavHistory(prev => {
          const idx = prev.lastIndexOf(state.page!);
          return idx >= 0 ? prev.slice(0, idx + 1) : prev;
        });
      } else {
        // Go back in our internal history
        setNavHistory(prev => {
          if (prev.length <= 1) return prev;
          const newHistory = prev.slice(0, -1);
          const previousPage = newHistory[newHistory.length - 1];
          setCurrentPage(previousPage);
          return newHistory;
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Push initial history state
  useEffect(() => {
    window.history.replaceState({ page: 'home' }, '', window.location.pathname);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    if (!showAuth) {
      return <LandingPage onGetStarted={() => setShowAuth(true)} />;
    }
    return <Auth onBack={() => setShowAuth(false)} />;
  }

  const handleNavigate = (page: NavigationPage) => {
    if (page === currentPage) return;
    if (page !== 'supply') {
      setAiScanResult(null);
    }
    // Push to browser history
    window.history.pushState({ page }, '', window.location.pathname);
    setNavHistory(prev => [...prev, page]);
    setCurrentPage(page);
  };

  const handleContinueToSupply = (result: AIScanResult) => {
    setAiScanResult(result);
    // Push scan→supply transition so back goes to scan
    window.history.pushState({ page: 'supply' }, '', window.location.pathname);
    setNavHistory(prev => [...prev, 'supply']);
    setCurrentPage('supply');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return profile?.role === 'producer'
          ? <ProducerDashboard />
          : <Home onNavigateToPickup={() => handleNavigate('pickup')} />;
      case 'marketplace':
        return productsLoading ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        ) : (
          <Marketplace products={products} />
        );
      case 'supply':
        return <Supply aiScanResult={aiScanResult} onSuccess={() => handleNavigate('profile')} />;
      case 'calculator':
        return <Calculator />;
      case 'profile':
        return <Profile />;
      case 'producer':
        return <ProducerDashboard />;
      case 'manage-products':
        return <ManageProducts />;
      case 'scan':
        return <AIScan onContinueToSupply={handleContinueToSupply} />;
      case 'robot':
        return <RobotCommandCenter />;
      case 'pickup':
        return <PickupStatus onBack={() => handleNavigate('home')} />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-lg mx-auto bg-white min-h-screen">
        {renderPage()}
        <BottomNav
          currentPage={currentPage}
          onNavigate={handleNavigate}
          userRole={profile?.role || 'public'}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <DebugProvider>
          <ScanProvider>
            <AppContent />
            <Toaster position="top-center" richColors closeButton />
          </ScanProvider>
        </DebugProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
