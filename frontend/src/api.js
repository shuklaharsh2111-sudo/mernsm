import axios from 'axios';
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});
// The client defaults to JSON. When a FormData body (a file upload) is sent with that header,
// axios turns it into JSON and the file is lost. Drop the header so the browser sends
// multipart/form-data with the correct boundary.
api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // the admin banned this account while the person was signed in
    if (error?.response?.data?.code === 'ACCOUNT_BANNED' && !String(error.config?.url || '').startsWith('/auth/login')) {
      window.dispatchEvent(new CustomEvent('account-banned', { detail: error.response.data }));
    }
    return Promise.reject(error);
  }
);
export default api;
