import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft, Wallet as WalletIcon, Clock, Loader2, ArrowDownCircle, Package } from 'lucide-react';
import { toast } from 'sonner';

interface WalletProps {
  onBack: () => void;
}

interface WalletTransaction {
  id: number;
  waste_type: string | null;
  price_offer: number | null;
  status: string | null;
  created_at: string | null;
}

const walletT: Record<string, Record<string, string>> = {
  en: {
    title: 'My Wallet',
    availableBalance: 'Available Balance',
    pending: 'Pending',
    withdraw: 'Withdraw Funds',
    withdrawToast: 'Withdrawal feature coming soon!',
    recentTransactions: 'Recent Transactions',
    noTransactions: 'No transactions yet',
    noTransactionsDesc: 'Your completed transactions will appear here.',
    loading: 'Loading...',
    completed: 'Completed',
    awaitingPickup: 'Awaiting Pickup',
    approved: 'Approved',
    pendingStatus: 'Pending',
    rejected: 'Rejected',
  },
  id: {
    title: 'Dompetku',
    availableBalance: 'Saldo Aktif',
    pending: 'Tertunda',
    withdraw: 'Tarik Dana',
    withdrawToast: 'Fitur penarikan segera hadir!',
    recentTransactions: 'Riwayat Transaksi',
    noTransactions: 'Belum ada transaksi',
    noTransactionsDesc: 'Transaksi yang selesai akan muncul di sini.',
    loading: 'Memuat...',
    completed: 'Selesai',
    awaitingPickup: 'Menunggu Jemput',
    approved: 'Disetujui',
    pendingStatus: 'Menunggu',
    rejected: 'Ditolak',
  },
};

export default function Wallet({ onBack }: WalletProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = walletT[language] || walletT.en;

  const [loading, setLoading] = useState(true);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchWalletData();
  }, [user]);

  const fetchWalletData = async () => {
    if (!user?.id) return;
    try {
      // Fetch completed transactions for available balance
      const { data: completedData } = await supabase
        .from('transactions')
        .select('price_offer')
        .eq('user_id', user.id)
        .in('status', ['completed', 'paid']);

      const available = completedData?.reduce((sum, tx) => sum + (tx.price_offer || 0), 0) || 0;
      setAvailableBalance(available);

      // Fetch pending transactions for pending balance
      const { data: pendingData } = await supabase
        .from('transactions')
        .select('price_offer')
        .eq('user_id', user.id)
        .in('status', ['awaiting_pickup', 'approved', 'pending']);

      const pending = pendingData?.reduce((sum, tx) => sum + (tx.price_offer || 0), 0) || 0;
      setPendingBalance(pending);

      // Fetch recent transactions for history
      const { data: historyData } = await supabase
        .from('transactions')
        .select('id, waste_type, price_offer, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setTransactions(historyData || []);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    `Rp ${amount.toLocaleString('id-ID')}`;

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
      case 'paid':
        return { label: t.completed, cls: 'bg-emerald-100 text-emerald-700' };
      case 'awaiting_pickup':
        return { label: t.awaitingPickup, cls: 'bg-blue-100 text-blue-700' };
      case 'approved':
        return { label: t.approved, cls: 'bg-teal-100 text-teal-700' };
      case 'rejected':
        return { label: t.rejected, cls: 'bg-red-100 text-red-700' };
      default:
        return { label: t.pendingStatus, cls: 'bg-yellow-100 text-yellow-700' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-gray-600">{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-emerald-600 to-emerald-800 text-white rounded-b-3xl shadow-lg px-6 pt-14 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">{t.title}</h1>
        </div>

        {/* Balance Card */}
        <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/20 p-3 rounded-full">
              <WalletIcon className="w-6 h-6" />
            </div>
            <p className="text-sm text-emerald-100">{t.availableBalance}</p>
          </div>
          <p className="text-3xl font-bold mb-3">{formatCurrency(availableBalance)}</p>
          <div className="flex items-center gap-2 text-emerald-200 text-sm">
            <Clock className="w-4 h-4" />
            <span>{t.pending}: {formatCurrency(pendingBalance)}</span>
          </div>
        </div>

        {/* Withdraw Button */}
        <button
          onClick={() => toast.info(t.withdrawToast)}
          className="w-full mt-4 bg-white text-emerald-700 font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors shadow-md"
        >
          <ArrowDownCircle className="w-5 h-5" />
          {t.withdraw}
        </button>
      </div>

      {/* Transaction History */}
      <div className="px-6 mt-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">{t.recentTransactions}</h2>

        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700 mb-1">{t.noTransactions}</p>
            <p className="text-sm text-gray-500">{t.noTransactionsDesc}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => {
              const badge = getStatusBadge(tx.status);
              return (
                <div key={tx.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-800 text-sm">{tx.waste_type || '-'}</p>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {tx.created_at
                        ? new Date(tx.created_at).toLocaleDateString(
                            language === 'en' ? 'en-US' : 'id-ID',
                            { day: 'numeric', month: 'short', year: 'numeric' }
                          )
                        : '-'}
                    </p>
                    <p className="text-sm font-bold text-gray-800">
                      {tx.price_offer ? formatCurrency(tx.price_offer) : '-'}
                    </p>
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
