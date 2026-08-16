import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchNotifications,
  markAllRead,
  selectNotifications,
  selectUnreadCount,
  selectNotificationLoading,
} from '@/store/slices/notificationSlice';
import Header from '@/components/common/Header';
import { Bell, Check, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { apiService } from '@/services/api';
import toast from 'react-hot-toast';

dayjs.extend(relativeTime);

const TYPE_ICON = {
  complaint:     '📋',
  otp:           '🔐',
  payment:       '💰',
  booking_update:'📦',
  system:        '🔔',
  review:        '⭐',
  announcement:  '📢',
  promotional:   '🎁',
};

export default function NotificationsPage() {
  const dispatch = useDispatch();
  const notifications = useSelector(selectNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const loading = useSelector(selectNotificationLoading);

  // Fetch on mount — Redux merges fetched with real-time ones (no duplicates)
  useEffect(() => {
    dispatch(fetchNotifications({ limit: 50 }));
  }, [dispatch]);

  async function handleMarkAllRead() {
    try {
      dispatch(markAllRead());
    } catch {
      toast.error('Action failed');
    }
  }

  async function handleMarkRead(id) {
    try {
      await apiService.markRead(id);
      // Optimistically update the store \u2014 the full slice already supports isRead patching via fetchNotifications
      dispatch(fetchNotifications({ limit: 50 }));
    } catch {
      toast.error('Failed to mark read');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="pt-20 max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="text-primary-600" /> Notifications
            {unreadCount > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm font-medium text-primary-600 hover:underline flex items-center gap-1"
            >
              <Check size={16} /> Mark all read
            </button>
          )}
        </div>

        {loading && notifications.length === 0 ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card p-4 flex gap-4 animate-pulse">
                <div className="w-10 h-10 bg-slate-200 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="card p-12 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mb-4">
              <Bell size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">All caught up!</h3>
            <p className="text-slate-500 mt-1">You don't have any new notifications</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => {
                const key = n._id || n._clientId || `${n.title}_${n.createdAt}`;
                return (
                  <div
                    key={key}
                    className={`p-4 flex gap-4 transition-colors cursor-pointer ${!n.isRead ? 'bg-primary-50/50' : 'hover:bg-slate-50'}`}
                    onClick={() => n._id && !n.isRead && handleMarkRead(n._id)}
                  >
                    <div className={`w-10 h-10 rounded-full flex justify-center items-center shrink-0 text-lg ${!n.isRead ? 'bg-primary-100' : 'bg-slate-100'}`}>
                      {TYPE_ICON[n.type] || '🔔'}
                    </div>
                    <div className="flex-1">
                      <h4 className={`text-sm ${!n.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {n.title}
                      </h4>
                      <p className={`text-sm mt-0.5 ${!n.isRead ? 'text-slate-700' : 'text-slate-500'}`}>
                        {n.body}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                        <Clock size={12} />
                        {dayjs(n.createdAt).fromNow()}
                      </div>
                    </div>
                    {!n.isRead && (
                      <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
