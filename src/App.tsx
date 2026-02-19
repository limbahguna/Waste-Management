import { useState } from 'react';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DebugProvider } from './contexts/DebugContext';
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
import { Toaster } from 'sonner';

export interface AIScanResult {
  wasteType: string;
  grade: string;
  confidenceScore: number;
  imageDataUrl: string;
}

type NavigationPage = 'home' | 'marketplace' | 'supply' | 'calculator' | 'profile' | 'producer' | 'manage-products' | 'scan' | 'robot';

function AppContent() {
  const { session, profile, loading: authLoading } = useAuth();
  const { products, loading: productsLoading } = useProducts();
  const [currentPage, setCurrentPage] = useState<NavigationPage>('home');
  const [showAuth, setShowAuth] = useState(false);
  const [aiScanResult, setAiScanResult] = useState<AIScanResult | null>(null);

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
    if (page !== 'supply') {
      setAiScanResult(null);
    }
    setCurrentPage(page);
  };

  const handleContinueToSupply = (result: AIScanResult) => {
    setAiScanResult(result);
    setCurrentPage('supply');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home onNavigateToScan={() => setCurrentPage('scan')} />;
      case 'marketplace':
        return productsLoading ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        ) : (
          <Marketplace products={products} />
        );
      case 'supply':
        return <Supply aiScanResult={aiScanResult} onSuccess={() => setCurrentPage('profile')} />;
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
          <AppContent />
          <Toaster position="top-center" richColors closeButton />
        </DebugProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
