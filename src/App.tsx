import { useState } from 'react';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useProducts } from './hooks/useProducts';
import { useStatistics } from './hooks/useStatistics';
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

type NavigationPage = 'home' | 'marketplace' | 'supply' | 'calculator' | 'profile' | 'producer' | 'manage-products';

function AppContent() {
  const { user, session, profile, loading: authLoading } = useAuth();
  const { products, loading: productsLoading } = useProducts();
  const { statistics, loading: statsLoading } = useStatistics();
  const [currentPage, setCurrentPage] = useState<NavigationPage>('home');
  const [showAuth, setShowAuth] = useState(false);

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

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home />;
      case 'marketplace':
        return productsLoading ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        ) : (
          <Marketplace products={products} />
        );
      case 'supply':
        return <Supply />;
      case 'calculator':
        return <Calculator />;
      case 'profile':
        return <Profile />;
      case 'producer':
        return <ProducerDashboard />;
      case 'manage-products':
        return <ManageProducts />;
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
          onNavigate={setCurrentPage}
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
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
