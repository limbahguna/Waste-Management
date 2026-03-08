import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabaseClient';
import { Clock, TrendingUp, TreePine, Flame, Sprout, Wheat, Recycle, Loader2, Truck, Wallet, Package } from 'lucide-react';
import { toast } from 'sonner';
import LanguageSwitcher from './LanguageSwitcher';
import HowItWorks from './HowItWorks';

interface HomeProps {
  onNavigateToPickup?: () => void;
}

interface UserStats {
  totalWaste: number;
  carbonSaved: number;
}

interface RecentTransaction {
  id: number;
  waste_type: string | null;
  weight_kg: number;
  grade: string | null;
  status: string | null;
  created_at: string | null;
}

// Bilingual translations for Home
const homeT: Record<string, Record<string, string>> = {
  en: {
    supportedMaterials: 'Supported Materials',
    recentActivity: 'Recent Activity',
    noActivity: 'No recent activity yet. Start your first scan!',
    biomass: 'Biomass Energy',
    biomassDesc: 'Wood pellets, rice husks, palm shell, sawdust',
    fertilizer: 'Organic Fertilizer',
    fertilizerDesc: 'Compost, manure, crop residues, biochar',
    animalFeed: 'Animal Feed',
    animalFeedDesc: 'Grain byproducts, bran, dried pulp, silage',
    ecoMaterials: 'Eco-Materials',
    ecoMaterialsDesc: 'Bioboard, fiber insulation, natural packaging',
    trackPickup: 'Track Pickup',
    myWallet: 'My Wallet',
    loading: 'Loading...',
  },
  id: {
    supportedMaterials: 'Limbah yang Diterima',
    recentActivity: 'Aktivitas Terakhir',
    noActivity: 'Belum ada aktivitas. Mulai scan pertama Anda!',
    biomass: 'Energi Biomassa',
    biomassDesc: 'Wood pellet, sekam padi, cangkang sawit, serbuk kayu',
    fertilizer: 'Pupuk Organik',
    fertilizerDesc: 'Kompos, pupuk kandang, sisa tanaman, biochar',
    animalFeed: 'Pakan Ternak',
    animalFeedDesc: 'Hasil samping biji-bijian, dedak, ampas kering, silase',
    ecoMaterials: 'Eko-Material',
    ecoMaterialsDesc: 'Papan bio, insulasi serat, kemasan alami',
    trackPickup: 'Lacak Penjemputan',
    myWallet: 'Dompet Saya',
    loading: 'Memuat...',
  },
};

const materialCards = [
  { key: 'biomass', icon: Flame, color: 'bg-orange-100 text-orange-600' },
  { key: 'fertilizer', icon: Sprout, color: 'bg-emerald-100 text-emerald-600' },
  { key: 'animalFeed', icon: Wheat, color: 'bg-amber-100 text-amber-600' },
  { key: 'ecoMaterials', icon: Recycle, color: 'bg-teal-100 text-teal-600' },
];

export default function Home({ onNavigateToPickup }: HomeProps) {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const ht = homeT[language] || homeT.en;
  const [loading, setLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [carbonAnimating, setCarbonAnimating] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>({ totalWaste: 0, carbonSaved: 0 });

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchData();

    const carbonChannel = supabase
      .channel('carbon-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, (payload) => {
        const newRow = payload.new as any;
        if (newRow?.carbon_saved && newRow.carbon_saved > 0) {
          setCarbonAnimating(true);
          fetchData();
          setTimeout(() => setCarbonAnimating(false), 2000);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, (payload) => {
        const updated = payload.new as any;
        if (updated?.status === 'awaiting_pickup') {
          toast.success(
            language === 'en'
              ? '🚛 Your offer was accepted! Pickup is being scheduled.'
              : '🚛 Penawaran Anda diterima! Penjemputan sedang dijadwalkan.',
            { duration: 5000 }
          );
        }
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(carbonChannel); };
  }, [user, profile]);

  const fetchData = async () => {
    try {
      if (!user?.id) return;

      // Get user stats from approved transactions
      const { data: statsData } = await supabase
        .from('transactions')
        .select('weight_kg, carbon_saved')
        .eq('user_id', user.id)
        .eq('status', 'approved');

      const totalWaste = statsData?.reduce((sum, t) => sum + (t.weight_kg || 0), 0) || 0;
      const carbonSaved = statsData?.reduce((sum, t) => sum + (t.carbon_saved || 0), 0) || totalWaste * 1.5;
      setUserStats({ totalWaste, carbonSaved });

      // Get recent 3 transactions
      const { data: recentData } = await supabase
        .from('transactions')
        .select('id, waste_type, weight_kg, grade, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      setRecentTransactions(recentData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-gray-600">{ht.loading}</p>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return { label: language === 'en' ? 'Completed' : 'Selesai', cls: 'bg-emerald-100 text-emerald-700' };
      case 'awaiting_pickup':
        return { label: language === 'en' ? 'Awaiting Pickup' : 'Menunggu Jemput', cls: 'bg-blue-100 text-blue-700' };
      case 'rejected':
        return { label: language === 'en' ? 'Rejected' : 'Ditolak', cls: 'bg-red-100 text-red-700' };
      default:
        return { label: t('pending'), cls: 'bg-yellow-100 text-yellow-700' };
    }
  };

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Hero Header */}
      <div className="bg-gradient-to-b from-emerald-600 to-emerald-800 text-white rounded-b-3xl shadow-lg relative px-6 pt-16 pb-8">
        <div className="absolute top-6 right-6"><LanguageSwitcher /></div>
        <div className="flex flex-col items-center justify-center text-center">
          <h1 className="text-3xl font-bold mb-3">{t('heroTitle')}</h1>
          <p className="text-base text-emerald-50 opacity-90">{t('heroSubtitle')}</p>
        </div>
      </div>

      <div className="px-6 mt-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
            <div className="flex flex-col">
              <div className="bg-emerald-100 p-3 rounded-full w-fit mb-3"><TrendingUp className="w-6 h-6 text-emerald-600" /></div>
              <p className="text-xs text-gray-600 mb-1">{t('totalWaste')}</p>
              <p className="text-2xl font-bold text-gray-800 mb-1">{userStats.totalWaste}</p>
              <p className="text-xs text-gray-500">{t('collected')}</p>
            </div>
          </div>
          <div className={`bg-white rounded-2xl p-5 shadow-md border transition-all duration-500 ${carbonAnimating ? 'border-emerald-400 shadow-emerald-200 shadow-lg scale-105' : 'border-gray-100'}`}>
            <div className="flex flex-col">
              <div className={`bg-emerald-100 p-3 rounded-full w-fit mb-3 transition-all duration-500 ${carbonAnimating ? 'animate-pulse bg-emerald-300' : ''}`}>
                <TreePine className={`w-6 h-6 text-emerald-600 ${carbonAnimating ? 'animate-bounce' : ''}`} />
              </div>
              <p className="text-xs text-gray-600 mb-1">{t('carbonSaved')}</p>
              <p className={`text-2xl font-bold text-gray-800 mb-1 transition-all duration-300 ${carbonAnimating ? 'text-emerald-600 scale-110' : ''}`}>{userStats.carbonSaved.toFixed(1)}</p>
              <p className="text-xs text-gray-500">kg CO₂</p>
            </div>
          </div>
        </div>

        {/* Supported Materials */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{ht.supportedMaterials}</h2>
          <div className="grid grid-cols-2 gap-3">
            {materialCards.map((mat) => (
              <div key={mat.key} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className={`${mat.color} p-3 rounded-xl w-fit mb-3`}>
                  <mat.icon className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-1">{ht[mat.key]}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{ht[`${mat.key}Desc`]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button onClick={() => onNavigateToPickup?.()}  className="bg-white border border-gray-200 hover:border-emerald-300 hover:shadow-md text-gray-800 font-semibold py-4 px-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-3 mb-2">
            <div className="bg-emerald-100 p-2 rounded-full"><Truck className="w-5 h-5 text-emerald-600" /></div>
            <span className="text-sm">{ht.trackPickup}</span>
          </button>
          <button className="bg-white border border-gray-200 hover:border-emerald-300 hover:shadow-md text-gray-800 font-semibold py-4 px-4 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-3">
            <div className="bg-amber-100 p-2 rounded-full"><Wallet className="w-5 h-5 text-amber-600" /></div>
            <span className="text-sm">{ht.myWallet}</span>
          </button>
        </div>

        {/* Recent Activity */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            {ht.recentActivity}
          </h2>
          {recentTransactions.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{ht.noActivity}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((tx) => {
                const badge = getStatusBadge(tx.status);
                return (
                  <div key={tx.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 text-sm">{tx.waste_type || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">
                          {tx.grade ? `Grade ${tx.grade} • ` : ''}{tx.weight_kg} kg
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
                    </div>
                    {tx.created_at && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {new Date(tx.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Did You Know */}
        <div className="bg-emerald-50 border-l-4 border-emerald-400 rounded-xl p-5 shadow-sm mb-6">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <h3 className="font-bold text-emerald-800 mb-2">{t('didYouKnowTitle')}</h3>
              <p className="text-sm text-emerald-700">{t('didYouKnowText')}</p>
            </div>
          </div>
        </div>
      </div>

      <HowItWorks />
    </div>
  );
}
