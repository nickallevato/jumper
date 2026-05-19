import { io } from 'socket.io-client'

let _socket = null

export function getSocket() {
  if (!_socket) _socket = io()
  return _socket
}

export async function authenticate() {
  const stored = localStorage.getItem('jumper_token')
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: stored }),
  })
  const { token, profile } = await res.json()
  localStorage.setItem('jumper_token', token)
  return { token, profile }
}
