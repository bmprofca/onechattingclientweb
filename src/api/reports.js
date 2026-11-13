import api from './client';

export async function fetchCampaignReport({
  projectId,
  from,
  to,
  page = 1,
  limit = 25,
  cursor,
  snapshotId,
  signal,
}) {
  const response = await api.post('/project/report', {
    project_id: projectId,
    from,
    to,
    page,
    limit,
    ...(cursor ? { cursor } : {}),
    ...(snapshotId ? { snapshot_id: snapshotId } : {}),
  }, { signal });

  if (response?.error) {
    throw new Error(typeof response.error === 'string' ? response.error : 'Failed to load report.');
  }
  if (!Array.isArray(response?.data?.rows) || !response?.data?.summary || !response?.meta) {
    throw new Error('The report response was incomplete. Please try again.');
  }
  return response;
}
