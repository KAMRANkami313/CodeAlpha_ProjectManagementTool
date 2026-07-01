const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const DEFAULT_TIMEOUT_MS = 15000;

const TOKEN_STORAGE_KEYS = {
  access: 'accessToken',
  refresh: 'refreshToken',
};

let accessTokenGetter = () => localStorage.getItem(TOKEN_STORAGE_KEYS.access);
let refreshTokenGetter = () => localStorage.getItem(TOKEN_STORAGE_KEYS.refresh);
let onTokensRefreshed = (data) => {
  if (data?.accessToken) localStorage.setItem(TOKEN_STORAGE_KEYS.access, data.accessToken);
  if (data?.refreshToken) localStorage.setItem(TOKEN_STORAGE_KEYS.refresh, data.refreshToken);
};
let onUnauthorized = () => window.dispatchEvent(new CustomEvent('auth:unauthorized'));

const setTokenAccessors = ({
  getAccess,
  getRefresh,
  onRefreshed,
  onUnauthorized: unauth,
}) => {
  if (getAccess) accessTokenGetter = getAccess;
  if (getRefresh) refreshTokenGetter = getRefresh;
  if (onRefreshed) onTokensRefreshed = onRefreshed;
  if (unauth) onUnauthorized = unauth;
};

const SKIP_REFRESH_PATHS = ['/users/login', '/users/refresh'];

const shouldSkipRefresh = (endpoint) =>
  SKIP_REFRESH_PATHS.some((p) => endpoint === p || endpoint.startsWith(p));

let isRefreshing = false;
let waitQueue = [];

const flushQueue = (success) => {
  waitQueue.forEach((resolve) => resolve(success));
  waitQueue = [];
};

const tryRefresh = async () => {
  const refreshToken = refreshTokenGetter();

  if (!refreshToken) return false;

  if (isRefreshing) {
    return new Promise((resolve) => waitQueue.push(resolve));
  }

  isRefreshing = true;

  try {
    const response = await fetch(`${API_URL}/users/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      flushQueue(false);
      return false;
    }

    const data = await response.json();
    onTokensRefreshed(data);
    flushQueue(true);
    return true;
  } catch (err) {
    flushQueue(false);
    return false;
  } finally {
    isRefreshing = false;
  }
};

const getHeaders = () => {
  const token = accessTokenGetter();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const handleResponse = async (response, endpoint, options, isRetry = false) => {
  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (
    response.status === 401 &&
    !isRetry &&
    !shouldSkipRefresh(endpoint) &&
    refreshTokenGetter()
  ) {
    const refreshed = await tryRefresh();

    if (refreshed) {
      return request(endpoint, options, true);
    }

    onUnauthorized();
  }

  if (!response.ok) {
    if (response.status === 401) {
      onUnauthorized();
    }
    const message = data.message || 'Something went wrong';
    const error = new Error(message);
    error.status = response.status;
    error.errors = data.errors;
    error.details = data.details;
    throw error;
  }

  return data;
};

const request = async (endpoint, options = {}, isRetry = false) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...getHeaders(), ...options.headers },
      signal: options.signal || controller.signal,
    });
    return await handleResponse(response, endpoint, options, isRetry);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) =>
    request(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: (endpoint, body) =>
    request(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: (endpoint, body) =>
    request(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    }),
};

export { setTokenAccessors, TOKEN_STORAGE_KEYS, API_URL };