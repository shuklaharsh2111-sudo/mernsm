import axios from 'axios';
import { playAction, playError } from './notifications/sound';
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
// Sound feedback for every action you take: a soft tick when it worked, a low buzz when it failed.
// Reading data, signing in/out, the notification feed itself and the music player stay silent.
const SILENT = ['/notifications', '/auth', '/music'];
const isAction = (config) => {
  const method = String(config?.method || 'get').toLowerCase();
  if (method === 'get') return false;
  const url = String(config?.url || '');
  return !SILENT.some((p) => url.startsWith(p));
};
api.interceptors.response.use(
  (response) => {
    if (isAction(response.config)) playAction();
    return response;
  },
  (error) => {
    if (error?.response && error.response.status !== 401 && isAction(error.config)) playError();
    return Promise.reject(error);
  }
);
export default api;
