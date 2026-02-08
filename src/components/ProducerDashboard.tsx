import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { CheckCircle, XCircle, Leaf, Package, TrendingUp, Truck, MapPin, User, Scale } from 'lucide-react';

interface Transaction {
  id: string;
  user_id: string;
  waste_type: string;
  weight: number;
  address: string;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface DashboardStats {
  totalTransactions: number;
  totalCarbonCredits: number;
  pendingTransactions: number;
}

export default function ProducerDashboard() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalTransactions: 0,
    totalCarbonCredits: 0,
    pendingTransactions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role === 'producer') {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      const [transactionsRes, approvedTransactionsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            id,
            user_id,
            waste_type,
            weight,
            address,
            status,
            created_at,
            profiles!transactions_user_id_fkey (
              full_name,
              email
            )
          `)
          .eq('status', 'pending')
          .eq('type', 'supply')
          .order('created_at', { ascending: false }),

        supabase
          .from('transactions')
          .select('weight, status')
          .eq('status', 'approved')
          .eq('type', 'supply')
      ]);

      if (transactionsRes.error) throw transactionsRes.error;

      setTransactions(transactionsRes.data || []);

      const totalWeight = approvedTransactionsRes.data?.reduce((sum, t) => sum + t.weight, 0) || 0;
      const carbonCredits = Math.round(totalWeight * 2.5);

      setStats({
        totalTransactions: approvedTransactionsRes.data?.length || 0,
        totalCarbonCredits: carbonCredits,
        pendingTransactions: transactionsRes.data?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (transactionId: string, weight: number, userId: string) => {
    setProcessingId(transactionId);
    try {
      const pointsEarned = Math.floor(weight * 10);

      const [updateTransactionResult, updateProfileResult] = await Promise.all([
        supabase
          .from('transactions')
          .update({
            status: 'approved',
            points_earned: pointsEarned,
            approved_by: profile?.id,
            approved_at: new Date().toISOString(),
          })
          .eq('id', transactionId),

        supabase.rpc('increment_user_points', {
          user_id: userId,
          points_to_add: pointsEarned
        })
      ]);

      if (updateTransactionResult.error) throw updateTransactionResult.error;

      alert(`Transaksi berhasil disetujui! User mendapat ${pointsEarned} poin.`);
      fetchDashboardData();
    } catch (error: any) {
      console.error('Error approving transaction:', error);
      alert('Gagal menyetujui transaksi: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (transactionId: string) => {
    if (!confirm('Apakah Anda yakin ingin menolak transaksi ini?')) {
      return;
    }

    setProcessingId(transactionId);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'rejected',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      if (error) throw error;

      alert('Transaksi berhasil ditolak.');
      fetchDashboardData();
    } catch (error: any) {
      console.error('Error rejecting transaction:', error);
      alert('Gagal menolak transaksi: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (profile?.role !== 'producer') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Akses Ditolak</h1>
          <p className="text-gray-600">Anda tidak memiliki akses ke halaman ini.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-br from-green-400 to-green-600 text-white p-6 rounded-b-3xl shadow-lg">
        <h1 className="text-2xl font-bold mb-2">Dashboard Produsen</h1>
        <p className="text-sm text-green-50">Kelola penawaran limbah dari masyarakat</p>
      </div>

      <div className="px-6 mt-6">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex flex-col items-center text-center">
              <div className="bg-green-100 p-2 rounded-full mb-2">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-xs text-gray-600">Disetujui</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalTransactions}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex flex-col items-center text-center">
              <div className="bg-green-100 p-2 rounded-full mb-2">
                <Leaf className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-xs text-gray-600">Carbon</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalCarbonCredits}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex flex-col items-center text-center">
              <div className="bg-yellow-100 p-2 rounded-full mb-2">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-xs text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-800">{stats.pendingTransactions}</p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-800">Penawaran Masuk</h2>
          <p className="text-sm text-gray-600">Review dan terima setoran limbah dari Sobat Lingkungan</p>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-md">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-semibold mb-1">Tidak ada penawaran pending</p>
            <p className="text-sm text-gray-400">Penawaran baru akan muncul di sini</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((transaction) => {
              const pointsWillEarn = Math.floor(transaction.weight * 10);
              const isProcessing = processingId === transaction.id;

              return (
                <div key={transaction.id} className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-full">
                        <User className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">{transaction.profiles?.full_name || 'Unknown User'}</h3>
                        <p className="text-xs text-gray-500">{transaction.profiles?.email || '-'}</p>
                      </div>
                    </div>
                    <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-3 py-1 rounded-full">
                      Pending
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Jenis Limbah
                      </span>
                      <span className="font-semibold text-gray-800">{transaction.waste_type}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-2">
                        <Scale className="w-4 h-4" />
                        Berat
                      </span>
                      <span className="font-semibold text-gray-800">{transaction.weight} kg</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Reward Poin</span>
                      <span className="font-bold text-green-600">{pointsWillEarn} poin</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 border-l-4 border-blue-400 rounded p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-blue-800 font-semibold mb-1">Alamat Penjemputan:</p>
                        <p className="text-sm text-blue-900">{transaction.address}</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mb-4">
                    Dikirim: {new Date(transaction.created_at).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(transaction.id, transaction.weight, transaction.user_id)}
                      disabled={isProcessing}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Truck className="w-4 h-4" />
                      {isProcessing ? 'Memproses...' : 'Terima / Jemput'}
                    </button>
                    <button
                      onClick={() => handleReject(transaction.id)}
                      disabled={isProcessing}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-4 h-4" />
                      Tolak
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
