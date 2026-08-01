import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { Megaphone, Send, Users, Activity, CheckCircle, Radio } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export default function AdminAnnouncements() {
  const [formData, setFormData] = useState({ title: '', body: '', targetRole: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [sentBroadcasts, setSentBroadcasts] = useState([]);

  const loadAnnouncements = useCallback(async () => {
    try {
      const res = await apiService.getAnnouncements();
      if (res.data?.data) {
        setSentBroadcasts(res.data.data);
      }
    } catch (err) {
      console.warn('Failed to load past broadcasts:', err);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  async function handleBroadcast(e) {
    e.preventDefault();
    if (!formData.targetRole) {
      toast.error('Please select a target audience');
      return;
    }
    setLoading(true);
    try {
      const res = await apiService.broadcastAnnouncement(formData);
      toast.success(res.data?.message || 'Announcement broadcasted in real-time!');
      setFormData({ title: '', body: '', targetRole: '' });
      loadAnnouncements();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="py-6 max-w-5xl mx-auto px-4 sm:px-6">
        
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="text-indigo-600" /> Real-Time Push Announcements
          </h1>
          <p className="text-sm text-slate-500 mt-1">Broadcast real-time WebSocket push notifications and internal updates across customers, technicians, and staff.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          
          {/* Composer */}
          <div className="md:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                <Radio size={18} className="text-indigo-600 animate-pulse" /> Compose Live Broadcast
              </h2>
              
              <form onSubmit={handleBroadcast} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Audience</label>
                  <select 
                    required 
                    value={formData.targetRole} 
                    onChange={e => setFormData({...formData, targetRole: e.target.value})} 
                    className="input-field font-medium"
                  >
                    <option value="">Select Audience...</option>
                    <option value="all">🌐 All Users (Everyone)</option>
                    <option value="technician">👷 All Technicians (Providers)</option>
                    <option value="customer">👥 All Customers</option>
                    <option value="staff">🛡️ Internal Team (Staff/Managers)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Announcement Title</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})} 
                    className="input-field" 
                    placeholder="e.g. Platform Maintenance & Festival Offer" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Message Body</label>
                  <textarea 
                    required 
                    rows="5"
                    value={formData.body} 
                    onChange={e => setFormData({...formData, body: e.target.value})} 
                    className="input-field resize-none" 
                    placeholder="Type broadcast message..." 
                  />
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={loading} className="btn-primary w-full flex justify-center items-center gap-2 py-3 text-base shadow-lg shadow-indigo-500/20">
                    {loading ? <Activity className="animate-spin" size={20} /> : <Send size={20} />}
                    {loading ? 'Dispatching Push Notification...' : 'Broadcast Real-Time Now'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Recent Broadcasts */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full">
              <h2 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                <CheckCircle size={18} className="text-emerald-500" /> Sent Broadcast History
              </h2>
              
              <div className="space-y-4">
                {fetching ? (
                  <div className="text-center py-10 text-slate-400 text-sm">
                    Loading broadcast history...
                  </div>
                ) : sentBroadcasts.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">
                    No broadcasts sent yet.
                  </div>
                ) : (
                  sentBroadcasts.map((b, i) => (
                    <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex justify-between items-start mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-indigo-100 text-indigo-700">
                          {b.recipientCount ? `Recipients: ${b.recipientCount}` : 'Broadcast'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {b.createdAt ? dayjs(b.createdAt).format('MMM D, HH:mm') : 'Just now'}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm mb-1">{b.title}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2">{b.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
