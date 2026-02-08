import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabaseClient';
import { Package, Clock, User, Scale, MapPin, TrendingUp, TreePine, CheckCircle, ImageIcon, Inbox, Phone } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';

interface Transaction {
  id: string;
  user_id: string;
  waste_type: string;
  weight: number;
  address: string;
  status: string;
  photo_url?: string;
  created_at: string;
  profiles: {
    full_name: string;
    phone?: string;
    email: string;
    address?: string;
  };
}

interface UserStats {
  totalWaste: number;
  carbonSaved: number;
}

interface UserHistory {
  id: string;
  waste_type: string;
  weight: number;
  status: string;
  created_at: string;
}

export default function Home() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<Transaction[]>([]);
  const [userHistory, setUserHistory] = useState<UserHistory[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    totalWaste: 0,
    carbonSaved: 0,
  });

  useEffect(() => {
    console.log('=== Home Component Mounted ===');
    console.log('Profile:', profile);
    console.log('User:', user);

    fetchData();

    // Setup real-time subscription for producer
    if (profile?.role === 'producer') {
      console.log('Setting up real-time subscription for producer...');

      const channel = supabase
        .channel('pending-transactions')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: 'status=eq.pending'
          },
          (payload) => {
            console.log('Real-time update received:', payload);
            fetchData();
          }
        )
        .subscribe((status) => {
          console.log('Subscription status:', status);
        });

      return () => {
        console.log('Cleaning up subscription...');
        supabase.removeChannel(channel);
      };
    }
  }, [profile, user]);

  const fetchData = async () => {
    try {
      // Debug: Log user role
      console.log('Role User:', profile?.role);
      console.log('User ID:', user?.id);

      if (user?.id) {
        const { data, error } = await supabase
          .from('transactions')
          .select('weight')
          .eq('user_id', user.id)
          .eq('type', 'supply')
          .eq('status', 'approved');

        if (error) {
          console.error('Error fetching user stats:', error);
        } else {
          const totalWaste = data?.reduce((sum, t) => sum + (t.weight || 0), 0) || 0;
          const carbonSaved = totalWaste * 1.5;

          setUserStats({
            totalWaste,
            carbonSaved,
          });
        }
      }

      // Fetch pending requests for producers
      if (profile?.role === 'producer') {
        console.log('Fetching pending requests for producer...');

        const { data: requestsData, error: requestsError } = await supabase
          .from('transactions')
          .select(`
            *,
            profiles:user_id ( full_name, phone, address )
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        console.log('Data Request:', requestsData);

        if (requestsError) {
          console.error('Error fetching requests:', requestsError);
          console.error('Error details:', {
            message: requestsError.message,
            details: requestsError.details,
            hint: requestsError.hint,
            code: requestsError.code
          });
        } else {
          console.log(`Found ${requestsData?.length || 0} pending requests`);
          setPendingRequests(requestsData || []);
        }
      }

      // Fetch user history for public users
      if (profile?.role === 'public' && user?.id) {
        console.log('Fetching history for public user...');

        const { data: historyData, error: historyError } = await supabase
          .from('transactions')
          .select('id, waste_type, weight, status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (historyError) {
          console.error('Error fetching history:', historyError);
        } else {
          console.log(`Found ${historyData?.length || 0} history records`);
          setUserHistory(historyData || []);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (transactionId: string) => {
    if (!confirm(t('home.confirmPickup'))) {
      return;
    }

    setApprovingId(transactionId);

    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'approved' })
        .eq('id', transactionId);

      if (error) throw error;

      alert(t('home.requestAccepted'));

      await fetchData();
    } catch (error) {
      console.error('Error approving transaction:', error);
      alert(t('home.requestFailed'));
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-b from-green-600 to-green-800 text-white rounded-b-3xl shadow-lg relative px-6 pt-16 pb-8">
        {/* Tombol Bahasa - Pojok Kanan Atas */}
        <div className="absolute top-6 right-6">
          <LanguageSwitcher />
        </div>

        {/* Teks Hero - Center Aligned */}
        <div className="flex flex-col items-center justify-center text-center">
          <h1 className="text-3xl font-bold mb-3">{t('heroTitle')}</h1>
          <p className="text-base text-green-50 opacity-90">{t('heroSubtitle')}</p>
        </div>
      </div>

      <div className="px-6 mt-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
            <div className="flex flex-col">
              <div className="bg-green-100 p-3 rounded-full w-fit mb-3">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-xs text-gray-600 mb-1">{t('totalWaste')}</p>
              <p className="text-2xl font-bold text-gray-800 mb-1">{userStats.totalWaste}</p>
              <p className="text-xs text-gray-500">{t('collected')}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
            <div className="flex flex-col">
              <div className="bg-green-100 p-3 rounded-full w-fit mb-3">
                <TreePine className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-xs text-gray-600 mb-1">{t('carbonSaved')}</p>
              <p className="text-2xl font-bold text-gray-800 mb-1">{userStats.carbonSaved.toFixed(1)}</p>
              <p className="text-xs text-gray-500">kg CO₂</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">{t('productCategories')}</h2>
          <div className="grid grid-cols-2 gap-4">
            <button className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="flex flex-col items-center">
                <div className="bg-white p-2 rounded-full mb-3 w-28 h-28 flex items-center justify-center">
                  <img
                    src="/wood-pellet.png"
                    alt="Wood Pellet"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-sm font-semibold text-gray-800">{t('woodPellet')}</p>
              </div>
            </button>

            <button className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="flex flex-col items-center">
                <div className="bg-white p-2 rounded-full mb-3 w-28 h-28 flex items-center justify-center">
                  <img
                    src="/cangkang-sawit.png"
                    alt="Cangkang Sawit"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-sm font-semibold text-gray-800">{t('palmShell')}</p>
              </div>
            </button>

            <button className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="flex flex-col items-center">
                <div className="bg-white p-2 rounded-full mb-3 w-28 h-28 flex items-center justify-center">
                  <img
                    src="/serbuk-kayu.png"
                    alt="Serbuk Kayu"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-sm font-semibold text-gray-800">{t('sawdust')}</p>
              </div>
            </button>

            <button className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="flex flex-col items-center">
                <div className="bg-white p-2 rounded-full mb-3 w-28 h-28 flex items-center justify-center">
                  <img
                    src="/wood-chip.png"
                    alt="Wood Chip"
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-sm font-semibold text-gray-800">{t('woodChip')}</p>
              </div>
            </button>
          </div>
        </div>

        {/* Riwayat Penyetoran - Only for Public Users */}
        {profile?.role === 'public' && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" />
              {t('home.historyTitle')}
            </h2>

            {userHistory.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-md border border-gray-100">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-semibold">{t('home.noHistory')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userHistory.map((item) => (
                  <div key={item.id} className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">
                          {t(`wasteTypes.${item.waste_type}`) !== `wasteTypes.${item.waste_type}`
                            ? t(`wasteTypes.${item.waste_type}`)
                            : item.waste_type}
                        </p>
                        <p className="text-sm text-gray-600">{item.weight} kg</p>
                      </div>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                        item.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {item.status === 'approved' ? t('approved') : t('pending')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {new Date(item.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {profile?.role === 'producer' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Inbox className="w-5 h-5 text-green-600" />
                {t('home.producerRequestTitle')}
              </h2>
              {pendingRequests.length > 0 && (
                <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                  {pendingRequests.length} Pending
                </span>
              )}
            </div>

            {pendingRequests.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-md border border-gray-100">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-semibold mb-1">{t('home.noRequest')}</p>
                <p className="text-sm text-gray-400 mb-3">{t('home.requestWillAppear')}</p>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-700">
                    💡 <strong>Info Developer:</strong> RLS sudah dikonfigurasi dengan benar.
                    Sistem siap menerima request dari user dengan role 'public'.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((transaction) => (
                  <div key={transaction.id} className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="bg-green-100 p-2 rounded-full">
                            <User className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-800">{transaction.profiles?.full_name || 'Unknown'}</h3>
                            <p className="text-xs text-gray-500">{transaction.profiles?.email || '-'}</p>
                          </div>
                        </div>
                        {transaction.profiles?.phone && (
                          <div className="flex items-center gap-2 ml-11 bg-blue-50 px-3 py-1.5 rounded-lg w-fit">
                            <Phone className="w-3.5 h-3.5 text-blue-600" />
                            <a
                              href={`tel:${transaction.profiles.phone}`}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                            >
                              {transaction.profiles.phone}
                            </a>
                          </div>
                        )}
                      </div>
                      <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-3 py-1 rounded-full h-fit">
                        Pending
                      </span>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 mb-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          {t('home.wasteType')}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {t(`wasteTypes.${transaction.waste_type}`) !== `wasteTypes.${transaction.waste_type}`
                            ? t(`wasteTypes.${transaction.waste_type}`)
                            : transaction.waste_type}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-2">
                          <Scale className="w-4 h-4" />
                          {t('home.weight')}
                        </span>
                        <span className="font-semibold text-gray-800">{transaction.weight} kg</span>
                      </div>
                    </div>

                    <div className="bg-blue-50 border-l-4 border-blue-400 rounded p-3 mb-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-blue-800 font-semibold mb-1">{t('home.location')}:</p>
                          <p className="text-sm text-blue-900">
                            {transaction.address || transaction.profiles?.address || 'Alamat tidak tersedia'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {transaction.photo_url && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <ImageIcon className="w-4 h-4 text-gray-600" />
                          <p className="text-xs text-gray-600 font-semibold">{t('home.wastePhoto')}:</p>
                        </div>
                        <div className="relative w-full h-48 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                          <img
                            src={transaction.photo_url}
                            alt="Foto Limbah"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `<div class="flex items-center justify-center h-full"><p class="text-gray-400 text-sm">${t('home.photoNotAvailable')}</p></div>`;
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 flex items-center gap-1 mb-4">
                      <Clock className="w-3 h-3" />
                      {new Date(transaction.created_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>

                    <button
                      onClick={() => handleApprove(transaction.id)}
                      disabled={approvingId === transaction.id}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {approvingId === transaction.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          {t('home.processing')}
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          {t('home.acceptButton')}
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-green-50 border-l-4 border-green-400 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <h3 className="font-bold text-green-800 mb-2">{t('didYouKnowTitle')}</h3>
              <p className="text-sm text-green-700">
                {t('didYouKnowText')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
