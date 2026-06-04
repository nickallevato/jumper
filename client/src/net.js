import { io } from 'socket.io-client'

let _socket = null

export function getSocket() {
  if (!_socket) _socket = io()
  return _socket
}

export function getStoredToken() {
  return localStorage.getItem('jumper_token')
}

export async function authenticate() {
  const stored = getStoredToken()
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: stored }),
    })
    if (!res.ok) throw new Error(`Auth failed: ${res.status}`)
    const { token, profile } = await res.json()
    localStorage.setItem('jumper_token', token)
    return { token, profile }
  } catch (err) {
    throw new Error(`Could not connect to server: ${err.message}`)
  }
}
