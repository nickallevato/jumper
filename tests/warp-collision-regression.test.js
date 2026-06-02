import { describe, expect, it } from 'vitest'
import { ROOMS } from '../client/src/maps.js'
import {
  ROOM_CONTENT_BOUNDS,
  ROOM_PORTALS,
  clampAllowedRoomPosition,
  contentBoundsForRoom,
  isRoomPositionPassable,
  landingForPortalTransition,
} from '../shared/constants.js'
import { COUNTERWEIGHT, isOnPlate } from '../shared/puzzles.js'
import { canStepTo, groundHeightAt } from '../client/src/terrain.js'
import { buildRoomPlayerPayload, createFixedStepLoop } from '../server/rooms.js'

const EXPECTED_PORTAL_ROUTES = [
  { from: 'overworld', at: { tx: 13, ty: 13 }, to: 'dungeon_grove', landing: { tx: 2, ty: 3 } },
  { from: 'overworld', at: { tx: 13, ty: 2 }, to: 'dungeon_belltower', landing: { tx: 4, ty: 3 } },
  { from: 'overworld', at: { tx: 2, ty: 7 }, to: 'dungeon_library', landing: { tx: 2, ty: 1 } },
  { from: 'dungeon_grove', at: { tx: 2, ty: 2 }, to: 'overworld', landing: { tx: 13, ty: 14 } },
  { from: 'dungeon_belltower', at: { tx: 4, ty: 4 }, to: 'overworld', landing: { tx: 14, ty: 2 } },
  { from: 'dungeon_library', at: { tx: 1, ty: 1 }, to: 'overworld', landing: { tx: 3, ty: 7 } },
  { from: 'dungeon_deep', at: { tx: 4, ty: 1 }, to: 'overworld', landing: { tx: 4, ty: 3 } },
]

function portalRef(roomId, portal) {
  return { roomId, tx: portal.tx, ty: portal.ty }
}

function expectFinitePosition(pos, label) {
  expect(Number.isFinite(pos.x ?? pos.tx), `${label} x`).toBe(true)
  expect(Number.isFinite(pos.y ?? pos.ty), `${label} y`).toBe(true)
  expect(Number.isFinite(pos.z ?? pos.tz ?? 0), `${label} z`).toBe(true)
}

describe('SMA-275 warp and collision regression coverage', () => {
  it('keeps the shared portal registry complete for every authored room portal', () => {
    for (const [roomId, room] of Object.entries(ROOMS)) {
      expect(room.portals, roomId).toEqual(ROOM_PORTALS[roomId] ?? [])

      for (const portal of room.portals ?? []) {
        expect(ROOMS[portal.to], `${roomId} -> ${portal.to}`).toBeDefined()
        expect(isRoomPositionPassable(roomId, { x: portal.tx, y: portal.ty }), `${roomId} portal tile`).toBe(true)
        expectFinitePosition(portal, `${roomId} portal`)

        const landing = landingForPortalTransition(portal.to, portalRef(roomId, portal))
        expect(landing, `${roomId} -> ${portal.to} landing`).toEqual(portal.landing)
        expect(isRoomPositionPassable(portal.to, { x: landing.tx, y: landing.ty }), `${portal.to} landing tile`).toBe(true)
      }
    }
  })

  it('locks the authored route matrix, including the one-way deep return', () => {
    const actualRoutes = Object.entries(ROOM_PORTALS).flatMap(([from, portals]) =>
      portals.map(portal => ({
        from,
        at: { tx: portal.tx, ty: portal.ty },
        to: portal.to,
        landing: portal.landing,
      }))
    )

    expect(actualRoutes).toEqual(EXPECTED_PORTAL_ROUTES)
    expect(actualRoutes.filter(route => route.to === 'dungeon_deep')).toEqual([])
  })

  it('resolves every portal landing deterministically, including repeated transitions', () => {
    const seenRoutes = []

    for (const [roomId, room] of Object.entries(ROOMS)) {
      for (const portal of room.portals ?? []) {
        const ref = portalRef(roomId, portal)
        const first = landingForPortalTransition(portal.to, ref)
        const second = landingForPortalTransition(portal.to, ref)
        const third = landingForPortalTransition(portal.to, ref)

        expect(first, `${roomId} -> ${portal.to}`).toEqual(second)
        expect(second, `${roomId} -> ${portal.to}`).toEqual(third)
        seenRoutes.push(`${roomId}->${portal.to}@${first.tx},${first.ty}`)
      }
    }

    expect(seenRoutes).toContain('dungeon_deep->overworld@4,3')
    expect(ROOM_PORTALS.overworld.some(portal => portal.to === 'dungeon_deep')).toBe(false)
  })

  it('keeps return portals landing on canonical source-room tiles when a reverse route exists', () => {
    for (const [roomId, room] of Object.entries(ROOMS)) {
      for (const portal of room.portals ?? []) {
        const reverse = ROOM_PORTALS[portal.to]?.find(candidate => candidate.to === roomId)
        if (!reverse) continue

        const outboundLanding = landingForPortalTransition(portal.to, portalRef(roomId, portal))
        const returnLanding = landingForPortalTransition(roomId, portalRef(portal.to, reverse))

        expect(isRoomPositionPassable(portal.to, { x: outboundLanding.tx, y: outboundLanding.ty }), `${roomId} outbound`).toBe(true)
        expect(isRoomPositionPassable(roomId, { x: returnLanding.tx, y: returnLanding.ty }), `${roomId} return`).toBe(true)
      }
    }
  })

  it('does not leak a warping player into old-room observer tick payloads', () => {
    const players = new Map([
      ['warper', { roomId: 'dungeon_grove', x: 2, y: 3, z: 0, facing: 'se', cosmeticId: 1, warpId: 3 }],
      ['old-observer', { roomId: 'overworld', x: 10, y: 8, z: 0, facing: 'sw', cosmeticId: 2 }],
      ['dest-observer', { roomId: 'dungeon_grove', x: 5, y: 5, z: 0, facing: 'nw', cosmeticId: 3 }],
    ])

    const oldRoomPayload = buildRoomPlayerPayload([...players.entries()].filter(([, p]) => p.roomId === 'overworld'))
    const destPayload = buildRoomPlayerPayload([...players.entries()].filter(([, p]) => p.roomId === 'dungeon_grove'))

    expect(oldRoomPayload.map(p => p.id)).toEqual(['old-observer'])
    expect(destPayload.find(p => p.id === 'warper')).toMatchObject({
      x: 2, y: 3, z: 0, warp: { id: 3 },
    })
  })

  it('keeps observer-visible platform ride positions consistent after warp metadata is present', () => {
    const { roomId, riser, plate } = COUNTERWEIGHT
    const raisedPlatforms = [
      ...(ROOMS[roomId].platforms ?? []),
      { tx: riser.tx, ty: riser.ty, tz: riser.raisedZ },
    ]
    const rider = {
      roomId,
      x: riser.tx,
      y: riser.ty,
      z: riser.raisedZ,
      facing: 'se',
      cosmeticId: 1,
      warpId: 4,
    }
    const observer = {
      roomId,
      x: plate.tx,
      y: plate.ty,
      z: 0,
      facing: 'nw',
      cosmeticId: 2,
    }
    const payload = buildRoomPlayerPayload([
      ['rider', rider],
      ['observer', observer],
    ])
    const riderSnapshot = payload.find(p => p.id === 'rider')

    expect(groundHeightAt(raisedPlatforms, rider.x, rider.y)).toBe(riser.raisedZ)
    expect(canStepTo(raisedPlatforms, rider.x, rider.y, rider.z)).toBe(true)
    expect(riderSnapshot).toMatchObject({
      id: 'rider',
      x: riser.tx,
      y: riser.ty,
      z: riser.raisedZ,
      warp: { id: 4 },
    })
  })

  it('clamps post-warp collision to room bounds and rejects rounded wall footprints', () => {
    for (const [roomId, bounds] of Object.entries(ROOM_CONTENT_BOUNDS)) {
      const clamped = clampAllowedRoomPosition(
        roomId,
        { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
        { x: -999, y: 999, z: 999 }
      )

      expect(clamped.x, roomId).toBeGreaterThanOrEqual(bounds.minX)
      expect(clamped.y, roomId).toBeLessThanOrEqual(bounds.maxY)
      expect(clamped.z, roomId).toBeLessThanOrEqual(bounds.maxZ)
      expectFinitePosition(clamped, `${roomId} clamped`)
    }

    expect(clampAllowedRoomPosition(
      'dungeon_grove',
      { x: 8.5, y: 2, z: 0 },
      { x: 9, y: 2, z: 0 }
    )).toMatchObject({ x: 8.5, y: 2, z: 0 })
    expect(clampAllowedRoomPosition(
      'dungeon_grove',
      { x: 8.5, y: 2, z: 0 },
      { x: 9, y: 2, z: 0 },
      new Set(['9,2'])
    )).toMatchObject({ x: 9, y: 2, z: 0 })
  })

  it('keeps counterweight collision state deterministic before and after a warp return', () => {
    const { roomId, plate, riser, goal } = COUNTERWEIGHT
    const bounds = contentBoundsForRoom(roomId)
    const weightedPlayer = { x: plate.tx, y: plate.ty, z: bounds.minZ }
    const raisedRiser = { tx: riser.tx, ty: riser.ty, tz: riser.raisedZ }

    expect(isOnPlate(weightedPlayer.x, weightedPlayer.y, plate)).toBe(true)
    expect(isRoomPositionPassable(roomId, { x: raisedRiser.tx, y: raisedRiser.ty })).toBe(true)
    expect(raisedRiser.tz).toBeLessThan(goal.tz)
    expect(raisedRiser.tz).toBeGreaterThan(riser.loweredZ)

    const afterWarpReturn = clampAllowedRoomPosition(
      roomId,
      { x: raisedRiser.tx, y: raisedRiser.ty, z: raisedRiser.tz },
      { x: raisedRiser.tx, y: goal.ty, z: goal.reachZ }
    )
    expect(afterWarpReturn).toEqual({ x: raisedRiser.tx, y: goal.ty, z: goal.reachZ })
  })

  it('replays movement scripts deterministically across rooms under closed and open-door collision', () => {
    const script = [
      { x: -40, y: 40, z: 8 },
      { x: 8.5, y: 2, z: 0 },
      { x: 9, y: 2, z: 0 },
      { x: 65, y: -4, z: -2 },
      { x: 4, y: 5, z: 1.2 },
    ]

    for (const roomId of Object.keys(ROOMS)) {
      const runScript = openDoorKeys => {
        let position = { x: ROOMS[roomId].spawn.tx, y: ROOMS[roomId].spawn.ty, z: 0 }
        for (const next of script) {
          position = clampAllowedRoomPosition(roomId, position, next, openDoorKeys)
        }
        return position
      }

      expect(runScript(new Set()), `${roomId} closed run repeat`).toEqual(runScript(new Set()))
      expect(runScript(new Set(['9,2'])), `${roomId} open run repeat`).toEqual(runScript(new Set(['9,2'])))
    }
  })

  it('produces identical authoritative ticks for steady and load-bursted frame delivery', () => {
    const runLoop = frames => {
      let time = 0
      const steps = []
      const broadcasts = []
      const loop = createFixedStepLoop({
        now: () => time,
        setTimer: () => 1,
        clearTimer: () => {},
        step: frame => steps.push(frame),
        broadcast: frame => broadcasts.push(frame),
      })

      for (const elapsed of frames) {
        time += elapsed
        loop.runFrame()
      }
      loop.stop()

      return { steps, broadcasts }
    }

    const steady = runLoop(Array.from({ length: 30 }, () => 50))
    const loaded = runLoop([250, 250, 250, 250, 250, 250])

    expect(loaded.steps).toEqual(steady.steps)
    expect(loaded.steps.at(-1)).toMatchObject({ tick: 30, simulationTimeMs: 1500 })
    expect(loaded.broadcasts.at(-1)).toMatchObject({ tick: 30, simulationTimeMs: 1500 })
  })
})
