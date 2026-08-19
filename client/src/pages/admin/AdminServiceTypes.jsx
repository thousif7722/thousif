import React, { useEffect, useState } from 'react';
import { apiService } from '@/services/api';
import Header from '@/components/common/Header';
import {
  Plus, Edit2, Trash2, Search, X, Check, ChevronRight, Layers, Tag,
  ShieldAlert, Sparkles, FolderPlus, CheckCircle2, AlertTriangle, RefreshCw,
  Folder, ArrowUpDown, Filter, Eye, EyeOff, FileText, ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const PRESET_ICONS = ['❄️', '🧊', '🫧', '🔥', '💧', '⚡', '🔧', '🧹', '🪚', '🎨', '🎥', '📺', '🛠️', '🧰', '🧼', '🚪', '📺', '📻'];
const PRESET_COLORS = ['#0284c7', '#0ea5e9', '#3b82f6', '#ef4444', '#06b6d4', '#d97706', '#475569', '#059669', '#ea580c', '#db2777', '#6366f1', '#8b5cf6'];

export default function AdminServiceTypes() {
  const [categories, setCategories] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // Category Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [catForm, setCatForm] = useState({
    name: '',
    icon: '🛠️',
    color: '#3b82f6',
    image: '',
    shortDescription: '',
    sortOrder: 0,
    status: 'active',
  });

  // Service Type Modal
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeForm, setTypeForm] = useState({
    categoryId: '',
    name: '',
    icon: '🔧',
    description: '',
    sortOrder: 0,
    status: 'active',
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, typeRes] = await Promise.all([
        apiService.getAdminCategories({ includeArchived: 'true' }),
        apiService.getAdminServiceTypes({ includeArchived: 'true' }),
      ]);
      setCategories(catRes.data.data || []);
      setServiceTypes(typeRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load category hierarchy data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Category Modal Handlers
  function openAddCategory() {
    setEditingCategory(null);
    setCatForm({
      name: '',
      icon: '🛠️',
      color: '#3b82f6',
      image: '',
      shortDescription: '',
      sortOrder: categories.length + 1,
      status: 'active',
    });
    setIsCatModalOpen(true);
  }

  function openEditCategory(cat) {
    setEditingCategory(cat);
    setCatForm({
      name: cat.name || '',
      icon: cat.icon || '🛠️',
      color: cat.color || '#3b82f6',
      image: cat.image || '',
      shortDescription: cat.shortDescription || '',
      sortOrder: cat.sortOrder || 0,
      status: cat.status || 'active',
    });
    setIsCatModalOpen(true);
  }

  async function handleSaveCategory(e) {
    e.preventDefault();
    if (!catForm.name.trim()) return toast.error('Category name is required');
    setSubmitting(true);
    try {
      if (editingCategory) {
        await apiService.updateCategory(editingCategory._id, catForm);
        toast.success(`Category "${catForm.name}" updated!`);
      } else {
        await apiService.createCategory(catForm);
        toast.success(`Category "${catForm.name}" created successfully!`);
      }
      setIsCatModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCategory(cat) {
    if (!window.confirm(`Are you sure you want to archive category "${cat.name}"?`)) return;
    try {
      await apiService.deleteCategory(cat._id);
      toast.success(`Category "${cat.name}" archived`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete category');
    }
  }

  // Service Type Modal Handlers
  function openAddType(defaultCatId = '') {
    setEditingType(null);
    setTypeForm({
      categoryId: defaultCatId || (categories[0]?._id || ''),
      name: '',
      icon: '🔧',
      description: '',
      sortOrder: 1,
      status: 'active',
    });
    setIsTypeModalOpen(true);
  }

  function openEditType(st) {
    setEditingType(st);
    setTypeForm({
      categoryId: st.categoryId?._id || st.categoryId || '',
      name: st.name || '',
      icon: st.icon || '🔧',
      description: st.description || '',
      sortOrder: st.sortOrder || 0,
      status: st.status || 'active',
    });
    setIsTypeModalOpen(true);
  }

  async function handleSaveType(e) {
    e.preventDefault();
    if (!typeForm.categoryId) return toast.error('Please select a parent category');
    if (!typeForm.name.trim()) return toast.error('Service type name is required');

    setSubmitting(true);
    try {
      if (editingType) {
        await apiService.updateServiceType(editingType._id, typeForm);
        toast.success(`Service Type "${typeForm.name}" updated!`);
      } else {
        await apiService.createServiceType(typeForm);
        toast.success(`Service Type "${typeForm.name}" created successfully!`);
      }
      setIsTypeModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save service type');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteType(st) {
    if (!window.confirm(`Are you sure you want to archive service type "${st.name}"?`)) return;
    try {
      await apiService.deleteServiceType(st._id);
      toast.success(`Service Type "${st.name}" archived`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete service type');
    }
  }

  // Quick toggle status
  async function toggleCategoryStatus(cat) {
    const nextStatus = cat.status === 'active' ? 'inactive' : 'active';
    try {
      await apiService.updateCategory(cat._id, { status: nextStatus });
      toast.success(`Category ${nextStatus === 'active' ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update status');
    }
  }

  async function toggleTypeStatus(st) {
    const nextStatus = st.status === 'active' ? 'inactive' : 'active';
    try {
      await apiService.updateServiceType(st._id, { status: nextStatus });
      toast.success(`Service Type ${nextStatus === 'active' ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update status');
    }
  }

  // Filtered views
  const filteredCategories = categories.filter(cat => {
    if (selectedCategoryFilter && cat._id !== selectedCategoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return cat.name.toLowerCase().includes(q) || (cat.shortDescription && cat.shortDescription.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <Link to="/admin/services" className="hover:text-primary-600 flex items-center gap-1">
                <ArrowLeft size={13} /> Admin Services
              </Link>
              <span>/</span>
              <span className="text-slate-800">Category Hierarchy</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Layers className="text-primary-600" size={24} />
              Service Categories & Types Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Organize catalog into dynamic main categories and granular service types for streamlined booking & scaling.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              title="Refresh hierarchy"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={openAddCategory}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-all"
            >
              <FolderPlus size={16} /> New Main Category
            </button>
            <button
              onClick={() => openAddType()}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-all"
            >
              <Plus size={16} /> New Service Type
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search category or service type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 shrink-0">
              <Filter size={13} /> Filter:
            </span>
            <button
              onClick={() => setSelectedCategoryFilter('')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedCategoryFilter === '' ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Categories ({categories.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat._id}
                onClick={() => setSelectedCategoryFilter(cat._id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
                  selectedCategoryFilter === cat._id ? 'bg-primary-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{cat.icon}</span> {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Main Category Cards & Service Types List */}
        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
            <RefreshCw className="animate-spin text-primary-600 mx-auto" size={32} />
            <p className="text-xs text-slate-500 font-medium">Loading category hierarchy...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
            <Layers className="text-slate-300 mx-auto" size={48} />
            <p className="text-sm font-bold text-slate-700">No categories found matching your search</p>
            <button onClick={openAddCategory} className="text-xs text-primary-600 font-bold hover:underline">
              + Add a new Category
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredCategories.map((cat) => {
              const typesForCat = serviceTypes.filter(
                (st) => (st.categoryId?._id || st.categoryId) === cat._id
              );
              const isActiveCat = cat.status === 'active';

              return (
                <div
                  key={cat._id}
                  className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-sm ${
                    isActiveCat ? 'border-slate-200 hover:border-slate-300' : 'border-amber-200 bg-amber-50/20'
                  }`}
                >
                  {/* Category Header Bar */}
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0"
                        style={{ backgroundColor: `${cat.color || '#3b82f6'}15`, color: cat.color || '#3b82f6' }}
                      >
                        {cat.icon || '🛠️'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-slate-900 text-base">{cat.name}</h3>
                          <span className="text-[10px] font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">
                            /{cat.slug}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              isActiveCat ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {cat.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          {cat.shortDescription || 'No description provided.'}
                        </p>
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                      <div className="text-right px-3 py-1 bg-white rounded-xl border border-slate-200 text-xs">
                        <span className="font-extrabold text-slate-900">{typesForCat.length}</span>{' '}
                        <span className="text-slate-400">Service Types</span>
                        <span className="mx-1 text-slate-300">•</span>
                        <span className="font-extrabold text-primary-600">{cat.serviceCount || 0}</span>{' '}
                        <span className="text-slate-400">Services</span>
                      </div>

                      <button
                        onClick={() => openAddType(cat._id)}
                        className="bg-primary-50 hover:bg-primary-100 text-primary-700 font-bold text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <Plus size={14} /> Add Service Type
                      </button>

                      <button
                        onClick={() => openEditCategory(cat)}
                        className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
                        title="Edit Category"
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        onClick={() => toggleCategoryStatus(cat)}
                        className={`p-2 rounded-xl border transition-all ${
                          isActiveCat
                            ? 'text-amber-600 hover:bg-amber-50 border-amber-200'
                            : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                        }`}
                        title={isActiveCat ? 'Deactivate Category' : 'Activate Category'}
                      >
                        {isActiveCat ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>

                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-2 text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-all"
                        title="Archive Category"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Service Types Under Category */}
                  <div className="p-4 sm:p-5">
                    {typesForCat.length === 0 ? (
                      <div className="py-6 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 space-y-2">
                        <Tag size={20} className="text-slate-300 mx-auto" />
                        <p className="text-xs text-slate-500 font-medium">No service types defined under this category yet.</p>
                        <button
                          onClick={() => openAddType(cat._id)}
                          className="text-xs text-primary-600 font-bold hover:underline inline-flex items-center gap-1"
                        >
                          <Plus size={12} /> Add First Service Type
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {typesForCat.map((st) => {
                          const isActiveType = st.status === 'active';
                          return (
                            <div
                              key={st._id}
                              className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                                isActiveType
                                  ? 'bg-slate-50/60 hover:bg-white border-slate-200 hover:border-primary-200 hover:shadow-sm'
                                  : 'bg-amber-50/40 border-amber-200 opacity-75'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-base shrink-0 shadow-2xs">
                                  {st.icon || '🔧'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className="font-bold text-slate-800 text-xs truncate leading-snug">
                                      {st.name}
                                    </h4>
                                    <span
                                      className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                                        isActiveType ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                      }`}
                                    >
                                      {st.status}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                                    /{st.slug}
                                  </p>
                                  {st.description && (
                                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                      {st.description}
                                    </p>
                                  )}
                                  <span className="text-[10px] text-slate-400 font-medium inline-block mt-1">
                                    {st.serviceCount || 0} active service catalog items
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => openEditType(st)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all"
                                  title="Edit Service Type"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => toggleTypeStatus(st)}
                                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-all"
                                  title={isActiveType ? 'Deactivate' : 'Activate'}
                                >
                                  {isActiveType ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                                <button
                                  onClick={() => handleDeleteType(st)}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                                  title="Archive"
                                >
                                  <Trash2 size={13} />
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
            })}
          </div>
        )}
      </main>

      {/* ── Category Create / Edit Modal ────────────────────────────────────── */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Folder className="text-primary-600" size={20} />
                {editingCategory ? 'Edit Main Category' : 'Create New Main Category'}
              </h3>
              <button onClick={() => setIsCatModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AC Repair & Services"
                  value={catForm.name}
                  onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Icon Emoji</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={catForm.icon}
                      onChange={(e) => setCatForm((f) => ({ ...f, icon: e.target.value }))}
                      className="w-14 text-center px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base"
                    />
                    <div className="flex-1 flex gap-1 overflow-x-auto items-center p-1 bg-slate-100 rounded-xl">
                      {PRESET_ICONS.slice(0, 7).map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setCatForm((f) => ({ ...f, icon: emoji }))}
                          className="hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Accent Theme Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={catForm.color}
                      onChange={(e) => setCatForm((f) => ({ ...f, color: e.target.value }))}
                      className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={catForm.color}
                      onChange={(e) => setCatForm((f) => ({ ...f, color: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Short Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief summary of services included under this category..."
                  value={catForm.shortDescription}
                  onChange={(e) => setCatForm((f) => ({ ...f, shortDescription: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Display Sort Order</label>
                  <input
                    type="number"
                    value={catForm.sortOrder}
                    onChange={(e) => setCatForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={catForm.status}
                    onChange={(e) => setCatForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Service Type Create / Edit Modal ────────────────────────────────── */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Tag className="text-primary-600" size={20} />
                {editingType ? 'Edit Service Type' : 'Create New Service Type'}
              </h3>
              <button onClick={() => setIsTypeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveType} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Parent Main Category *</label>
                <select
                  required
                  value={typeForm.categoryId}
                  onChange={(e) => setTypeForm((f) => ({ ...f, categoryId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="">Select Category...</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Type Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Normal AC Service, PCB Repair, Gas Leak Detection"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Icon Emoji</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={typeForm.icon}
                    onChange={(e) => setTypeForm((f) => ({ ...f, icon: e.target.value }))}
                    className="w-14 text-center px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base"
                  />
                  <div className="flex-1 flex gap-1 overflow-x-auto items-center p-1 bg-slate-100 rounded-xl">
                    {['🔧', '⚡', '❄️', '🫧', '🧹', '🪚', '🎨', '🎥'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setTypeForm((f) => ({ ...f, icon: emoji }))}
                        className="hover:scale-125 transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Specific details about what this service type encompasses..."
                  value={typeForm.description}
                  onChange={(e) => setTypeForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Display Sort Order</label>
                  <input
                    type="number"
                    value={typeForm.sortOrder}
                    onChange={(e) => setTypeForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={typeForm.status}
                    onChange={(e) => setTypeForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTypeModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingType ? 'Update Service Type' : 'Create Service Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
