import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const authHeaders = () => {
  const user = JSON.parse(localStorage.getItem('userData') || '{}');
  return { token: user.token || '', username: user.username || '', 'Content-Type': 'application/json' };
};

export const listDynamicSegments = (projectId) => axios.get(`${API_BASE_URL}/dynamic-segments`, {
  params: { project_id: projectId },
  headers: authHeaders(),
}).then((response) => response.data);

export const previewDynamicSegment = (payload) => axios.post(
  `${API_BASE_URL}/dynamic-segments/preview`,
  payload,
  { headers: authHeaders() },
).then((response) => response.data);

export const getDynamicSegmentContacts = (segmentId, projectId, page = 1) => axios.get(
  `${API_BASE_URL}/dynamic-segments/${encodeURIComponent(segmentId)}/contacts`,
  {
    params: { project_id: projectId, page },
    headers: authHeaders(),
  },
).then((response) => response.data);

export const createDynamicSegment = (payload) => axios.post(
  `${API_BASE_URL}/dynamic-segments`,
  payload,
  { headers: authHeaders() },
).then((response) => response.data);

export const updateDynamicSegment = (segmentId, payload) => axios.put(
  `${API_BASE_URL}/dynamic-segments/${encodeURIComponent(segmentId)}`,
  payload,
  { headers: authHeaders() },
).then((response) => response.data);

export const deleteDynamicSegment = (segmentId, projectId) => axios.delete(
  `${API_BASE_URL}/dynamic-segments/${encodeURIComponent(segmentId)}`,
  { data: { project_id: projectId }, headers: authHeaders() },
).then((response) => response.data);
