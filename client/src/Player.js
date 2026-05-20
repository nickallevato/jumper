import Phaser from 'phaser'
import { toScreen, screenToTileDir } from './iso.js'
import { cosmeticById } from '../../shared/cosmetics.js'
import { showEmoteAbove } from './emote.js'
import {
  TILE_H, MOVE_SPEED, GRAVITY, ITEM_EFFECTS,
  MIN_JUMP_VEL, JUMP_HOLD_GRAV_FACTOR,
  COYOTE_VEL, COYOTE_TIME_MS,
  WALL_SLIDE_GRAV_FACTOR, WALL_KICK_SPEED, DOUBLE_TAP_MS, WALL_KICK_COOLDOWN_MS,
  PERFECT_LANDING_MS, POGO_FACTOR,
} from '../../shared/constants.js'

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
    this.cosmeticId = profile?.cosmetic_id ?? 1
    this._platforms = platforms

    // Movement-feel state
    this._coyoteTimer    = 0      // ms of coyote grace remaining
    this._isCoyoteJump   = false  // current airtime started from a coyote jump
    this._isWallSliding  = false
    this._wallDir        = { x: 0, y: 0 }  // unit vector pointing away from the wall
    this._lastJumpTap    = -Infinity       // ms timestamp of last space press
    this._wallKickCooldown = 0    // ms lockout before re-entering wall slide
    this._landedAt       = -Infinity        // ms timestamp of last landing (for pogo)

    // Squash & stretch
    this._scaleX = 1; this._scaleY = 1
    this._targetScaleX = 1; this._targetScaleY = 1
    this._squashResetAt = 0

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
    const c = cosmeticById(this.cosmeticId)
    g.clear()
    g.fillStyle(c.body, 1)
    g.fillCircle(0, -13, 10)
    g.fillStyle(c.head, 1)
    g.fillCircle(0, -27, 7)
    if (c.accent != null) {
      g.fillStyle(c.accent, 1)
      g.fillCircle(0, -37, 2.5)
    }
    g.fillStyle(0x1e1e2e, 1)
    g.fillCircle(-3, -27, 1.5)
    g.fillCircle(3, -27, 1.5)
    g.fillStyle(0xffffff, 0.45)
    g.fillCircle(-2, -31, 2)
  }

  // Recolor live when the player unlocks (and equips) a new cosmetic.
  setCosmetic(id) {
    if (id == null || id === this.cosmeticId) return
    this.cosmeticId = id
    this._drawShape(this.gfx)
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

  // Target a squash/stretch pose; springs back to (1,1) after `ms`.
  _squash(sx, sy, ms) {
    this._targetScaleX = sx
    this._targetScaleY = sy
    this._squashResetAt = this.scene.time.now + ms
  }

  // Wall in the direction of input while airborne → unit vector away from wall, else null.
  _detectWall(dx, dy, grid) {
    const fx = Math.floor(this.tx)
    const fy = Math.floor(this.ty)
    if (dx > 0 && grid[fy]?.[Math.floor(this.tx + 0.7)] === 2) return { x: -1, y: 0 }
    if (dx < 0 && grid[fy]?.[Math.floor(this.tx - 0.1)] === 2) return { x: 1, y: 0 }
    if (dy > 0 && grid[Math.floor(this.ty + 0.7)]?.[fx] === 2) return { x: 0, y: -1 }
    if (dy < 0 && grid[Math.floor(this.ty - 0.1)]?.[fx] === 2) return { x: 0, y: 1 }
    return null
  }

  update(dt, cursors, keys, grid) {
    const now = this.scene.time.now
    const ms  = dt * 1000
    const speed = MOVE_SPEED * dt
    const wasOnGround = this.onGround

    // Screen-relative input: W = straight up on screen, A/D = left/right, S = down.
    let mx = 0, my = 0
    if (cursors.left.isDown  || keys.a.isDown) mx -= 1
    if (cursors.right.isDown || keys.d.isDown) mx += 1
    if (cursors.up.isDown    || keys.w.isDown) my -= 1
    if (cursors.down.isDown  || keys.s.isDown) my += 1
    const dir = screenToTileDir(mx, my)
    let dx = dir.dx * speed
    let dy = dir.dy * speed

    const nx = this.tx + dx
    const ny = this.ty + dy
    const cols = grid[0].length
    const rows = grid.length

    if (nx >= 0 && nx < cols && grid[Math.floor(this.ty)]?.[Math.floor(nx)] !== 2) this.tx = nx
    if (ny >= 0 && ny < rows && grid[Math.floor(ny)]?.[Math.floor(this.tx)] !== 2) this.ty = ny

    // Decay timers
    this._coyoteTimer = Math.max(0, this._coyoteTimer - ms)
    this._wallKickCooldown = Math.max(0, this._wallKickCooldown - ms)

    // Wall slide: airborne, pressing into a wall, not in post-kick lockout
    const wall = (!this.onGround && this._wallKickCooldown === 0) ? this._detectWall(dx, dy, grid) : null
    this._isWallSliding = wall !== null
    if (wall) this._wallDir = wall

    // --- Jump / kick / pogo on space press ---
    let jumped = false
    if (Phaser.Input.Keyboard.JustDown(keys.space)) {
      const jv = this.passiveEffect.jumpVelocity ?? MIN_JUMP_VEL
      if (this.onGround) {
        // Pogo: a perfectly-timed tap right as you land boosts the jump (hidden technique)
        if (now - this._landedAt < PERFECT_LANDING_MS) {
          this.vz = jv * POGO_FACTOR
          this._squash(0.8, 1.4, 90)
          this.onDiscoverAttempt?.(this._action('pogo'))
        } else {
          this.vz = jv
          this._squash(0.85, 1.3, 80)
        }
        this.onGround = false
        this._isCoyoteJump = false
        jumped = true
      } else if (this._isWallSliding && (now - this._lastJumpTap < DOUBLE_TAP_MS)) {
        // Wall kick — double tap while sliding
        this.vz = MIN_JUMP_VEL * 1.1
        this.tx = this._clampMove(this.tx + this._wallDir.x * WALL_KICK_SPEED, cols)
        this.ty = this._clampMove(this.ty + this._wallDir.y * WALL_KICK_SPEED, rows)
        this._isWallSliding = false
        this._wallKickCooldown = WALL_KICK_COOLDOWN_MS
        this._isCoyoteJump = false
        this._squash(1.3, 0.85, 100)
        this.onDiscoverAttempt?.(this._action('wall_kick'))
      } else if (this._coyoteTimer > 0) {
        // Coyote jump — fixed small arc, no hold bonus
        this.vz = COYOTE_VEL
        this.onGround = false
        this._coyoteTimer = 0
        this._isCoyoteJump = true
        this._squash(0.85, 1.3, 80)
      }
      this._lastJumpTap = now
    }

    // --- Gravity ---
    let grav = this.passiveEffect.gravity ?? GRAVITY
    if (this._isWallSliding) {
      grav *= WALL_SLIDE_GRAV_FACTOR
    } else if (keys.space.isDown && this.vz > 0 && !this._isCoyoteJump) {
      grav *= JUMP_HOLD_GRAV_FACTOR   // variable height: hanging ascent while held
    }

    if (!this.onGround) {
      const prevTz = this.tz
      this.vz -= grav
      this.tz += this.vz

      if (this.tz <= 0) {
        this.tz = 0
        this.vz = 0
        this._land(now)
      } else if (this.vz < 0) {
        const fx = Math.floor(this.tx)
        const fy = Math.floor(this.ty)
        for (const p of this._platforms) {
          if (p.tx === fx && p.ty === fy && prevTz >= p.tz && this.tz < p.tz) {
            this.tz = p.tz
            this.vz = 0
            this._land(now)
            break
          }
        }
      }
    }

    // Fall off platform edge → start coyote grace
    if (this.onGround && this.tz > 0.01) {
      const fx = Math.floor(this.tx)
      const fy = Math.floor(this.ty)
      const still = this._platforms.some(p =>
        p.tx === fx && p.ty === fy && Math.abs(p.tz - this.tz) < 0.05
      )
      if (!still) {
        this.onGround = false
        this._coyoteTimer = COYOTE_TIME_MS
      }
    }

    // Spring squash/stretch back toward neutral
    if (now > this._squashResetAt) { this._targetScaleX = 1; this._targetScaleY = 1 }
    this._scaleX += (this._targetScaleX - this._scaleX) * 0.25
    this._scaleY += (this._targetScaleY - this._scaleY) * 0.25

    this._syncPosition()

    // --- Discovery emits (existing) ---
    if (jumped) this.onDiscoverAttempt?.(this._action('jump'))
    if (cursors.down.isDown && !this.onGround) this.onDiscoverAttempt?.(this._action('dive'))
    if (dx !== 0 || dy !== 0) this.onDiscoverAttempt?.(this._action('move', 0))
  }

  _action(action, wz) {
    return {
      action,
      wx: Math.floor(this.tx),
      wy: Math.floor(this.ty),
      wz: wz ?? Math.floor(this.tz),
      itemId: this.heldItem?.id ?? null,
    }
  }

  _clampMove(v, max) {
    return Math.max(0, Math.min(max - 0.01, v))
  }

  _land(now) {
    this.onGround = true
    this._isCoyoteJump = false
    this._coyoteTimer = 0
    this._landedAt = now
    this._squash(1.4, 0.65, 70)
  }

  // Authoritative held-item update from the server (drives the indicator + passive effects).
  setHeldItem(item) {
    this.heldItem = item ?? null
    this._updateIndicator()
  }

  // Swap the set of platforms used for landing collision (e.g. revealing hidden ones).
  setPlatforms(platforms) {
    this._platforms = platforms
  }

  // Transient emote bubble above the head (local + relayed to others).
  showEmote(type) {
    showEmoteAbove(this.scene, this.gfx, type)
  }

  // Server-driven head bounce (Mechanic 5)
  applyBounce(vel) {
    this.vz = vel
    this.onGround = false
    this._isCoyoteJump = false
    this._squash(0.85, 1.3, 90)
  }

  _syncPosition() {
    const originX = this.scene.scale.width / 2
    const originY = 80
    const ground = toScreen(this.tx, this.ty, 0, originX, originY)
    this.shadowGfx.setPosition(ground.x, ground.y)
    const { x, y } = toScreen(this.tx, this.ty, this.tz, originX, originY)
    const wallNudge = this._isWallSliding ? -this._wallDir.x * 2 : 0
    this.gfx.setPosition(x + wallNudge, y - TILE_H / 2)
    this.gfx.setScale(this._scaleX, this._scaleY)
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
