// All calls go to our Express backend, never to Moodle directly.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    credentials: 'include', // send the HttpOnly session cookie
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong. Please try again.')
    error.details = data.details // only present in development
    error.status = response.status
    throw error
  }
  return data
}

export const api = {
  courses: () => request('/api/courses'),
  me: () => request('/api/me'),
  login: (email, password) => request('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (payload) => request('/api/register', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request('/api/logout', { method: 'POST' }),
}
