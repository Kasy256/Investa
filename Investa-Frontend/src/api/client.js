import { auth } from "../firebase"

const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1"

async function getAuthHeader() {
  const currentUser = auth.currentUser
  if (!currentUser) return {}
  try {
    const token = await currentUser.getIdToken()
    return { Authorization: `Bearer ${token}` }
  } catch (err) {
    return {}
  }
}

export async function apiFetch(path, options = {}) {
  const baseUrl = DEFAULT_BASE_URL
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(await getAuthHeader()),
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    let errorData
    try {
      errorData = text ? JSON.parse(text) : { error: response.statusText }
    } catch {
      errorData = { error: text || response.statusText }
    }
    const error = new Error(errorData.error || "Request failed")
    error.status = response.status
    error.data = errorData
    throw error
  }

  if (response.status === 204) return null
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) return response.json()
  return response.text()
}

export async function get(path) {
  return apiFetch(path)
}

export async function post(path, body) {
  return apiFetch(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export async function put(path, body) {
  return apiFetch(path, {
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export async function del(path) {
  return apiFetch(path, { method: "DELETE" })
}


