import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectUserRole } from '@/store/slices/authSlice';
import { apiService } from '@/services/api';
import { getSocket } from '@/services/socket';
import ProviderDebtLockout from './ProviderDebtLockout';

export default function ProviderLockoutGuard({ children }) {
  const role = useSelector(selectUserRole);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const res = await apiService.getMyProfile();
      setProfile(res.data.data);
    } catch (err) {
      console.error('[ProviderLockoutGuard] Failed to load provider profile:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'provider') {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [role]);

  // Listen to real-time socket events for unhold / unlock
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUnlock = () => {
      fetchProfile();
    };

    socket.on('provider:unlocked', handleUnlock);
    socket.on('notification:push', (notif) => {
      if (notif && notif.isOnHold === false) {
        fetchProfile();
      }
    });

    return () => {
      socket.off('provider:unlocked', handleUnlock);
    };
  }, []);

  if (role !== 'provider' || loading) {
    return children;
  }

  const walletBalance = Number(profile?.earnings?.walletBalance || 0);
  const pendingCommission = Number(profile?.earnings?.pendingCommission || 0);
  const isOnHold = !!profile?.earnings?.isOnHold;

  // Determine if provider is locked out due to debt limit
  const isLimitExceeded = isOnHold || pendingCommission >= 500 || walletBalance <= -500;

  if (isLimitExceeded) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <ProviderDebtLockout 
          profile={profile} 
          onUnlocked={() => fetchProfile()} 
        />
      </div>
    );
  }

  return children;
}
