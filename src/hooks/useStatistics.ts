import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface Statistics {
  totalWasteCollected: number;
  totalCarbonSaved: number;
  userPoints: number;
}

export function useStatistics() {
  const { user, profile } = useAuth();
  const [statistics, setStatistics] = useState<Statistics>({
    totalWasteCollected: 0,
    totalCarbonSaved: 0,
    userPoints: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchStatistics = async () => {
      try {
        const { data: transactions, error } = await supabase
          .from('transactions')
          .select('weight, type, status')
          .eq('user_id', user.id)
          .eq('status', 'approved');

        if (error) throw error;

        const totalWaste = transactions?.reduce((sum, t) => sum + t.weight, 0) || 0;
        const carbonSaved = Math.round(totalWaste * 2.5);

        setStatistics({
          totalWasteCollected: totalWaste,
          totalCarbonSaved: carbonSaved,
          userPoints: profile?.points || 0,
        });
      } catch (error) {
        console.error('Error fetching statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [user, profile]);

  return { statistics, loading };
}
