import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { initDb } from './db.js'
import { generateToken, getOrCreateProfile } from './auth.js'
import { getProfile } from './profile.js'
import { attachRooms } from './rooms.js'
import { logEvent, metricsHandler } from './metrics.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3002
const isProd = process.env.NODE_ENV === 'production'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*' } })
const db = initDb(process.env.DB_PATH)

app.use(express.json())
app.get('/metrics', metricsHandler())

if (isProd) {
  app.use(express.static(join(__dirname, '../dist')))
}

// Token handshake — called by client on load
app.post('/api/auth', (req, res) => {
  const token = req.body.token || generateToken()
  const profile = getOrCreateProfile(db, token)
  const full = getProfile(db, profile.id)
  res.json({ token, profile: full })
})

attachRooms(io, db)

httpServer.listen(PORT, () => {
  logEvent('server_listen', { url: `http://localhost:${PORT}`, metricsPath: '/metrics' })
})
