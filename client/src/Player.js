import Phaser from 'phaser'
import { toScreen } from './iso.js'
import { TILE_H, MOVE_SPEED, JUMP_VELOCITY, GRAVITY, ITEM_EFFECTS } from '../../shared/constants.js'

export class Player {
  constructor(scene, tx, ty, profile, platforms = []) {
    this.scene     = scene
    this.tx        = tx
    this.ty        = ty
    this.tz        = 0
    this.vz        = 0
    this.onGround  = true
    this.profile   = profile
    this.heldItem  = profile?.heldItem ?? null
    this.facing    = 'se'
    this._platforms = platforms

    const sg = scene.add.graphics()
    sg.fillStyle(0x000000, 0.28)
    sg.fillEllipse(0, 0, 20, 8)
    this.shadowGfx = sg

    const g = scene.add.graphics()
    this._drawShape(g)
    this.gfx = g

    const ig = scene.add.graphics()
    this.indicatorGfx = ig

    this._updateIndicator()
  }

  _drawShape(g) {
    g.clear()
    g.fillStyle(0x89b4fa, 1)
    g.fillCircle(0, -13, 10)
    g.fillStyle(0xcdd6f4, 1)
    g.fillCircle(0, -27, 7)
    g.fillStyle(0x1e1e2e, 1)
    g.fillCircle(-3, -27, 1.5)
    g.fillCircle(3, -27, 1.5)
    g.fillStyle(0xffffff, 0.45)
    g.fillCircle(-2, -31, 2)
  }

  get passiveEffect() {
    if (!this.heldItem) return {}
    return ITEM_EFFECTS[this.heldItem.passive_effect] ?? {}
  }

  _updateIndicator() {
    const g = this.indicatorGfx
    g.clear()
    if (!this.heldItem) return
    const COLORS = {
      floaty_jump:   0xa6e3a1,
      high_jump:     0xf9e2af,
      reveal_hidden: 0xcba6f7,
    }
    const color = COLORS[this.heldItem.passive_effect] ?? 0xfab387
    g.fillStyle(color, 1)
    g.fillCircle(0, 0, 3)
  }

  update(dt, cursors, keys, grid) {
    const speed = MOVE_SPEED * dt
    let dx = 0, dy = 0
    const wasOnGround = this.onGround

    if (cursors.left.isDown  || keys.a.isDown) dx -= speed
    if (cursors.right.isDown || keys.d.isDown) dx += speed
    if (cursors.up.isDown    || keys.w.isDown) dy -= speed
    if (cursors.down.isDown  || keys.s.isDown) dy += speed

    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707 }

    const nx = this.tx + dx
    const ny = this.ty + dy
    const cols = grid[0].length
    const rows = grid.length

    if (nx >= 0 && nx < cols && grid[Math.floor(this.ty)]?.[Math.floor(nx)] !== 2) this.tx = nx
    if (ny >= 0 && ny < rows && grid[Math.floor(ny)]?.[Math.floor(this.tx)] !== 2) this.ty = ny

    if (Phaser.Input.Keyboard.JustDown(keys.space) && this.onGround) {
      const jv = this.passiveEffect.jumpVelocity ?? JUMP_VELOCITY
      this.vz = jv
      this.onGround = false
    }

    const grav = this.passiveEffect.gravity ?? GRAVITY
    if (!this.onGround) {
      const prevTz = this.tz
      this.vz -= grav
      this.tz += this.vz

      if (this.tz <= 0) {
        this.tz = 0
        this.vz = 0
        this.onGround = true
      } else if (this.vz < 0) {
        const fx = Math.floor(this.tx)
        const fy = Math.floor(this.ty)
        for (const p of this._platforms) {
          if (p.tx === fx && p.ty === fy && prevTz >= p.tz && this.tz < p.tz) {
            this.tz = p.tz
            this.vz = 0
            this.onGround = true
            break
          }
        }
      }
    }

    // Fall off platform edge
    if (this.onGround && this.tz > 0.01) {
      const fx = Math.floor(this.tx)
      const fy = Math.floor(this.ty)
      const still = this._platforms.some(p =>
        p.tx === fx && p.ty === fy && Math.abs(p.tz - this.tz) < 0.05
      )
      if (!still) this.onGround = false
    }

    this._syncPosition()

    if (Phaser.Input.Keyboard.JustDown(keys.space) && wasOnGround) {
      this.onDiscoverAttempt?.({
        action: 'jump',
        wx: Math.floor(this.tx),
        wy: Math.floor(this.ty),
        wz: Math.floor(this.tz),
        itemId: this.heldItem?.id ?? null,
      })
    }
    if (cursors.down.isDown && !this.onGround) {
      this.onDiscoverAttempt?.({
        action: 'dive',
        wx: Math.floor(this.tx),
        wy: Math.floor(this.ty),
        wz: Math.floor(this.tz),
        itemId: this.heldItem?.id ?? null,
      })
    }
    if (dx !== 0 || dy !== 0) {
      this.onDiscoverAttempt?.({
        action: 'move',
        wx: Math.floor(this.tx),
        wy: Math.floor(this.ty),
        wz: 0,
        itemId: this.heldItem?.id ?? null,
      })
    }
  }

  _syncPosition() {
    const originX = this.scene.scale.width / 2
    const originY = 80
    const ground = toScreen(this.tx, this.ty, 0, originX, originY)
    this.shadowGfx.setPosition(ground.x, ground.y)
    const { x, y } = toScreen(this.tx, this.ty, this.tz, originX, originY)
    this.gfx.setPosition(x, y - TILE_H / 2)
    this.indicatorGfx.setPosition(this.gfx.x, this.gfx.y - 34)
  }

  getState() {
    return { x: this.tx, y: this.ty, z: this.tz, facing: this.facing }
  }

  destroy() {
    this.shadowGfx.destroy()
    this.gfx.destroy()
    this.indicatorGfx.destroy()
  }
}
