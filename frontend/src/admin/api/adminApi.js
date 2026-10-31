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

// ---------- Users ----------
export const getUsers = (token) => request('/users', { token });
export const createUser = (token, body) => request('/users', { method: 'POST', body, token });
export const updateUser = (token, id, body) =>
  request(`/users/${id}`, { method: 'PUT', body, token });
export const resetUserPassword = (token, id) =>
  request(`/users/${id}/reset-password`, { method: 'POST', token });
export const setUserActive = (token, id, active) =>
  request(`/users/${id}/active`, { method: 'PATCH', body: { active }, token });
export const deleteUser = (token, id) => request(`/users/${id}`, { method: 'DELETE', token });
<<<<<<< HEAD

// ---------- Companies ----------
export const getCompanies = (token) => request('/companies', { token });
export const createCompany = (token, body) => request('/companies', { method: 'POST', body, token });
export const updateCompany = (token, id, body) =>
  request(`/companies/${id}`, { method: 'PUT', body, token });
export const deleteCompany = (token, id) => request(`/companies/${id}`, { method: 'DELETE', token });
=======
>>>>>>> adc7900227aadaf9e0a6f9f972499593c8ff0896
