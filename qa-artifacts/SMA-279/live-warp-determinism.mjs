import { io } from 'socket.io-client'
import {
  ROOM_PORTALS,
  ROOM_SPAWNS,
  SOCKET_EVENTS as E,
} from '../../shared/constants.js'

const baseUrl = process.env.JUMPER_LIVE_URL ?? 'https://jumper.coldsmokeconsulting.com'
const repeats = Number(process.env.REPEATS ?? 3)
const timeoutMs = 5_000

const routes = Object.entries(ROOM_PORTALS).flatMap(([from, portals]) =>
  portals.map(portal => ({
    from,
    to: portal.to,
    at: { tx: portal.tx, ty: portal.ty },
    landing: portal.landing,
  }))
)

function near(a, b) {
  return Math.abs(a - b) < 0.001
}

function once(socket, event) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs)
    socket.once(event, data => {
      clearTimeout(timeout)
      resolve(data)
    })
  })
}

async function connectProfile() {
  const authRes = await fetch(`${baseUrl}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: null }),
  })
  if (!authRes.ok) throw new Error(`auth failed: ${authRes.status}`)
  const { token } = await authRes.json()
  const socket = io(baseUrl, { transports: ['websocket'], reconnection: false })
  await once(socket, 'connect')
  socket.emit(E.AUTH, { token })
  const auth = await once(socket, E.AUTH_OK)
  return { socket, playerId: auth.playerId, token }
}

async function waitForSelfTick(socket, playerId, predicate = () => true) {
  for (let i = 0; i < 40; i++) {
    const tick = await once(socket, E.TICK)
    const self = tick.players?.find(player => player.id === playerId)
    if (self && predicate(self)) return self
  }
  return null
}

async function joinRoom(socket, roomId, fromPortal = null) {
  socket.emit(E.JOIN_ROOM, { roomId, fromPortal })
  const result = await Promise.race([
    once(socket, E.JOIN_OK).then(joinOk => ({ ok: true, joinOk })),
    once(socket, E.ROOM_DENIED).then(denied => ({ ok: false, denied })),
  ])
  return result
}

async function unlockDeep(socket) {
  await joinRoom(socket, 'overworld')
  socket.emit(E.DISCOVER, {
    action: 'dive',
    wx: 1,
    wy: 10,
    wz: 0,
    itemId: null,
  })
  await once(socket, E.DISCOVER_OK).catch(() => null)
}

async function runRoute(socket, playerId, route, repeat, injectEarlySpawnMove) {
  const sourceJoin = await joinRoom(socket, route.from)
  if (!sourceJoin.ok) {
    return { route, repeat, injectEarlySpawnMove, sourceDenied: sourceJoin.denied, passed: false }
  }

  const fromPortal = { roomId: route.from, tx: route.at.tx, ty: route.at.ty }
  socket.emit(E.JOIN_ROOM, { roomId: route.to, fromPortal })

  if (injectEarlySpawnMove) {
    const spawn = ROOM_SPAWNS[route.to]
    socket.emit(E.MOVE, { x: spawn.tx, y: spawn.ty, z: 0, facing: 'se', seq: repeat + 1 })
  }

  const joinOk = await once(socket, E.JOIN_OK)
  const tick = await waitForSelfTick(socket, playerId, self => self.warp?.id === joinOk.warp?.id)
  const expected = { x: route.landing.tx, y: route.landing.ty, z: 0 }
  const joinMatches = near(joinOk.warp.x, expected.x) && near(joinOk.warp.y, expected.y) && near(joinOk.warp.z, expected.z)
  const tickMatches = !!tick && near(tick.x, expected.x) && near(tick.y, expected.y) && near(tick.z, expected.z)

  return {
    route,
    repeat,
    injectEarlySpawnMove,
    expected,
    destinationSpawn: ROOM_SPAWNS[route.to],
    joinOkWarp: joinOk.warp,
    firstWarpTick: tick,
    joinMatches,
    tickMatches,
    passed: joinMatches && tickMatches,
  }
}

const { socket, playerId, token } = await connectProfile()
try {
  await unlockDeep(socket)

  const samples = []
  for (const route of routes) {
    for (let repeat = 0; repeat < repeats; repeat++) {
      samples.push(await runRoute(socket, playerId, route, repeat, false))
    }
    samples.push(await runRoute(socket, playerId, route, 0, true))
  }

  const report = {
    baseUrl,
    generatedAt: new Date().toISOString(),
    token,
    playerId,
    repeats,
    summary: {
      total: samples.length,
      passed: samples.filter(sample => sample.passed).length,
      failed: samples.filter(sample => !sample.passed).length,
      injectedRaceFailures: samples.filter(sample => sample.injectEarlySpawnMove && !sample.passed).length,
    },
    samples,
  }

  console.log(JSON.stringify(report, null, 2))
} finally {
  socket.close()
}
