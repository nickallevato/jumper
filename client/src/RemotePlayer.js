import { toScreen } from './iso.js'
import { TILE_H } from '../../shared/constants.js'

export class RemotePlayer {
  constructor(scene, id, x, y, z) {
    this.id = id
    this.tx = x; this.ty = y; this.tz = z
    this._targetX = x; this._targetY = y; this._targetZ = z
    this.scene = scene

    const g = scene.add.graphics()
    g.fillStyle(0xf38ba8, 1)
    g.fillRect(-8, -20, 16, 20)
    this.gfx = g
    this._syncPosition()
  }

  updateTarget(x, y, z) {
    this._targetX = x; this._targetY = y; this._targetZ = z
  }

  update() {
    const alpha = 0.3
    this.tx += (this._targetX - this.tx) * alpha
    this.ty += (this._targetY - this.ty) * alpha
    this.tz += (this._targetZ - this.tz) * alpha
    this._syncPosition()
  }

  _syncPosition() {
    const originX = this.scene.scale.width / 2
    const originY = 80
    const { x, y } = toScreen(this.tx, this.ty, this.tz, originX, originY)
    this.gfx.setPosition(x, y - TILE_H / 2)
  }

  destroy() { this.gfx.destroy() }
}
