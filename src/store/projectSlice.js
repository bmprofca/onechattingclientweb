import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../config/api';
import axios from 'axios';
import { Encrypt } from '../pages/encryption/payload-encryption';

// Fetch project info (wallet balance and other info) by project id
export const fetchProjectInfo = createAsyncThunk(
  'project/fetchProjectInfo',
  async (maybeProjectId, { rejectWithValue }) => {
    try {
      // Load tokens and project id from storage
      const stored = (typeof window !== 'undefined') ? localStorage.getItem('userData') : null;
      const parsed = stored ? JSON.parse(stored) : null;

      const token = parsed?.token;
      const username = parsed?.username;
      const selectedProjectId = parsed?.selected_project_id;
      const projectId =
        maybeProjectId ||
        selectedProjectId ||
        parsed?.projects?.[0]?.project_id ||
        '';

      if (!token || !username) {
        return rejectWithValue('Missing auth tokens');
      }
      if (!projectId) {
        return rejectWithValue('Missing project id');
      }

      // Only pass project_id in payload (as requested)
      const payload = { project_id: projectId };
      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });

      const response = await axios.post(
        `${API_BASE_URL}/project/info`,
        data_pass,
        {
          headers: {
            'token': token,
            'username': username,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response?.data?.error) {
        return rejectWithValue(response?.data?.message || 'Failed to fetch project info');
      }

      // Normalize wallet balance and permissions based on actual API shape
      // Expected shape:
      // {
      //   error: false,
      //   project: { balance: number, ... },
      //   permissions: { ... }
      // }
      const root = response?.data ?? {};
      const walletBalance = Number(
        (root.project && root.project.balance != null ? root.project.balance : null) ??
        (root.balance != null ? root.balance : null) ??
        (root.data && root.data.wallet_balance != null ? root.data.wallet_balance : null) ??
        0
      );
      const permissions = root.permissions ?? null;
      const owned = root.project?.owned ?? true; // Default to true if not present for backward compatibility

      return {
        raw: response?.data,
        walletBalance,
        permissions,
        owned,
        subscriptionEndDate: root.project?.subscription_end_date || null,
        projectName: root.project?.name || '',
        projectId
      };
    } catch (err) {
      return rejectWithValue(err?.message || 'Network error');
    }
  }
);

const initialState = {
  walletBalance: 0,
  status: 'idle',
  error: null,
  info: null,
  permissions: null,
  owned: true,
  subscriptionEndDate: null,
  projectName: '',
  projectId: ''
};

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    resetProjectState: () => initialState
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjectInfo.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProjectInfo.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.error = null;
        state.walletBalance = action.payload.walletBalance;
        state.info = action.payload.raw;
        state.permissions = action.payload.permissions;
        state.owned = action.payload.owned;
        state.subscriptionEndDate = action.payload.subscriptionEndDate;
        state.projectName = action.payload.projectName;
        state.projectId = action.payload.projectId;
      })
      .addCase(fetchProjectInfo.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to fetch project info';
      });
  }
});

export const { resetProjectState } = projectSlice.actions;
export default projectSlice.reducer;


