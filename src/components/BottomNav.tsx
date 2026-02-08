import { ShoppingBag, UploadCloud, User, Home, Scan } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type NavigationPage = 'home' | 'marketplace' | 'supply' | 'calculator' | 'profile' | 'producer' | 'manage-products' | 'scan' | 'robot';

interface BottomNavProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  userRole: 'producer' | 'public';
}

export default function BottomNav({ currentPage, onNavigate, userRole }: BottomNavProps) {
  const { t } = useLanguage();

  const navItems = [
    {
      id: 'home' as NavigationPage,
      labelKey: userRole === 'producer' ? 'navActivity' : 'navHome',
      icon: Home,
      isCenter: false
    },
    { id: 'marketplace' as NavigationPage, labelKey: 'navMarketplace', icon: ShoppingBag, isCenter: false },
    { id: 'supply' as NavigationPage, labelKey: 'navSupply', icon: UploadCloud, isCenter: true },
    { id: 'scan' as NavigationPage, labelKey: 'navScan', icon: Scan, isCenter: false },
    { id: 'profile' as NavigationPage, labelKey: 'navProfile', icon: User, isCenter: false }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="flex justify-around items-center h-16 max-w-screen-lg mx-auto">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                item.isCenter
                  ? 'relative'
                  : ''
              } ${
                isActive ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {item.isCenter ? (
                <div className={`absolute -top-6 ${isActive ? 'bg-green-500' : 'bg-green-400'} hover:bg-green-500 text-white rounded-full p-3 shadow-lg transition-all flex flex-col items-center justify-center`}>
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
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-400 rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
