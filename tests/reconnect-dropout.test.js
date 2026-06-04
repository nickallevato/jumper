import { describe, expect, it } from 'vitest'
import {
  buildRoomPlayerPayload,
  handlePlayerDisconnect,
  isConsentedDisconnectReason,
  reconnectWindowMs,
} from '../server/rooms.js'

describe('socket.io reconnect/dropout affordance', () => {
  it('keeps reconnecting players in room payloads with visible state', () => {
    const payload = buildRoomPlayerPayload([
      ['active', { roomId: 'overworld', x: 8, y: 8, z: 0, facing: 'se', cosmeticId: 1 }],
      ['dropped', { roomId: 'overworld', x: 9, y: 8, z: 0, facing: 'sw', cosmeticId: 2, isReconnecting: true }],
    ])

    expect(payload).toEqual([
      expect.objectContaining({ id: 'active', isReconnecting: false }),
      expect.objectContaining({ id: 'dropped', isReconnecting: true }),
    ])
  })

  it('marks unexpected socket drops reconnecting until the grace timer expires', () => {
    const timers = []
    const players = new Map([
      [7, { socket: { id: 'old' }, roomId: 'overworld', x: 8, y: 8, z: 0, lastSeq: 12 }],
    ])

    const result = handlePlayerDisconnect(players, 7, 'transport close', {
      windowMs: 1500,
      setTimer: (fn, ms) => {
        timers.push({ fn, ms })
        return timers.length
      },
      clearTimer: () => {},
    })

    expect(result).toBe('reconnecting')
    expect(timers).toHaveLength(1)
    expect(timers[0].ms).toBe(1500)
    expect(players.get(7)).toMatchObject({ socket: null, isReconnecting: true, lastSeq: undefined })

    timers[0].fn()
    expect(players.has(7)).toBe(false)
  })

  it('does not delete a player if they resume before the timeout callback runs', () => {
    const timers = []
    const players = new Map([
      [7, { socket: { id: 'old' }, roomId: 'overworld', x: 8, y: 8, z: 0 }],
    ])

    handlePlayerDisconnect(players, 7, 'ping timeout', {
      setTimer: (fn, ms) => {
        timers.push({ fn, ms })
        return timers.length
      },
      clearTimer: () => {},
    })
    players.get(7).isReconnecting = false

    timers[0].fn()
    expect(players.has(7)).toBe(true)
  })

  it('removes consented namespace disconnects promptly', () => {
    const players = new Map([
      [7, { socket: { id: 'old' }, roomId: 'overworld', reconnectTimer: 1, isReconnecting: true }],
    ])
    let cleared = false

    const result = handlePlayerDisconnect(players, 7, 'client namespace disconnect', {
      clearTimer: () => { cleared = true },
    })

    expect(isConsentedDisconnectReason('client namespace disconnect')).toBe(true)
    expect(result).toBe('removed')
    expect(cleared).toBe(true)
    expect(players.has(7)).toBe(false)
  })

  it('allows reconnect window overrides by milliseconds or seconds', () => {
    const oldMs = process.env.JUMPER_RECONNECT_WINDOW_MS
    const oldSec = process.env.JUMPER_RECONNECT_WINDOW_SEC
    try {
      process.env.JUMPER_RECONNECT_WINDOW_MS = '275'
      process.env.JUMPER_RECONNECT_WINDOW_SEC = '9'
      expect(reconnectWindowMs()).toBe(275)

      delete process.env.JUMPER_RECONNECT_WINDOW_MS
      process.env.JUMPER_RECONNECT_WINDOW_SEC = '2'
      expect(reconnectWindowMs()).toBe(2000)
    } finally {
      if (oldMs == null) delete process.env.JUMPER_RECONNECT_WINDOW_MS
      else process.env.JUMPER_RECONNECT_WINDOW_MS = oldMs
      if (oldSec == null) delete process.env.JUMPER_RECONNECT_WINDOW_SEC
      else process.env.JUMPER_RECONNECT_WINDOW_SEC = oldSec
    }
  })
})
