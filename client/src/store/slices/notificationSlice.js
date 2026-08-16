import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';

export const fetchNotifications = createAsyncThunk('notification/fetchAll', async (params = {}) => {
  const res = await api.get('/notifications', { params });
  return res.data;
});

export const markAllRead = createAsyncThunk('notification/markAllRead', async () => {
  await api.put('/notifications/read-all');
});

// ── Helper: deduplicate by _id ──────────────────────────────────────────────────
function mergeNotifications(existing, incoming) {
  const seenIds = new Set(existing.map(n => n._id || n._clientId));
  return [
    ...incoming.filter(n => !seenIds.has(n._id || n._clientId)),
    ...existing,
  ];
}

const notificationSlice = createSlice({
  name: 'notification',
  initialState: {
    notifications: [],
    unreadCount: 0,
    loading: false,
    // Track which notification IDs have already been toasted so we never double-toast
    toastedIds: [],
  },
  reducers: {
    /**
     * Add a real-time notification from socket.
     * Deduplicates by _id (if present) or _clientId.
     * Sets `_toasted: false` so socket.js can safely call toast() ONCE,
     * then marks it toasted immediately to prevent re-toasting on re-renders.
     */
    addNotification(state, action) {
      const n = action.payload;
      const id = n._id || n._clientId;

      // Skip if already in store (duplicate prevention)
      if (id && state.notifications.some(x => (x._id || x._clientId) === id)) return;
      // Skip if we've already toasted this id
      if (id && state.toastedIds.includes(id)) return;

      state.notifications.unshift({ ...n, _toasted: !!id });
      state.unreadCount += 1;

      // Remember we toasted it (keep last 100)
      if (id) {
        state.toastedIds = [id, ...state.toastedIds].slice(0, 100);
      }
    },
    decrementUnread(state) {
      if (state.unreadCount > 0) state.unreadCount -= 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.loading = true; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        const fetched = Array.isArray(action.payload?.data) ? action.payload.data : [];
        // Merge fetched with any real-time ones already in store (no duplicates)
        state.notifications = mergeNotifications(state.notifications, fetched);
        state.unreadCount = action.payload?.unreadCount ?? 0;
      })
      .addCase(fetchNotifications.rejected, (state) => { state.loading = false; })
      .addCase(markAllRead.fulfilled, (state) => {
        state.unreadCount = 0;
        state.notifications = state.notifications.map(n => ({ ...n, isRead: true }));
      });
  },
});

export const { addNotification, decrementUnread } = notificationSlice.actions;
export const selectNotifications = (state) => state.notification.notifications;
export const selectUnreadCount = (state) => state.notification.unreadCount;
export const selectNotificationLoading = (state) => state.notification.loading;
export default notificationSlice.reducer;
