const BASE = '/api/sme';

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

export const getSmeMe = (token) => request('/auth/me', { token });
export const updateSmeAvatar = (token, avatar) =>
  request('/auth/avatar', { method: 'PUT', body: { avatar }, token });

export const getMySops = (token) => request('/sops', { token });
export const createMySop = (token, body) => request('/sops', { method: 'POST', body, token });
export const updateMySop = (token, id, body) =>
  request(`/sops/${id}`, { method: 'PUT', body, token });
export const withdrawMySop = (token, id) => request(`/sops/${id}`, { method: 'DELETE', token });
