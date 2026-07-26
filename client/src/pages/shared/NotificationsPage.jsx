import React, { useEffect, useState, useCallback } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { Bell, Check, Trash2, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import toast from 'react-hot-toast';

dayjs.extend(relativeTime);

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getNotifications({ limit: 50 });
      setNotifications(res.data.data);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleMarkAllRead() {
    try {
      await apiService.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('All marked as read');
    } catch {
      toast.error('Action failed');
    }
  }

  async function handleMarkRead(id) {
    try {
      await apiService.markRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
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
          </h1>
          {notifications.some(n => !n.isRead) && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm font-medium text-primary-600 hover:underline flex items-center gap-1"
            >
              <Check size={16} /> Mark all read
            </button>
          )}
        </div>

        {loading ? (
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
              {notifications.map(n => (
                <div 
                  key={n._id} 
                  className={`p-4 flex gap-4 transition-colors ${!n.isRead ? 'bg-primary-50/50' : 'hover:bg-slate-50'}`}
                  onClick={() => !n.isRead && handleMarkRead(n._id)}
                >
                  <div className={`w-10 h-10 rounded-full flex justify-center items-center shrink-0 ${!n.isRead ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Bell size={20} />
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
