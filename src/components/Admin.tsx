import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { CheckCircle, XCircle, Leaf, Users, Package, TrendingUp } from 'lucide-react';

interface Transaction {
  id: string;
  user_id: string;
  waste_type: string;
  weight: number;
  address: string;
  status: string;
  created_at: string;
  user: {
    full_name: string;
    email: string;
  };
}

interface DashboardStats {
  totalUsers: number;
  totalTransactions: number;
  totalCarbonCredits: number;
  pendingTransactions: number;
}

export default function Admin() {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalTransactions: 0,
    totalCarbonCredits: 0,
    pendingTransactions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);

  // Server-side admin role check via user_roles table
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        setAdminCheckDone(true);
        return;
      }
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!!data);
      setAdminCheckDone(true);
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (adminCheckDone && isAdmin) {
      fetchDashboardData();
    }
  }, [adminCheckDone, isAdmin]);

  const fetchDashboardData = async () => {
    try {
      const [transactionsRes, usersRes, approvedTransactionsRes] = await Promise.all([
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
            user:profiles(full_name, email)
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),

        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true }),

        supabase
          .from('transactions')
          .select('weight, status')
          .eq('status', 'approved')
      ]);

      if (transactionsRes.error) throw transactionsRes.error;

      const formattedTransactions = transactionsRes.data?.map((t: any) => ({
        ...t,
        user: t.user || { full_name: 'Unknown', email: 'unknown@email.com' }
      })) || [];

      setTransactions(formattedTransactions);

      const totalWeight = approvedTransactionsRes.data?.reduce((sum, t) => sum + t.weight, 0) || 0;
      const carbonCredits = Math.round(totalWeight * 2.5);

      setStats({
        totalUsers: usersRes.count || 0,
        totalTransactions: approvedTransactionsRes.data?.length || 0,
        totalCarbonCredits: carbonCredits,
        pendingTransactions: formattedTransactions.length,
      });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (transactionId: string, weight: number, _userId: string) => {
    try {
      const pointsEarned = Math.floor(weight / 10);

      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'approved',
          points_earned: pointsEarned,
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      if (error) throw error;

      alert('Transaksi berhasil disetujui! Poin user telah ditambahkan.');
      fetchDashboardData();
    } catch (error: unknown) {
      const err = error as Error;
      alert('Gagal menyetujui transaksi: ' + err.message);
    }
  };

  const handleReject = async (transactionId: string) => {
    if (!confirm('Apakah Anda yakin ingin menolak transaksi ini?')) {
      return;
    }

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
    } catch (error: unknown) {
      const err = error as Error;
      alert('Gagal menolak transaksi: ' + err.message);
    }
  };

  if (!isAdmin) {
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
      <div className="min-h-screen flex items-center justify-center">
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
        <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-sm text-green-50">Kelola transaksi dan monitor statistik</p>
      </div>

      <div className="px-6 mt-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-100 p-2 rounded-full">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Total User</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-100 p-2 rounded-full">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Transaksi</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalTransactions}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-green-100 p-2 rounded-full">
                <Leaf className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Carbon Credit</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalCarbonCredits}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-yellow-100 p-2 rounded-full">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-800">{stats.pendingTransactions}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-800">Transaksi Pending</h2>
          <p className="text-sm text-gray-600">Review dan approve setor limbah</p>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-md">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Tidak ada transaksi pending</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((transaction) => {
              const pointsWillEarn = Math.floor(transaction.weight / 10);

              return (
                <div key={transaction.id} className="bg-white rounded-2xl p-4 shadow-md">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-800">{transaction.user.full_name}</h3>
                      <p className="text-xs text-gray-500">{transaction.user.email}</p>
                    </div>
                    <span className="bg-yellow-100 text-yellow-700 text-xs font-semibold px-3 py-1 rounded-full">
                      Pending
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Jenis Limbah:</span>
                      <span className="font-semibold text-gray-800">{transaction.waste_type}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Berat:</span>
                      <span className="font-semibold text-gray-800">{transaction.weight} kg</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Poin akan didapat:</span>
                      <span className="font-semibold text-green-600">{pointsWillEarn} poin</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600">Alamat:</span>
                      <p className="text-gray-800 mt-1">{transaction.address}</p>
                    </div>
                    <div className="text-xs text-gray-500">
                      Dibuat: {new Date(transaction.created_at).toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(transaction.id, transaction.weight, transaction.user_id)}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(transaction.id)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-xl flex items-center justify-center gap-2 transition-colors"
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
