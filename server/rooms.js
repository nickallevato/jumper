import { getOrCreateProfile } from './auth.js'
import { getProfile } from './profile.js'
import { getWorldItems, pickupItem, dropItem, useItem } from './items.js'
import { checkDiscovery } from './secrets.js'
import { TICK_MS, ROOM_CAP_SMALL, SOCKET_EVENTS as E } from '../shared/constants.js'

const S = E

export function attachRooms(io, db) {
  // playerId → { socket, roomId, x, y, z, facing, cosmeticId }
  const players = new Map()

  io.on('connection', socket => {
    let playerId = null

    socket.on(S.AUTH, ({ token }) => {
      const profile = getOrCreateProfile(db, token)
      playerId = profile.id
      const full = getProfile(db, playerId)
      players.set(playerId, { socket, roomId: null, x: 8, y: 8, z: 0, facing: 'se', cosmeticId: profile.cosmetic_id })
      socket.emit(S.AUTH_OK, { playerId, profile: full })
    })

    socket.on(S.JOIN_ROOM, ({ roomId }) => {
      if (!playerId) return
      const state = players.get(playerId)

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
      socket.join(roomId)

      const roomPlayers = [...players.entries()]
        .filter(([, p]) => p.roomId === roomId)
        .map(([id, p]) => ({ id, x: p.x, y: p.y, z: p.z, cosmeticId: p.cosmeticId }))

      socket.emit(S.JOIN_OK, {
        players: roomPlayers,
        worldItems: getWorldItems(db, roomId),
      })
    })

    socket.on(S.MOVE, ({ x, y, z, facing }) => {
      if (!playerId) return
      const state = players.get(playerId)
      state.x = x; state.y = y; state.z = z; state.facing = facing
    })

    socket.on(S.ITEM_PICKUP, ({ worldItemId }) => {
      if (!playerId) return
      const state = players.get(playerId)
      const result = pickupItem(db, playerId, worldItemId)
      if (!result.ok) return
      io.to(state.roomId).emit(S.ITEM_STATE, { worldItems: getWorldItems(db, state.roomId) })
    })

    socket.on(S.ITEM_DROP, ({ x, y, z }) => {
      if (!playerId) return
      const state = players.get(playerId)
      const result = dropItem(db, playerId, x, y, z, state.roomId)
      if (!result.ok) return
      io.to(state.roomId).emit(S.ITEM_STATE, { worldItems: getWorldItems(db, state.roomId) })
    })

    socket.on(S.ITEM_USE, ({ triggerId }) => {
      if (!playerId) return
      useItem(db, playerId, triggerId)
    })

    socket.on(S.DISCOVER, ({ action, wx, wy, wz, itemId }) => {
      if (!playerId) return
      const state = players.get(playerId)
      const result = checkDiscovery(db, playerId, { action, roomId: state.roomId, wx, wy, wz, itemId })
      if (result) socket.emit(S.DISCOVER_OK, result)
    })

    socket.on('disconnect', () => {
      if (playerId) players.delete(playerId)
    })
  })

  // 20 ticks/sec broadcast
  setInterval(() => {
    const byRoom = new Map()
    for (const [id, p] of players) {
      if (!p.roomId) continue
      if (!byRoom.has(p.roomId)) byRoom.set(p.roomId, [])
      byRoom.get(p.roomId).push({ id, x: p.x, y: p.y, z: p.z, facing: p.facing, cosmeticId: p.cosmeticId })
    }
    for (const [roomId, playerList] of byRoom) {
      io.to(roomId).emit(S.TICK, { players: playerList })
    }
  }, TICK_MS)
}
