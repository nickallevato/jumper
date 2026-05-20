import { toScreen } from './iso.js'
import { TILE_H } from '../../shared/constants.js'

const PALETTE = [0xf38ba8, 0xa6e3a1, 0xfab387, 0xcba6f7, 0x89dceb, 0xf9e2af]

function colorFromId(id) {
  let h = 5381
  for (const c of String(id)) h = ((h << 5) + h + c.charCodeAt(0)) & 0x7fffffff
  return PALETTE[h % PALETTE.length]
}

export class RemotePlayer {
  constructor(scene, id, x, y, z) {
    this.id = id
    this.tx = x; this.ty = y; this.tz = z
    this._targetX = x; this._targetY = y; this._targetZ = z
    this.scene = scene
    this._color = colorFromId(id)

    const sg = scene.add.graphics()
    sg.fillStyle(0x000000, 0.28)
    sg.fillEllipse(0, 0, 20, 8)
    this.shadowGfx = sg

    const g = scene.add.graphics()
    this._drawShape(g)
    this.gfx = g
    this._syncPosition()
  }

  _drawShape(g) {
    g.clear()
    g.fillStyle(this._color, 1)
    g.fillCircle(0, -13, 10)
    g.fillStyle(0xcdd6f4, 1)
    g.fillCircle(0, -27, 7)
    g.fillStyle(0x1e1e2e, 1)
    g.fillCircle(-3, -27, 1.5)
    g.fillCircle(3, -27, 1.5)
    g.fillStyle(0xffffff, 0.45)
    g.fillCircle(-2, -31, 2)
  }

  updateTarget(x, y, z) {
    this._targetX = x; this._targetY = y; this._targetZ = z
  }

  update() {
    const a = 0.3
    this.tx += (this._targetX - this.tx) * a
    this.ty += (this._targetY - this.ty) * a
    this.tz += (this._targetZ - this.tz) * a
    this._syncPosition()
  }

  _syncPosition() {
    const originX = this.scene.scale.width / 2
    const originY = 80
    const ground = toScreen(this.tx, this.ty, 0, originX, originY)
    this.shadowGfx.setPosition(ground.x, ground.y)
    const { x, y } = toScreen(this.tx, this.ty, this.tz, originX, originY)
    this.gfx.setPosition(x, y - TILE_H / 2)
  }

  destroy() {
    this.shadowGfx.destroy()
    this.gfx.destroy()
  }
}
