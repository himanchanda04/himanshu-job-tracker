import { useState, useEffect, useCallback } from 'react';
import { getApplications, getStats } from '../api/applications';

/**
 * Fetches the application list and dashboard stats together.
 * Pass filters like { status: 'Interview', search: 'Google' } to narrow results.
 * Call refetch() after any mutation (create / update / delete).
 */
export function useApplications(filters = {}) {
  const [data,    setData]    = useState({ total: 0, data: [] });
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Stringify filters so useCallback dependency comparison works correctly
  const filterKey = JSON.stringify(filters);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, statsRes] = await Promise.all([
        getApplications(JSON.parse(filterKey)),
        getStats(),
      ]);
      setData(appsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { data, stats, loading, error, refetch: fetchAll };
}
