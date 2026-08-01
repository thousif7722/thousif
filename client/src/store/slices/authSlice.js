import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';
import { confirmPhoneOtp, sendPhoneOtp, signOutFirebase, signInWithGoogleService, isFirebaseConfigured } from '@/services/firebase';
import toast from 'react-hot-toast';

// ── Thunks ─────────────────────────────────────────────────────────────────────
export const sendOTP = createAsyncThunk('auth/sendOTP', async ({ phone, role }, { rejectWithValue }) => {
  try {
    if (import.meta.env.PROD && isFirebaseConfigured) {
      const res = await sendPhoneOtp(phone);
      return { ...res, role };
    }
    try {
      const res = await sendPhoneOtp(phone);
      return { ...res, role };
    } catch (err) {
      if (import.meta.env.DEV) {
        toast.success('Development Mode Active: Enter OTP to continue');
        return { verificationId: 'mock-verification-id', role };
      }
      throw err;
    }
  } catch (err) {
    return rejectWithValue(err.message || 'Failed to send OTP via SMS');
  }
});

export const verifyOTP = createAsyncThunk('auth/verifyOTP', async (payload, { rejectWithValue }) => {
  try {
    let idToken;
    if (import.meta.env.PROD && isFirebaseConfigured) {
      idToken = await confirmPhoneOtp(payload.otp);
    } else {
      try {
        idToken = await confirmPhoneOtp(payload.otp);
      } catch (e) {
        if (import.meta.env.DEV) {
          idToken = 'dev-bypass-login-' + payload.phone;
        } else {
          throw e;
        }
      }
    }
    const res = await api.post('/auth/firebase-login', {
      idToken,
      role: payload.role,
      name: payload.name,
      referralCode: payload.referralCode,
    });
    const { accessToken, refreshToken, user } = res.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.message || 'OTP verification failed');
  }
});

export const loginWithGoogle = createAsyncThunk('auth/loginWithGoogle', async (role, { rejectWithValue }) => {
  try {
    let idToken;
    if (import.meta.env.PROD && isFirebaseConfigured) {
      idToken = await signInWithGoogleService();
    } else {
      try {
        idToken = await signInWithGoogleService();
      } catch (e) {
        if (import.meta.env.DEV) {
          idToken = 'dev-bypass-login-G-googledev';
        } else {
          throw e;
        }
      }
    }
    const res = await api.post('/auth/firebase-login', {
      idToken,
      role: role || 'customer',
    });
    const { accessToken, refreshToken, user } = res.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.message || 'Google login failed');
  }
});

export const logout = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await api.post('/auth/logout');
  } catch {}
  try {
    await signOutFirebase();
  } catch {}
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
});

export const activatePlusMembership = createAsyncThunk('auth/activatePlus', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/plus', data);
    const { user } = res.data;
    const existingUser = (() => { try { return JSON.parse(localStorage.getItem('user')) || {}; } catch { return {}; } })();
    const updatedUser = { ...existingUser, ...user, isPlusMember: true };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    return updatedUser;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to activate Plus membership');
  }
});

// ── Slice ─────────────────────────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })(),
    accessToken: localStorage.getItem('accessToken'),
    otpSent: false,
    otpPhone: null,
    loading: false,
    error: null,
  },
  reducers: {
    setUser(state, action) { state.user = action.payload; },
    clearError(state) { state.error = null; },
    resetOtp(state) { state.otpSent = false; state.otpPhone = null; },
    updateUser(state, action) { state.user = { ...state.user, ...action.payload }; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendOTP.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(sendOTP.fulfilled, (state, action) => {
        state.loading = false;
        state.otpSent = true;
        state.otpPhone = action.meta.arg.phone;
      })
      .addCase(sendOTP.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        toast.error(action.payload);
      })
      .addCase(verifyOTP.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(verifyOTP.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.otpSent = false;
      })
      .addCase(verifyOTP.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        toast.error(action.payload);
      })
      .addCase(loginWithGoogle.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginWithGoogle.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
      })
      .addCase(loginWithGoogle.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        toast.error(action.payload);
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.otpSent = false;
      })
      .addCase(activatePlusMembership.pending, (state) => {
        state.loading = true;
      })
      .addCase(activatePlusMembership.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        toast.success(action.payload.isPlusMember ? 'Welcome to ServiceHub Plus!' : 'Plus membership updated');
      })
      .addCase(activatePlusMembership.rejected, (state, action) => {
        state.loading = false;
        toast.error(action.payload);
      });
  },
});

export const { setUser, clearError, resetOtp, updateUser } = authSlice.actions;
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => !!state.auth.user;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectUserRole = (state) => state.auth.user?.role;
export default authSlice.reducer;
