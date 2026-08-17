import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { apiService } from '@/services/api';
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
    const res = await apiService.firebaseLogin({
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

export const loginWithGoogle = createAsyncThunk('auth/loginWithGoogle', async (_, { rejectWithValue }) => {
  try {
    let idToken;
    let googleUserData = null;

    if (import.meta.env.PROD && isFirebaseConfigured) {
      const googleRes = await signInWithGoogleService();
      idToken = googleRes.idToken;
      googleUserData = googleRes.user;
    } else {
      try {
        const googleRes = await signInWithGoogleService();
        idToken = googleRes.idToken;
        googleUserData = googleRes.user;
      } catch (e) {
        if (import.meta.env.DEV) {
          idToken = 'dev-bypass-login-G-googledev';
          googleUserData = { uid: 'dev-google-uid', email: 'dev-google@onewayfix.local', displayName: 'Dev Google User' };
        } else {
          throw e;
        }
      }
    }

    const res = await apiService.googleAuthenticate({ idToken });

    if (res.data.needsPhone || res.data.isNewUser || !res.data.user?.phone) {
      return {
        needsPhone: true,
        isNewUser: Boolean(res.data.isNewUser),
        existingUser: res.data.user || null,
        pendingGoogleUser: {
          idToken,
          ...(res.data.firebaseUser || googleUserData)
        }
      };
    }

    const { accessToken, refreshToken, user } = res.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    return { needsPhone: false, isNewUser: false, accessToken, refreshToken, user };
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.message || 'Google authentication failed');
  }
});

export const completeRegistration = createAsyncThunk('auth/completeRegistration', async ({ idToken, phone, role, name, referralCode }, { rejectWithValue }) => {
  try {
    const res = await apiService.completeRegistration({ idToken, phone, role, name, referralCode });
    const { accessToken, refreshToken, user } = res.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.message || 'Registration failed');
  }
});

export const linkGoogleAccount = createAsyncThunk('auth/linkGoogleAccount', async (_, { rejectWithValue }) => {
  try {
    const googleRes = await signInWithGoogleService();
    const res = await apiService.linkGoogleAccount({ googleIdToken: googleRes.idToken });
    const { user } = res.data;
    const existingUser = (() => { try { return JSON.parse(localStorage.getItem('user')) || {}; } catch { return {}; } })();
    const updatedUser = { ...existingUser, ...user };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    return updatedUser;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || err.message || 'Failed to link Google account');
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

export const fetchUserProfile = createAsyncThunk('auth/fetchUserProfile', async (_, { rejectWithValue }) => {
  try {
    const res = await apiService.getMe();
    const user = res.data.data || res.data.user;
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || 'Failed to fetch user profile');
  }
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
    activeMode: localStorage.getItem('activeMode') || null,
    otpSent: false,
    otpPhone: null,
    needsPhone: false,
    isNewUser: false,
    existingUserToUpdate: null,
    needsRoleSelection: false,
    pendingGoogleUser: null,
    loading: false,
    error: null,
  },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
      if (action.payload) {
        localStorage.setItem('user', JSON.stringify(action.payload));
      }
    },
    clearError(state) { state.error = null; },
    resetOtp(state) { state.otpSent = false; state.otpPhone = null; },
    resetRoleSelection(state) {
      state.needsPhone = false;
      state.isNewUser = false;
      state.existingUserToUpdate = null;
      state.needsRoleSelection = false;
      state.pendingGoogleUser = null;
    },
    updateUser(state, action) {
      state.user = { ...state.user, ...action.payload };
      localStorage.setItem('user', JSON.stringify(state.user));
    },
    setActiveMode(state, action) {
      state.activeMode = action.payload;
      localStorage.setItem('activeMode', action.payload);
    },
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
        if (action.payload.needsPhone) {
          state.needsPhone = true;
          state.isNewUser = action.payload.isNewUser;
          state.existingUserToUpdate = action.payload.existingUser;
          state.pendingGoogleUser = action.payload.pendingGoogleUser;
          state.needsRoleSelection = false;
        } else {
          state.user = action.payload.user;
          state.accessToken = action.payload.accessToken;
          state.needsPhone = false;
          state.isNewUser = false;
          state.existingUserToUpdate = null;
          state.needsRoleSelection = false;
          state.pendingGoogleUser = null;
        }
      })
      .addCase(loginWithGoogle.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        toast.error(action.payload);
      })
      .addCase(completeRegistration.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(completeRegistration.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.needsPhone = false;
        state.isNewUser = false;
        state.existingUserToUpdate = null;
        state.needsRoleSelection = false;
        state.pendingGoogleUser = null;
        toast.success(`Welcome to OneWayFix, ${action.payload.user.name || 'User'}!`);
      })
      .addCase(completeRegistration.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        toast.error(action.payload);
      })
      .addCase(linkGoogleAccount.pending, (state) => { state.loading = true; })
      .addCase(linkGoogleAccount.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        toast.success('Google account linked successfully!');
      })
      .addCase(linkGoogleAccount.rejected, (state, action) => {
        state.loading = false;
        toast.error(action.payload);
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.otpSent = false;
        state.needsPhone = false;
        state.isNewUser = false;
        state.existingUserToUpdate = null;
        state.needsRoleSelection = false;
        state.pendingGoogleUser = null;
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
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { setUser, clearError, resetOtp, resetRoleSelection, updateUser, setActiveMode } = authSlice.actions;
export const selectUser = (state) => state.auth.user;
export const selectActiveMode = (state) => state.auth.activeMode || (state.auth.user?.role === 'provider' ? 'provider' : 'customer');
export const selectIsAuthenticated = (state) => !!state.auth.user;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectUserRole = (state) => state.auth.user?.role;
export const selectNeedsPhone = (state) => state.auth.needsPhone;
export const selectIsNewUser = (state) => state.auth.isNewUser;
export const selectExistingUserToUpdate = (state) => state.auth.existingUserToUpdate;
export const selectNeedsRoleSelection = (state) => state.auth.needsRoleSelection;
export const selectPendingGoogleUser = (state) => state.auth.pendingGoogleUser;
export default authSlice.reducer;
