const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const DEFAULT_TIMEOUT_MS = 15000;

const getHeaders = () => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async (response) => {
  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }

  if (!response.ok) {
    const message = data.message || 'Something went wrong';
    const error = new Error(message);
    error.status = response.status;
    error.errors = data.errors;
    throw error;
  }
  return data;
};

const request = async (endpoint, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...getHeaders(), ...options.headers },
      signal: controller.signal,
    });
    return await handleResponse(response);
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

export { API_URL };
