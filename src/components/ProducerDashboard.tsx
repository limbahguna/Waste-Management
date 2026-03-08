import { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabaseClient';
import { XCircle, Leaf, Package, TrendingUp, Truck, MapPin, User, Scale, Cpu } from 'lucide-react';
import { toast } from 'sonner';
import CarbonTrendChart from './CarbonTrendChart';
import PickupModal from './PickupModal';
import AIAnalysisModal from './AIAnalysisModal';
const WasteMap = lazy(() => import('./WasteMap'));

interface Transaction {
  id: number;
  user_id: string;
  waste_type: string | null;
  weight_kg: number;
  grade: string | null;
  confidence_score: number | null;
  image_url: string | null;
  address: string | null;
  status: string | null;
  created_at: string | null;
  technical_data: Record<string, unknown> | null;
  eco_partner_message: string | null;
  latitude: number | null;
  longitude: number | null;
  profiles: {
    full_name: string | null;
  } | null;
}

interface DashboardStats {
  totalTransactions: number;
  totalCarbonCredits: number;
  pendingTransactions: number;
}

export default function ProducerDashboard() {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalTransactions: 0,
    totalCarbonCredits: 0,
    pendingTransactions: 0,
  });
  const [carbonTrendData, setCarbonTrendData] = useState<{ date: string; label: string; carbon: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [pickupModal, setPickupModal] = useState<Transaction | null>(null);
  const [analysisModal, setAnalysisModal] = useState<Transaction | null>(null);

  const T = {
    en: {
      dashTitle: 'Producer Dashboard',
      dashSub: 'Manage incoming waste offers from Eco Partners',
      approved: 'Approved',
      carbon: 'Carbon',
      pending: 'Pending',
      incomingOffers: 'Incoming Waste Offers',
      incomingOffersSub: 'Review and accept waste submissions from Eco Partners',
      noOffers: 'No pending offers',
      noOffersSub: 'New waste offers will appear here',
      acceptOffer: 'Accept Offer',
      reject: 'Reject',
      processing: 'Processing...',
      pickupAddress: 'Pickup Address:',
      submitted: 'Submitted:',
      accessDenied: 'Access Denied',
      accessDeniedMsg: 'You do not have access to this page.',
      loadingData: 'Loading data...',
      rewardPoints: 'Reward Points',
      viewAI: 'View AI Analysis',
    },
    id: {
      dashTitle: 'Dashboard Produsen',
      dashSub: 'Kelola penawaran limbah dari Sobat Lingkungan',
      approved: 'Disetujui',
      carbon: 'Carbon',
      pending: 'Pending',
      incomingOffers: 'Penawaran Limbah Masuk',
      incomingOffersSub: 'Review dan terima setoran limbah dari Sobat Lingkungan',
      noOffers: 'Tidak ada penawaran pending',
      noOffersSub: 'Penawaran baru akan muncul di sini',
      acceptOffer: 'Terima / Jemput',
      reject: 'Tolak',
      processing: 'Memproses...',
      pickupAddress: 'Alamat Penjemputan:',
      submitted: 'Dikirim:',
      accessDenied: 'Akses Ditolak',
      accessDeniedMsg: 'Anda tidak memiliki akses ke halaman ini.',
      loadingData: 'Memuat data...',
      rewardPoints: 'Reward Poin',
      viewAI: 'Lihat Analisis AI',
    },
  };
  const t = T[language] || T.en;

  useEffect(() => {
    if (profile?.role === 'producer') {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [transactionsRes, approvedTransactionsRes, carbonTrendRes] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            id, user_id, waste_type, weight_kg, grade, confidence_score,
            image_url, address, status, created_at, technical_data, eco_partner_message,
            latitude, longitude,
            profiles!transactions_user_id_fkey ( full_name )
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),

        supabase
          .from('transactions')
          .select('weight_kg, status')
          .eq('status', 'approved')
          .eq('producer_id', profile!.id),

        supabase
          .from('transactions')
          .select('carbon_saved, created_at')
          .not('carbon_saved', 'is', null)
          .eq('producer_id', profile!.id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: true }),
      ]);

      if (transactionsRes.error) throw transactionsRes.error;

      const formattedTransactions: Transaction[] = (transactionsRes.data || []).map((t: any) => ({
        ...t,
        profiles: Array.isArray(t.profiles) ? t.profiles[0] : t.profiles,
      }));

      setTransactions(formattedTransactions);

      const totalWeight = approvedTransactionsRes.data?.reduce((sum, t) => sum + t.weight_kg, 0) || 0;
      const carbonCredits = Math.round(totalWeight * 2.5);

      setStats({
        totalTransactions: approvedTransactionsRes.data?.length || 0,
        totalCarbonCredits: carbonCredits,
        pendingTransactions: formattedTransactions.length,
      });

      const dailyMap = new Map<string, number>();
      (carbonTrendRes.data || []).forEach((row: any) => {
        const day = new Date(row.created_at).toISOString().slice(0, 10);
        dailyMap.set(day, (dailyMap.get(day) || 0) + Number(row.carbon_saved || 0));
      });

      const trendData = Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, carbon]) => ({
          date,
          label: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
          carbon,
        }));

      setCarbonTrendData(trendData);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (transaction: Transaction, pickupDate: string | null) => {
    setProcessingId(transaction.id);
    try {
      const pointsEarned = Math.floor(transaction.weight_kg * 10);

      const updateData: Record<string, unknown> = {
        status: 'awaiting_pickup',
        producer_id: profile?.id,
        approved_at: new Date().toISOString(),
      };
      if (pickupDate) {
        updateData.pickup_date = pickupDate;
      }

      const [updateResult] = await Promise.all([
        supabase
          .from('transactions')
          .update(updateData)
          .eq('id', transaction.id),

        supabase.rpc('increment_user_points', {
          user_id: transaction.user_id,
          points_to_add: pointsEarned,
        }),
      ]);

      if (updateResult.error) throw updateResult.error;

      toast.success(
        language === 'en'
          ? `Offer accepted! Pickup scheduled. User earns ${pointsEarned} points.`
          : `Penawaran diterima! Penjemputan dijadwalkan. User mendapat ${pointsEarned} poin.`,
        { icon: '✅' }
      );
      setPickupModal(null);
      fetchDashboardData();
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Error approving transaction:', error);
      toast.error(language === 'en' ? 'Failed to accept offer. Please try again.' : 'Gagal menerima penawaran. Silakan coba lagi.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (transactionId: number) => {
    if (!confirm(language === 'en' ? 'Reject this offer?' : 'Tolak penawaran ini?')) return;

    setProcessingId(transactionId);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'rejected',
          producer_id: profile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      if (error) throw error;

      toast.success(language === 'en' ? 'Offer rejected.' : 'Penawaran ditolak.', { icon: '❌' });
      fetchDashboardData();
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Error rejecting transaction:', error);
      toast.error(language === 'en' ? 'Failed to reject offer. Please try again.' : 'Gagal menolak penawaran. Silakan coba lagi.');
    } finally {
      setProcessingId(null);
    }
  };

  if (profile?.role !== 'producer') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{t.accessDenied}</h1>
          <p className="text-gray-600">{t.accessDeniedMsg}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">{t.loadingData}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-br from-green-400 to-green-600 text-white p-6 rounded-b-3xl shadow-lg">
        <h1 className="text-2xl font-bold mb-2">{t.dashTitle}</h1>
        <p className="text-sm text-green-50">{t.dashSub}</p>
      </div>

      <div className="px-6 mt-6">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex flex-col items-center text-center">
              <div className="bg-green-100 p-2 rounded-full mb-2">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-xs text-gray-600">{t.approved}</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalTransactions}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex flex-col items-center text-center">
              <div className="bg-green-100 p-2 rounded-full mb-2">
                <Leaf className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-xs text-gray-600">{t.carbon}</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalCarbonCredits}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex flex-col items-center text-center">
              <div className="bg-yellow-100 p-2 rounded-full mb-2">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-xs text-gray-600">{t.pending}</p>
              <p className="text-2xl font-bold text-gray-800">{stats.pendingTransactions}</p>
            </div>
          </div>
        </div>

        <CarbonTrendChart data={carbonTrendData} />

        {/* Geospatial Waste Map */}
        <Suspense fallback={<div className="bg-white rounded-2xl p-8 text-center shadow-md mb-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div></div>}>
          <WasteMap
            markers={transactions.map(tx => ({
              id: tx.id,
              latitude: tx.latitude ?? 0,
              longitude: tx.longitude ?? 0,
              waste_type: tx.waste_type,
              grade: tx.grade,
              weight_kg: tx.weight_kg,
              image_url: tx.image_url,
            }))}
            language={language}
          />
        </Suspense>

        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-800">{t.incomingOffers}</h2>
          <p className="text-sm text-gray-600">{t.incomingOffersSub}</p>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-md">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-semibold mb-1">{t.noOffers}</p>
            <p className="text-sm text-gray-400">{t.noOffersSub}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => {
              const pointsWillEarn = Math.floor(tx.weight_kg * 10);
              const isProcessing = processingId === tx.id;

              return (
                <div key={tx.id} className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-full">
                        <User className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">{tx.profiles?.full_name || 'Unknown User'}</h3>
                        {tx.grade && (
                          <span className="text-xs font-semibold text-purple-600">Grade {tx.grade} • {tx.confidence_score ? `${tx.confidence_score}%` : ''}</span>
                        )}
                      </div>
                    </div>
                    <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-3 py-1 rounded-full">
                      {t.pending}
                    </span>
                  </div>

                  {/* AI Scan Image */}
                  {tx.image_url && (
                    <div className="mb-3 rounded-xl overflow-hidden border border-gray-200">
                      <img src={tx.image_url} alt="Waste scan" className="w-full h-40 object-cover" />
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        {language === 'en' ? 'Waste Type' : 'Jenis Limbah'}
                      </span>
                      <span className="font-semibold text-gray-800">{tx.waste_type || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-2">
                        <Scale className="w-4 h-4" />
                        {language === 'en' ? 'Weight' : 'Berat'}
                      </span>
                      <span className="font-semibold text-gray-800">{tx.weight_kg} kg</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{t.rewardPoints}</span>
                      <span className="font-bold text-green-600">{pointsWillEarn} poin</span>
                    </div>
                  </div>

                  {tx.address && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 rounded p-3 mb-4">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-blue-800 font-semibold mb-1">{t.pickupAddress}</p>
                          <p className="text-sm text-blue-900">{tx.address}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-500 mb-4">
                    {t.submitted} {tx.created_at && new Date(tx.created_at).toLocaleString(language === 'en' ? 'en-US' : 'id-ID', {
                      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setAnalysisModal(tx)}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      title={t.viewAI}
                    >
                      <Cpu className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPickupModal(tx)}
                      disabled={isProcessing}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Truck className="w-4 h-4" />
                      {isProcessing ? t.processing : t.acceptOffer}
                    </button>
                    <button
                      onClick={() => handleReject(tx.id)}
                      disabled={isProcessing}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-4 h-4" />
                      {t.reject}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PickupModal
        open={!!pickupModal}
        onClose={() => setPickupModal(null)}
        onConfirm={(pickupDate) => pickupModal && handleApprove(pickupModal, pickupDate)}
        loading={processingId !== null}
        userName={pickupModal?.profiles?.full_name || 'Unknown'}
        wasteType={pickupModal?.waste_type || '-'}
        weightKg={pickupModal?.weight_kg || 0}
      />

      <AIAnalysisModal
        open={!!analysisModal}
        onClose={() => setAnalysisModal(null)}
        technicalData={analysisModal?.technical_data as any}
        imageUrl={analysisModal?.image_url || null}
        wasteType={analysisModal?.waste_type || null}
        grade={analysisModal?.grade || null}
      />
    </div>
  );
}
