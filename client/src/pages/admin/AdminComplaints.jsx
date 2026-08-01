import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import { Search, AlertTriangle, ShieldAlert, CheckCircle, Clock, RefreshCw, User, Users, Phone, Eye, Wrench, X } from 'lucide-react';
import { StatusBadge, ConfirmModal } from '@/components/common/UI';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState(null); // { type: 'reassign'|'details', complaint }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getAdminComplaints({ page, limit: 20, status: statusFilter || undefined });
      setComplaints(res.data.data);
      setTotal(res.data.pagination.total);
    } catch (err) {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleReassign(complaint) {
    try {
      await apiService.reassignComplaint(complaint._id, 'reassign_provider');
      toast.success('Booking sent for automatic reassignment');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reassignment failed');
    }
    setModal(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="text-red-600" /> Customer Complaints <span className="text-slate-400 font-normal text-lg ml-2">({total})</span>
            </h1>
            <p className="text-sm text-slate-500">Manage disputes, view customer & technician details, and reassign bookings.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex gap-3 flex-wrap bg-slate-50">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input-field py-2 text-sm w-40 bg-white">
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_review">In Review</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
            </select>
            <button onClick={load} className="btn-secondary flex items-center gap-2 text-sm py-2"><RefreshCw size={14} /> Refresh</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Ticket</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Filed By (Customer)</th>
                  <th className="px-6 py-4">Technician (Provider)</th>
                  <th className="px-6 py-4">Booking Info</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-400">Loading complaints...</td></tr>
                ) : complaints.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-400">No complaints found.</td></tr>
                ) : complaints.map(c => {
                  const customer = c.raisedBy || c.bookingId?.customerId;
                  const technician = c.againstUser || c.bookingId?.providerId;

                  return (
                    <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-slate-900">{c.ticketNumber}</div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock size={10} /> {dayjs(c.createdAt).format('MMM D, HH:mm')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${c.severity === 'high' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                          {c.category ? c.category.replace('_', ' ').toUpperCase() : 'GENERAL'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {customer ? (
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <User size={13} className="text-slate-400" />
                              {customer.name}
                            </div>
                            <div className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                              <Phone size={11} className="text-slate-400" />
                              {customer.phone}
                            </div>
                          </div>
                        ) : <span className="text-slate-400 italic">Unknown Customer</span>}
                      </td>
                      <td className="px-6 py-4">
                        {technician ? (
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Wrench size={13} className="text-primary-600" />
                              {technician.name}
                            </div>
                            <div className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                              <Phone size={11} className="text-slate-400" />
                              {technician.phone}
                            </div>
                          </div>
                        ) : <span className="text-slate-400 italic">Not Assigned</span>}
                      </td>
                      <td className="px-6 py-4">
                        {c.bookingId ? (
                          <>
                            <div className="text-slate-900 font-bold font-mono">#{c.bookingId.bookingNumber}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{dayjs(c.bookingId.scheduledDate).format('MMM D, YYYY')}</div>
                          </>
                        ) : <span className="text-slate-400">N/A</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                          c.status === 'open' ? 'bg-blue-100 text-blue-800' :
                          c.status === 'escalated' ? 'bg-red-100 text-red-800 border border-red-300 animate-pulse' :
                          c.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setModal({ type: 'details', complaint: c })}
                            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                          >
                            <Eye size={13} /> View Details
                          </button>
                          {c.status !== 'resolved' && (
                            <button
                              onClick={() => setModal({ type: 'reassign', complaint: c })}
                              className="text-primary-700 font-bold hover:text-primary-900 flex items-center gap-1 text-xs border border-primary-200 bg-primary-50 px-3 py-1.5 rounded-lg hover:bg-primary-100 shadow-sm"
                            >
                              <RefreshCw size={13} /> Reassign
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
            <p className="text-sm text-slate-500">Showing {complaints.length} of {total}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">← Prev</button>
              <span className="px-3 py-1.5 text-sm text-slate-600">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={complaints.length < 20} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Next →</button>
            </div>
          </div>
        </div>

      </div>

      {/* Reassign Modal */}
      <ConfirmModal
        isOpen={modal?.type === 'reassign'}
        title="Reassign Booking?"
        message={`Are you sure you want to remove the current provider and automatically reassign booking #${modal?.complaint?.bookingId?.bookingNumber} to a new technician?`}
        confirmLabel="Reassign Booking"
        variant="primary"
        onConfirm={() => handleReassign(modal.complaint)}
        onCancel={() => setModal(null)}
      />

      {/* Details Modal */}
      {modal?.type === 'details' && (
        <ComplaintDetailsModal
          complaint={modal.complaint}
          onClose={() => setModal(null)}
          onReassign={() => {
            const comp = modal.complaint;
            setModal(null);
            setTimeout(() => setModal({ type: 'reassign', complaint: comp }), 150);
          }}
        />
      )}
    </div>
  );
}

function ComplaintDetailsModal({ complaint, onClose, onReassign }) {
  const customer = complaint.raisedBy || complaint.bookingId?.customerId;
  const technician = complaint.againstUser || complaint.bookingId?.providerId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-extrabold">{complaint.ticketNumber}</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                  complaint.status === 'open' ? 'bg-blue-500 text-white' :
                  complaint.status === 'escalated' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                }`}>
                  {complaint.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Filed on {dayjs(complaint.createdAt).format('DD MMM YYYY, hh:mm A')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">

          {/* Issue Category & Text */}
          <div className="bg-orange-50/80 border border-orange-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-900 bg-orange-200/80 px-2.5 py-1 rounded-md">
                {complaint.category ? complaint.category.replace('_', ' ').toUpperCase() : 'GENERAL ISSUE'}
              </span>
              <span className="text-xs text-orange-700 font-semibold">Severity: {complaint.severity?.toUpperCase() || 'MEDIUM'}</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm mb-1">Customer Description:</h4>
            <p className="text-slate-700 text-sm bg-white p-3 rounded-xl border border-orange-100 leading-relaxed font-medium">
              &ldquo;{complaint.description || 'No description provided.'}&rdquo;
            </p>
          </div>

          {/* Customer & Technician Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Customer Details Card */}
            <div className="card p-4 border-2 border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                <User size={14} className="text-blue-600" /> Filed By (Customer)
              </div>
              {customer ? (
                <div className="space-y-2">
                  <p className="font-extrabold text-slate-900 text-base">{customer.name}</p>
                  <a
                    href={`tel:${customer.phone}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Phone size={12} /> Call: {customer.phone}
                  </a>
                  {customer.email && <p className="text-xs text-slate-500">{customer.email}</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">Customer details unavailable</p>
              )}
            </div>

            {/* Technician Details Card */}
            <div className="card p-4 border-2 border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                <Wrench size={14} className="text-orange-600" /> Technician Assigned
              </div>
              {technician ? (
                <div className="space-y-2">
                  <p className="font-extrabold text-slate-900 text-base">{technician.name}</p>
                  <a
                    href={`tel:${technician.phone}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors"
                  >
                    <Phone size={12} /> Call: {technician.phone}
                  </a>
                  {technician.rating && <p className="text-xs font-bold text-amber-600">⭐ {technician.rating} Rating</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No technician assigned yet</p>
              )}
            </div>

          </div>

          {/* Booking Summary */}
          {complaint.bookingId && (
            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
                <span>BOOKING REFERENCE</span>
                <span>STATUS: {complaint.bookingId.status?.toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-extrabold text-slate-900 font-mono text-lg">#{complaint.bookingId.bookingNumber}</p>
                  <p className="text-xs text-slate-500">Scheduled: {dayjs(complaint.bookingId.scheduledDate).format('DD MMM YYYY')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Total Amount</p>
                  <p className="font-extrabold text-primary-700 text-base">₹{complaint.bookingId.totalAmount?.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex gap-3">
          {complaint.status !== 'resolved' && (
            <button
              onClick={onReassign}
              className="flex-1 btn-primary bg-orange-600 hover:bg-orange-700 py-3 text-sm flex items-center justify-center gap-2 font-bold shadow-md shadow-orange-200"
            >
              <RefreshCw size={15} /> Reassign Booking to New Tech
            </button>
          )}
          <button onClick={onClose} className="btn-secondary py-3 px-6 text-sm font-semibold text-slate-700 bg-white">
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
