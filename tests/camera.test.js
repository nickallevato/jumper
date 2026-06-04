import { describe, expect, it } from 'vitest'
import { toScreen } from '../shared/coordinates.js'
import {
  CAMERA_TARGET_DEADBAND_PX,
  COOP_CAMERA_RADIUS_TILES,
  computeCoopCameraTarget,
  shouldMoveCameraTarget,
  tileDistance,
} from '../client/src/camera.js'

const VIEWPORT = { w: 960, h: 640 }
const ORIGIN = { x: VIEWPORT.w / 2, y: 80 }

function screen(p) {
  return toScreen(p.x, p.y, p.z ?? 0, ORIGIN.x, ORIGIN.y)
}

function isVisibleFromTarget(point, target, margin = 32) {
  return Math.abs(point.x - target.x) <= VIEWPORT.w / 2 - margin &&
    Math.abs(point.y - target.y) <= VIEWPORT.h / 2 - margin
}

describe('cooperative camera target', () => {
  it('keeps a 3-player <=15 tile group inside the 960x640 viewport', () => {
    const players = [
      { x: 8, y: 8, z: 0 },
      { x: 15.5, y: 8, z: 0 },
      { x: 23, y: 8, z: 0 },
    ]

    expect(tileDistance(players[0], players[2])).toBeLessThanOrEqual(COOP_CAMERA_RADIUS_TILES)

    const target = computeCoopCameraTarget(screen(players[0]), players.slice(1).map(screen))

    for (const p of players) {
      expect(isVisibleFromTarget(screen(p), target)).toBe(true)
    }
  })

  it('centers naturally on solo movement and jump height', () => {
    const local = screen({ x: 12.25, y: 9.5, z: 1.2 })

    expect(computeCoopCameraTarget(local, [])).toEqual(local)
  })

  it('ignores sub-pixel target churn for damping stability', () => {
    const current = { x: 100, y: 200 }
    const tinyTick = { x: current.x + CAMERA_TARGET_DEADBAND_PX / 3, y: current.y }

    expect(shouldMoveCameraTarget(current, tinyTick)).toBe(false)
    expect(shouldMoveCameraTarget(current, { x: current.x + CAMERA_TARGET_DEADBAND_PX + 0.1, y: current.y })).toBe(true)
  })

  it('excludes teammates outside the cooperative framing radius', () => {
    const local = { x: 8, y: 8, z: 0 }
    const nearby = { x: 20, y: 8, z: 0 }
    const distant = { x: 40, y: 8, z: 0 }

    expect(tileDistance(local, nearby)).toBeLessThanOrEqual(COOP_CAMERA_RADIUS_TILES)
    expect(tileDistance(local, distant)).toBeGreaterThan(COOP_CAMERA_RADIUS_TILES)
  })
})
