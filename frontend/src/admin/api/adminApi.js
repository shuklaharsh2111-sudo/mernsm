const BASE = '/api/admin';

const request = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
};

export const registerAdmin = (body) => request('/auth/register', { method: 'POST', body });
export const loginAdmin = (body) => request('/auth/login', { method: 'POST', body });
export const getMe = (token) => request('/auth/me', { token });
export const updateAvatar = (token, avatar) =>
  request('/auth/avatar', { method: 'PUT', body: { avatar }, token });

// ---------- SOPs ----------
export const getSops = (token, status) =>
  request(`/sops${status && status !== 'all' ? `?status=${status}` : ''}`, { token });
export const createSop = (token, body) => request('/sops', { method: 'POST', body, token });
export const updateSop = (token, id, body) =>
  request(`/sops/${id}`, { method: 'PUT', body, token });
export const reviewSop = (token, id, body) =>
  request(`/sops/${id}/review`, { method: 'PATCH', body, token });
export const deleteSop = (token, id) => request(`/sops/${id}`, { method: 'DELETE', token });
