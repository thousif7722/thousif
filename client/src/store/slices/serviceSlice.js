// serviceSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';

export const fetchServices = createAsyncThunk('service/fetchAll', async (params = {}) => {
  const res = await api.get('/services', { params });
  return res.data.data;
});

export const fetchCategories = createAsyncThunk('service/fetchCategories', async () => {
  const res = await api.get('/services/categories');
  return res.data.data;
});

export const fetchPublicSettings = createAsyncThunk('service/fetchPublicSettings', async () => {
  const res = await api.get('/services/public-settings');
  return res.data.data;
});

const serviceSlice = createSlice({
  name: 'service',
  initialState: { 
    services: [], 
    categories: [], 
    loading: false, 
    selectedCategory: 'All', 
    search: '',
    settings: {
      siteName: 'OneWayFix',
      logoUrl: '/logo.png',
      tagline: 'Premium Home Services at your Doorstep',
      videoSpotlights: [],
    }
  },
  reducers: {
    setSelectedCategory(state, action) { state.selectedCategory = action.payload; },
    setSearch(state, action) { state.search = action.payload; },
    updateSettingsState(state, action) { state.settings = { ...state.settings, ...action.payload }; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchServices.pending, (state) => { state.loading = true; })
      .addCase(fetchServices.fulfilled, (state, action) => {
        state.loading = false;
        state.services = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchServices.rejected, (state) => { state.loading = false; })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        const cats = Array.isArray(action.payload) ? action.payload : [];
        state.categories = ['All', ...cats];
      })
      .addCase(fetchPublicSettings.fulfilled, (state, action) => {
        if (action.payload) state.settings = { ...state.settings, ...action.payload };
      });
  },
});

export const { setSelectedCategory, setSearch, updateSettingsState } = serviceSlice.actions;
export const selectServices = (state) => state.service.services;
export const selectCategories = (state) => state.service.categories;
export const selectServiceLoading = (state) => state.service.loading;
export const selectSelectedCategory = (state) => state.service.selectedCategory;
export const selectPublicSettings = (state) => state.service.settings;
export default serviceSlice.reducer;
