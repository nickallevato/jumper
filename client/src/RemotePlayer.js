import { toScreen, isoDepth, ISO_ENTITY_BIAS } from '../../shared/coordinates.js'
import { cosmeticById } from '../../shared/cosmetics.js'
import { showEmoteAbove } from './emote.js'
import {
  pushSnapshot,
  sampleSnapshots,
  pruneSnapshots,
  REMOTE_RENDER_DELAY_MS,
} from './interpolation.js'

export class RemotePlayer {
  constructor(scene, id, x, y, z, cosmeticId = 1) {
    this.id = id
    this.tx = x; this.ty = y; this.tz = z
    this.scene = scene
    this.cosmeticId = cosmeticId
    // Buffer of timestamped authoritative snapshots; we render a fixed delay in
    // the past and interpolate between snapshots for smooth, constant-velocity
    // motion instead of exponential easing toward a moving target.
    this._buffer = [{ t: scene.time.now, x, y, z }]

    const sg = scene.add.graphics()
    sg.fillStyle(0x000000, 0.28)
    sg.fillEllipse(0, 0, 20, 8)
    this.shadowGfx = sg

    const g = scene.add.graphics()
    this.gfx = g
    this._drawShape()

    const ig = scene.add.graphics()
    this.indicatorGfx = ig

    this._syncPosition()
  }

  _drawShape() {
    const c = cosmeticById(this.cosmeticId)
    const g = this.gfx
    g.clear()
    g.fillStyle(c.body, 1)
    g.fillCircle(0, -13, 10)
    g.fillStyle(c.head, 1)
    g.fillCircle(0, -27, 7)
    if (c.accent != null) {
      g.fillStyle(c.accent, 1)
      g.fillCircle(0, -37, 2.5)   // accent marker above the head
    }
    g.fillStyle(0x1e1e2e, 1)
    g.fillCircle(-3, -27, 1.5)
    g.fillCircle(3, -27, 1.5)
    g.fillStyle(0xffffff, 0.45)
    g.fillCircle(-2, -31, 2)
  }

  showEmote(type) {
    showEmoteAbove(this.scene, this.gfx, type)
  }

  updateTarget(x, y, z, cosmeticId) {
    this._buffer = pushSnapshot(this._buffer, { t: this.scene.time.now, x, y, z })
    if (cosmeticId != null && cosmeticId !== this.cosmeticId) {
      this.cosmeticId = cosmeticId
      this._drawShape()
    }
  }

  update() {
    const renderTime = this.scene.time.now - REMOTE_RENDER_DELAY_MS
    const p = sampleSnapshots(this._buffer, renderTime)
    if (p) {
      this.tx = p.x; this.ty = p.y; this.tz = p.z
    }
    this._buffer = pruneSnapshots(this._buffer, renderTime)
    this._syncPosition()
  }

  // Same anchor convention as Player: the blob's feet rest at toScreen(tx,ty,tz)
  // with no extra offset. Remote players carry no platform data, so their shadow
  // is pinned to ground (tz=0) and uses height fade/shrink as the only depth cue.
  _syncPosition() {
    const originX = this.scene.scale.width / 2
    const originY = 80
    const ground = toScreen(this.tx, this.ty, 0, originX, originY)
    this.shadowGfx.setPosition(ground.x, ground.y)
    const { x, y } = toScreen(this.tx, this.ty, this.tz, originX, originY)
    this.gfx.setPosition(x, y)
    const k = 1 / (1 + Math.max(0, this.tz) * 0.5)
    this.shadowGfx.setScale(k, k)
    this.shadowGfx.setAlpha(0.28 * k)
    this.indicatorGfx.setPosition(this.gfx.x, this.gfx.y - 34)
    const depth = isoDepth(this.tx, this.ty, this.tz) + ISO_ENTITY_BIAS
    this.gfx.setDepth(depth)
    this.shadowGfx.setDepth(depth - 1)
    this.indicatorGfx.setDepth(depth + 0.1)
  }

  destroy() {
    this.shadowGfx.destroy()
    this.gfx.destroy()
    this.indicatorGfx.destroy()
  }
}
