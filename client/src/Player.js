import Phaser from 'phaser'
import { toScreen } from './iso.js'
import { TILE_W, TILE_H, MOVE_SPEED, JUMP_VELOCITY, GRAVITY, ITEM_EFFECTS } from '../../shared/constants.js'

export class Player {
  constructor(scene, tx, ty, profile) {
    this.scene   = scene
    this.tx      = tx
    this.ty      = ty
    this.tz      = 0
    this.vz      = 0
    this.onGround = true
    this.profile  = profile
    this.heldItem = profile?.heldItem ?? null
    this.facing   = 'se'

    const g = scene.add.graphics()
    this._drawShape(g)
    this.gfx = g
  }

  _drawShape(g) {
    g.clear()
    g.fillStyle(0x89b4fa, 1)
    g.fillRect(-8, -20, 16, 20)
  }

  get passiveEffect() {
    if (!this.heldItem) return {}
    return ITEM_EFFECTS[this.heldItem.passive_effect] ?? {}
  }

  update(dt, cursors, keys, grid) {
    const speed = MOVE_SPEED * dt
    let dx = 0, dy = 0
    const wasOnGround = this.onGround

    if (cursors.left.isDown  || keys.a.isDown) dx -= speed
    if (cursors.right.isDown || keys.d.isDown) dx += speed
    if (cursors.up.isDown    || keys.w.isDown) dy -= speed
    if (cursors.down.isDown  || keys.s.isDown) dy += speed

    // Diagonal normalisation
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707 }

    const nx = this.tx + dx
    const ny = this.ty + dy
    const cols = grid[0].length
    const rows = grid.length

    if (nx >= 0 && nx < cols && grid[Math.floor(this.ty)]?.[Math.floor(nx)] !== 2) this.tx = nx
    if (ny >= 0 && ny < rows && grid[Math.floor(ny)]?.[Math.floor(this.tx)] !== 2) this.ty = ny

    // Jump
    if (Phaser.Input.Keyboard.JustDown(keys.space) && this.onGround) {
      const jv = this.passiveEffect.jumpVelocity ?? JUMP_VELOCITY
      this.vz = jv
      this.onGround = false
    }

    // Gravity
    const grav = this.passiveEffect.gravity ?? GRAVITY
    if (!this.onGround) {
      this.vz -= grav
      this.tz += this.vz
      if (this.tz <= 0) {
        this.tz = 0
        this.vz = 0
        this.onGround = true
      }
    }

    this._syncPosition()

    // Fire discovery attempt callback on jump, dive, or move
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
    const { x, y } = toScreen(this.tx, this.ty, this.tz, originX, originY)
    this.gfx.setPosition(x, y - TILE_H / 2)
  }

  getState() {
    return { x: this.tx, y: this.ty, z: this.tz, facing: this.facing }
  }

  destroy() { this.gfx.destroy() }
}
