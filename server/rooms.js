import { getOrCreateProfile } from './auth.js'
import { getProfile } from './profile.js'
import { getWorldItems, pickupItem, dropItem, useItem } from './items.js'
import { checkDiscovery } from './secrets.js'
import {
  SERVER_SIMULATION_STEP_MS, SERVER_BROADCAST_MS, SERVER_LOOP_POLL_MS,
  ROOM_CAP_SMALL, BOUNCE_VEL, SOCKET_EVENTS as E,
  clampAllowedRoomPosition, fallOutRecoveryPosition, isFallOutPosition, landingForPortalTransition,
} from '../shared/constants.js'
import { isValidTilePosition } from '../shared/coordinates.js'
import { COUNTERWEIGHT, isOnPlate, isAtGoal, PLATE_RADIUS } from '../shared/puzzles.js'
import { findDoorNear } from '../shared/doors.js'

const S = E
export const POST_JOIN_MOVE_GRACE_MS = 250

export function shouldIgnorePostJoinMove(state, now = Date.now()) {
  return Number.isFinite(state?.ignoreMovesUntil) && now < state.ignoreMovesUntil
}

// The item a player currently holds (or null), for private held-state sync.
function heldItemInfo(db, playerId) {
  const p = db.prepare('SELECT held_item_id FROM players WHERE id = ?').get(playerId)
  if (!p?.held_item_id) return null
  return db.prepare('SELECT id, name, passive_effect FROM items WHERE id = ?').get(p.held_item_id)
}

export function attachRooms(io, db) {
  // playerId → { socket, roomId, x, y, z, facing, cosmeticId }
  const players = new Map()
  // roomId → whether that room's counterweight plate is currently weighted
  const puzzleRaised = new Map()
  // roomId → Set of "tx,ty" door tiles that have been opened
  const openDoors = new Map()

  io.on('connection', socket => {
    let playerId = null

    socket.on(S.AUTH, ({ token }) => {
      const profile = getOrCreateProfile(db, token)
      playerId = profile.id
      const full = getProfile(db, playerId)
      players.set(playerId, { socket, roomId: null, x: 8, y: 8, z: 0, facing: 'se', cosmeticId: profile.cosmetic_id })
      socket.emit(S.AUTH_OK, { playerId, profile: full })
    })

    socket.on(S.JOIN_ROOM, ({ roomId, fromPortal }) => {
      if (!playerId) return
      const state = players.get(playerId)
      const previousRoomId = state?.roomId

      const roomSize = [...players.values()].filter(p => p.roomId === roomId).length
      if (roomId.startsWith('small_') && roomSize >= ROOM_CAP_SMALL) {
        return socket.emit(S.ROOM_DENIED, { reason: 'full' })
      }

      const profile = db.prepare('SELECT skill_level FROM players WHERE id = ?').get(playerId)
      const MIN_SKILL = { dungeon_deep: 2, dungeon_sky: 1 }
      if (MIN_SKILL[roomId] && profile.skill_level < MIN_SKILL[roomId]) {
        return socket.emit(S.ROOM_DENIED, { reason: 'skill_level' })
      }

      if (state.roomId) socket.leave(state.roomId)
      state.roomId = roomId
      const portalRef = previousRoomId === fromPortal?.roomId ? fromPortal : null
      const landing = landingForPortalTransition(roomId, portalRef)
      state.x = landing.tx; state.y = landing.ty; state.z = 0
      state.warpId = (state.warpId ?? 0) + 1
      state.lastSeq = undefined
      state.ignoreMovesUntil = Date.now() + POST_JOIN_MOVE_GRACE_MS
      socket.join(roomId)

      const roomPlayers = [...players.entries()]
        .filter(([, p]) => p.roomId === roomId)
        .map(([id, p]) => ({ id, x: p.x, y: p.y, z: p.z, cosmeticId: p.cosmeticId }))

      const doors = [...(openDoors.get(roomId) ?? [])].map(k => {
        const [tx, ty] = k.split(',').map(Number)
        return { tx, ty }
      })
      socket.emit(S.JOIN_OK, {
        players: roomPlayers,
        worldItems: getWorldItems(db, roomId),
        puzzle: { raised: !!puzzleRaised.get(roomId) },
        openDoors: doors,
        warp: { id: state.warpId, x: state.x, y: state.y, z: state.z },
      })
      socket.emit(S.ITEM_HELD, { item: heldItemInfo(db, playerId) })
    })

    socket.on(S.MOVE, ({ x, y, z, facing, seq }) => {
      if (!playerId) return
      if (!isValidTilePosition({ x, y, z })) return
      const state = players.get(playerId)
      if (!state?.roomId) return
      if (shouldIgnorePostJoinMove(state)) return
      // Record the last input we processed so the client can reconcile its
      // prediction against the exact input this authoritative state reflects.
      if (typeof seq === 'number') state.lastSeq = seq
      if (isFallOutPosition(state.roomId, { z })) {
        const spawn = fallOutRecoveryPosition(state.roomId)
        state.x = spawn.x; state.y = spawn.y; state.z = spawn.z; state.facing = facing
        return
      }
      const next = clampAllowedRoomPosition(
        state.roomId,
        { x: state.x, y: state.y, z: state.z },
        { x, y, z },
        openDoors.get(state.roomId) ?? new Set()
      )
      state.x = next.x; state.y = next.y; state.z = next.z; state.facing = facing
    })

    socket.on(S.ITEM_PICKUP, ({ worldItemId }) => {
      if (!playerId) return
      const state = players.get(playerId)
      const result = pickupItem(db, playerId, worldItemId)
      if (!result.ok) return
      io.to(state.roomId).emit(S.ITEM_STATE, { worldItems: getWorldItems(db, state.roomId) })
      socket.emit(S.ITEM_HELD, { item: heldItemInfo(db, playerId) })
    })

    socket.on(S.ITEM_DROP, ({ x, y, z }) => {
      if (!playerId) return
      const state = players.get(playerId)
      const result = dropItem(db, playerId, x, y, z, state.roomId)
      if (!result.ok) return
      io.to(state.roomId).emit(S.ITEM_STATE, { worldItems: getWorldItems(db, state.roomId) })
      socket.emit(S.ITEM_HELD, { item: null })
    })

    socket.on(S.ITEM_USE, ({ triggerId, x, y }) => {
      if (!playerId) return
      const state = players.get(playerId)
      const result = useItem(db, playerId, triggerId)
      if (!result.ok) return

      if (triggerId === 'unlock_door') {
        const door = findDoorNear(state.roomId, x, y)
        if (!door) return
        const key = `${door.tx},${door.ty}`
        if (!openDoors.has(state.roomId)) openDoors.set(state.roomId, new Set())
        if (openDoors.get(state.roomId).has(key)) return   // already open
        openDoors.get(state.roomId).add(key)

        // Consume the Key and tell everyone in the room the door opened.
        db.prepare('UPDATE players SET held_item_id = NULL WHERE id = ?').run(playerId)
        io.to(state.roomId).emit(S.DOOR_OPEN, { tx: door.tx, ty: door.ty })
        socket.emit(S.ITEM_HELD, { item: null })

        const disc = checkDiscovery(db, playerId, {
          action: 'unlock_door', roomId: state.roomId,
          wx: door.tx, wy: door.ty, wz: 0, itemId: null,
        })
        if (disc) socket.emit(S.DISCOVER_OK, disc)
      }
    })

    socket.on(S.EMOTE, ({ type }) => {
      if (!playerId) return
      const state = players.get(playerId)
      if (!state?.roomId) return
      // Relay to everyone else in the room; the emoter shows it locally already.
      socket.to(state.roomId).emit(S.EMOTE, { id: playerId, type })
    })

    socket.on(S.DISCOVER, ({ action, wx, wy, wz, itemId }) => {
      if (!playerId) return
      const state = players.get(playerId)
      const result = checkDiscovery(db, playerId, { action, roomId: state.roomId, wx, wy, wz, itemId })
      if (result) socket.emit(S.DISCOVER_OK, result)
      // Ringing the bell is a world event — everyone, in every room, hears it toll.
      if (action === 'ring_bell') io.emit(S.WORLD_EVENT, { type: 'bell' })
    })

    socket.on('disconnect', () => {
      if (playerId) players.delete(playerId)
    })
  })

  createFixedStepLoop({
    step: ({ simulationTimeMs }) => {
      const byRoom = groupPlayersByRoom(players)
      detectHeadBounces(io, db, byRoom, simulationTimeMs)
      evaluateCounterweight(io, db, byRoom, puzzleRaised)

      // Remember z for next simulation tick's falling check.
      for (const [, p] of players) p._prevZ = p.z
    },
    broadcast: () => {
      const byRoom = groupPlayersByRoom(players)
      broadcastRooms(io, byRoom)
    },
  })
}

export function createFixedStepLoop({
  step,
  broadcast,
  stepMs = SERVER_SIMULATION_STEP_MS,
  broadcastMs = SERVER_BROADCAST_MS,
  pollMs = SERVER_LOOP_POLL_MS,
  now = () => Date.now(),
  setTimer = (fn, ms) => setInterval(fn, ms),
  clearTimer = timer => clearInterval(timer),
}) {
  let lastTime = now()
  let accumulatorMs = 0
  let broadcastAccumulatorMs = 0
  let tick = 0
  let simulationTimeMs = 0

  const runFrame = () => {
    const currentTime = now()
    const elapsedMs = Math.max(0, currentTime - lastTime)
    lastTime = currentTime
    accumulatorMs += elapsedMs
    broadcastAccumulatorMs += elapsedMs

    while (accumulatorMs >= stepMs) {
      tick += 1
      simulationTimeMs += stepMs
      step({ tick, simulationTimeMs, stepMs })
      accumulatorMs -= stepMs
    }

    if (broadcastAccumulatorMs >= broadcastMs) {
      broadcast({ tick, simulationTimeMs, alpha: accumulatorMs / stepMs })
      broadcastAccumulatorMs %= broadcastMs
    }
  }

  const timer = setTimer(runFrame, pollMs)
  return {
    runFrame,
    stop: () => clearTimer(timer),
  }
}

function groupPlayersByRoom(players) {
  const byRoom = new Map()
  for (const [id, p] of players) {
    if (!p.roomId) continue
    if (!byRoom.has(p.roomId)) byRoom.set(p.roomId, [])
    byRoom.get(p.roomId).push([id, p])
  }
  return byRoom
}

function broadcastRooms(io, byRoom) {
  for (const [roomId, list] of byRoom) {
    const playerList = buildRoomPlayerPayload(list)
    io.to(roomId).emit(S.TICK, { players: playerList })
  }
}

export function buildRoomPlayerPayload(list) {
  return list.map(([id, p]) => ({
    id, x: p.x, y: p.y, z: p.z, facing: p.facing, cosmeticId: p.cosmeticId, seq: p.lastSeq,
    warp: p.warpId ? { id: p.warpId } : undefined,
  }))
}

// The Counterweight puzzle: a weighted plate (player OR dropped item) raises a platform,
// and reaching the high goal ledge records a discovery. All authority lives here.
function evaluateCounterweight(io, db, byRoom, puzzleRaised) {
  const { roomId, plate, goal } = COUNTERWEIGHT
  const list = byRoom.get(roomId)
  if (!list) return

  // Weighted by any player standing on the plate (near ground level)...
  let weighted = list.some(([, p]) => p.z < 0.6 && isOnPlate(p.x, p.y, plate))
  // ...or by any dropped world item resting on it.
  if (!weighted) {
    weighted = getWorldItems(db, roomId).some(it =>
      Math.hypot(it.wx - plate.tx, it.wy - plate.ty) < PLATE_RADIUS
    )
  }

  if (weighted !== !!puzzleRaised.get(roomId)) {
    puzzleRaised.set(roomId, weighted)
    io.to(roomId).emit(S.PUZZLE_STATE, { raised: weighted })
  }

  // Reaching the goal ledge (only possible once the platform is up) records the secret.
  for (const [id, p] of list) {
    if (!isAtGoal(p.x, p.y, p.z, goal)) continue
    // Proximity already confirmed; pass the canonical goal tile so the zone check is exact.
    const disc = checkDiscovery(db, id, {
      action: 'reach_counterweight', roomId,
      wx: goal.tx, wy: goal.ty, wz: Math.floor(p.z), itemId: null,
    })
    if (disc) p.socket.emit(S.DISCOVER_OK, disc)
  }
}

// Mechanic 5: when a falling player passes through another's head, bounce them.
function detectHeadBounces(io, db, byRoom, simulationTimeMs) {
  for (const [roomId, list] of byRoom) {
    for (let i = 0; i < list.length; i++) {
      const [aId, a] = list[i]
      const falling = a._prevZ !== undefined && a.z < a._prevZ - 0.001
      if (!falling) continue
      if (a._bounceCd && simulationTimeMs < a._bounceCd) continue

      for (let j = 0; j < list.length; j++) {
        if (i === j) continue
        const [, b] = list[j]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        if (dist < 0.6 && a.z >= b.z && a.z <= b.z + 0.8) {
          a.socket.emit(S.BOUNCE_HEAD, { vel: BOUNCE_VEL })
          a._bounceCd = simulationTimeMs + 600
          const disc = checkDiscovery(db, aId, {
            action: 'head_bounce', roomId,
            wx: Math.floor(a.x), wy: Math.floor(a.y), wz: Math.floor(a.z),
            itemId: null,
          })
          if (disc) a.socket.emit(S.DISCOVER_OK, disc)
          break
        }
      }
    }
  }
}
