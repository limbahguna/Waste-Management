import { ShoppingBag, Camera, User, Home, Calculator } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type NavigationPage = 'home' | 'marketplace' | 'supply' | 'calculator' | 'profile' | 'producer' | 'manage-products' | 'scan' | 'robot' | 'pickup';

interface BottomNavProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  userRole: 'producer' | 'public';
}

export default function BottomNav({ currentPage, onNavigate, userRole }: BottomNavProps) {
  const { t } = useLanguage();

  // 5 tabs: Beranda, Pasar, Setor (center), Kalkulator, Profil
  const navItems = [
    {
      id: 'home' as NavigationPage,
      labelKey: userRole === 'producer' ? 'navActivity' : 'navHome',
      icon: Home,
      isCenter: false
    },
    { id: 'marketplace' as NavigationPage, labelKey: 'navMarketplace', icon: ShoppingBag, isCenter: false },
    { id: 'scan' as NavigationPage, labelKey: 'navAIScan', icon: Camera, isCenter: true },
    { id: 'calculator' as NavigationPage, labelKey: 'navCalculator', icon: Calculator, isCenter: false },
    { id: 'profile' as NavigationPage, labelKey: 'navProfile', icon: User, isCenter: false }
  ];

  // Haptic feedback simulation
  const handleNavigate = (page: NavigationPage) => {
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    onNavigate(page);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="flex justify-around items-center h-16 max-w-screen-lg mx-auto">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                item.isCenter
                  ? 'relative'
                  : ''
              } ${
                isActive ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {item.isCenter ? (
                <div className={`absolute -top-6 ${isActive ? 'bg-emerald-500' : 'bg-emerald-400'} hover:bg-emerald-500 text-white rounded-full p-3 shadow-lg transition-all flex flex-col items-center justify-center`}>
                  <Icon className="w-6 h-6" />
                  <span className="text-[10px] font-bold mt-0.5 leading-none">
                    {t(item.labelKey)}
                  </span>
                </div>
              ) : (
                <>
                  <Icon className={`w-6 h-6 mb-1 ${isActive ? 'stroke-[2.5]' : ''}`} />
                  <span className={`text-xs ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {t(item.labelKey)}
                  </span>
                </>
              )}
              {isActive && !item.isCenter && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-400 rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
