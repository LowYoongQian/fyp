import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { apiErrorMessage } from '../utils/apiError';
import { setAccountAvatar } from '../utils/accountAvatar';

export function useAccountProfile() {
  const { user } = useAuth();
  const userId = user?.user_id;
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof apiService.getUserProfile>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const retry = useCallback(async () => {
    const request = ++sequence.current;
    const token = sessionStorage.getItem('auth_token');
    setLoading(true);
    setError('');
    try {
      const result = await apiService.getUserProfile();
      if (request !== sequence.current || token !== sessionStorage.getItem('auth_token')) return;
      if (String(result.user_id) !== String(userId)) throw new Error('Account changed');
      setProfile(result);
    } catch (failure) {
      if (request === sequence.current && token === sessionStorage.getItem('auth_token')) {
        setError(apiErrorMessage(failure, 'Unable to load your account; please retry.'));
      }
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [userId]);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void retry(); });
    return () => { active = false; invalidate(); };
  }, [retry, invalidate]);
  // Keep the shared avatar in step with the loaded/updated profile (upload or URL change refreshes the sidebar and chat).
  useEffect(() => { if (profile && String(profile.user_id) === String(userId)) setAccountAvatar(userId, profile.avatar_url); }, [profile, userId]);
  return { profile, setProfile, loading, error, retry };
}
