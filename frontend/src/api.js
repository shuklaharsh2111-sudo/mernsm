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
export default api;
