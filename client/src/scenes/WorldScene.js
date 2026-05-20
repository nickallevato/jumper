import Phaser from 'phaser'
import { IsoMap } from '../IsoMap.js'
import { Player } from '../Player.js'
import { RemotePlayer } from '../RemotePlayer.js'
import { getSocket } from '../net.js'
import { toScreen } from '../iso.js'
import { SOCKET_EVENTS as E, TILE_H, TILE_W } from '../../../shared/constants.js'
import { COUNTERWEIGHT } from '../../../shared/puzzles.js'
import { cosmeticIdForUnlock } from '../../../shared/cosmetics.js'
import { getRoom } from '../maps.js'

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('WorldScene')
    this._pickupCooldown = 0
    this._itemBobTime = 0
  }

  create(data) {
    this.playerId = data?.playerId
    this.profile  = data?.profile
    this.roomId   = data?.roomId ?? 'overworld'

    // Detach socket handlers when this scene instance stops (e.g. on room transition),
    // so a restart doesn't stack duplicate listeners on the shared socket.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)

    const room = getRoom(this.roomId)
    this.grid = room.grid
    this.platforms = room.platforms
    this.portals = room.portals ?? []
    this.cameras.main.setBackgroundColor(room.bg ?? '#1a1a2e')
    this.cameras.main.fadeIn(180, 0, 0, 0)
    this._transitioning = false

    const originX = this.scale.width / 2
    const originY = 80

    // Counterweight puzzle lives only in the overworld. The riser is mutable: its tz is
    // the single source of truth for both its drawn height and player collision.
    let staticPlatforms = [...this.platforms]
    this.riser = null
    if (this.roomId === 'overworld') {
      const { riser, goal, plate } = COUNTERWEIGHT
      this.riser = { tx: riser.tx, ty: riser.ty, tz: riser.loweredZ }
      this._plate = plate
      staticPlatforms = [...staticPlatforms, { tx: goal.tx, ty: goal.ty, tz: goal.tz }]
    }
    const collisionPlatforms = this.riser ? [...staticPlatforms, this.riser] : staticPlatforms

    this.isoMap = new IsoMap(this, this.grid, originX, originY, staticPlatforms)
    this._drawPortals(originX, originY)
    if (this.riser) {
      this._drawPlate(originX, originY)
      this._riserGfx = this.add.graphics()
      this._drawRiser()
    }
    const spawn = room.spawn ?? { tx: 8, ty: 8 }
    this.player = new Player(this, spawn.tx, spawn.ty, this.profile, collisionPlatforms)

    // Brief grace so we don't instantly re-trigger the portal we just arrived through.
    this._portalLock = true
    this.time.delayedCall(500, () => { this._portalLock = false })

    this.cursors = this.input.keyboard.createCursorKeys()
    this.keys = this.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      e: Phaser.Input.Keyboard.KeyCodes.E,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
    })

    // Multiplayer
    this.remotePlayers = new Map()
    this._worldItemGfx = new Map()
    this._heldItem = this.profile?.heldItem ?? null
    this._pickupCooldown = 0
    this._lastState = null
    const socket = getSocket()
    this._socket = socket

    this.player.onDiscoverAttempt = (payload) => {
      this._socket.emit(E.DISCOVER, payload)
    }

    socket.emit(E.JOIN_ROOM, { roomId: this.roomId })

    socket.on(E.JOIN_OK, ({ players, worldItems, puzzle }) => {
      for (const p of players) {
        if (p.id === this.playerId) continue
        this.remotePlayers.set(p.id, new RemotePlayer(this, p.id, p.x, p.y, p.z, p.cosmeticId))
      }
      this._renderWorldItems(worldItems)
      // Snap the riser to whatever state the room is already in (no animation on join).
      if (this.riser) {
        this.riser.tz = puzzle?.raised ? COUNTERWEIGHT.riser.raisedZ : COUNTERWEIGHT.riser.loweredZ
        this._drawRiser()
      }
    })

    socket.on(E.TICK, ({ players }) => {
      const seen = new Set()
      for (const p of players) {
        if (p.id === this.playerId) continue
        seen.add(p.id)
        if (this.remotePlayers.has(p.id)) {
          this.remotePlayers.get(p.id).updateTarget(p.x, p.y, p.z, p.cosmeticId)
        } else {
          this.remotePlayers.set(p.id, new RemotePlayer(this, p.id, p.x, p.y, p.z, p.cosmeticId))
        }
      }
      for (const [id, rp] of this.remotePlayers) {
        if (!seen.has(id)) { rp.destroy(); this.remotePlayers.delete(id) }
      }
    })

    socket.on(E.ITEM_STATE, ({ worldItems }) => {
      this._renderWorldItems(worldItems)
    })

    socket.on(E.DISCOVER_OK, ({ secretId, effect }) => {
      console.log('Discovery:', secretId, effect)
      this._showDiscoveryFlash(secretId)
      if (this.profile) {
        this.profile.discoveredSecrets = [...(this.profile.discoveredSecrets ?? []), secretId]
      }
      // If this secret equips a cosmetic, recolor the local player to match.
      if (effect?.type === 'cosmetic') {
        const id = cosmeticIdForUnlock(secretId)
        if (id) { this.player.setCosmetic(id); if (this.profile) this.profile.cosmetic_id = id }
      }
    })

    socket.on(E.BOUNCE_HEAD, ({ vel }) => {
      this.player.applyBounce(vel)
    })

    socket.on(E.PUZZLE_STATE, ({ raised }) => {
      if (!this.riser) return
      const { loweredZ, raisedZ } = COUNTERWEIGHT.riser
      this._riserTween?.stop()
      this._riserTween = this.tweens.add({
        targets: this.riser,
        tz: raised ? raisedZ : loweredZ,
        duration: 450,
        ease: 'Sine.easeInOut',
      })
    })

    // Q = drop held item
    this.input.keyboard.on('keydown-Q', () => {
      if (!this._heldItem) return
      const state = this.player.getState()
      this._socket.emit(E.ITEM_DROP, { x: state.x, y: state.y, z: state.z })
      this._heldItem = null
    })
  }

  // Bright sunken plate — visually invites stepping/dropping; pulses to read as interactive.
  _drawPlate(originX, originY) {
    const { x, y } = toScreen(this._plate.tx, this._plate.ty, 0, originX, originY)
    const hw = TILE_W / 2, hh = TILE_H / 2
    const g = this.add.graphics()
    g.fillStyle(0xf9e2af, 1)
    g.fillPoints([
      { x: 0, y: -hh }, { x: hw, y: 0 }, { x: 0, y: hh }, { x: -hw, y: 0 },
    ], true)
    g.lineStyle(2, 0xdba90a, 1)
    g.strokePoints([
      { x: 0, y: -hh }, { x: hw, y: 0 }, { x: 0, y: hh }, { x: -hw, y: 0 },
    ], true)
    g.setPosition(x, y)
    this.tweens.add({ targets: g, alpha: { from: 0.55, to: 1 }, duration: 900, yoyo: true, repeat: -1 })
  }

  // Redraw the riser pillar at its current tz (called every frame; tz may be mid-tween).
  _drawRiser() {
    const originX = this.scale.width / 2
    const originY = 80
    const g = this._riserGfx
    g.clear()
    const { x, y } = toScreen(this.riser.tx, this.riser.ty, this.riser.tz, originX, originY)
    const hw = TILE_W / 2, hh = TILE_H / 2
    const D = Math.max(10, this.riser.tz * TILE_H + 10)   // pillar side height grows with rise

    g.fillStyle(0x8a6d3b, 1)   // left face
    g.fillPoints([
      { x: x - hw, y }, { x, y: y + hh }, { x, y: y + hh + D }, { x: x - hw, y: y + D },
    ], true)
    g.fillStyle(0x5e4827, 1)   // right face
    g.fillPoints([
      { x, y: y + hh }, { x: x + hw, y }, { x: x + hw, y: y + D }, { x, y: y + hh + D },
    ], true)
    g.fillStyle(0xc79a5b, 1)   // top
    g.fillPoints([
      { x, y: y - hh }, { x: x + hw, y }, { x, y: y + hh }, { x: x - hw, y },
    ], true)
  }

  // Glowing portal markers — step onto one to travel to another room.
  _drawPortals(originX, originY) {
    const hw = TILE_W / 2, hh = TILE_H / 2
    const diamond = [{ x: 0, y: -hh }, { x: hw, y: 0 }, { x: 0, y: hh }, { x: -hw, y: 0 }]
    for (const portal of this.portals) {
      const { x, y } = toScreen(portal.tx, portal.ty, 0, originX, originY)
      const g = this.add.graphics()
      g.fillStyle(0xcba6f7, 0.9)
      g.fillPoints(diamond, true)
      g.lineStyle(2, 0xf5c2e7, 1)
      g.strokePoints(diamond, true)
      g.setPosition(x, y)
      this.tweens.add({ targets: g, alpha: { from: 0.4, to: 1 }, duration: 700, yoyo: true, repeat: -1 })
    }
  }

  _enterPortal(to) {
    if (this._transitioning) return
    this._transitioning = true
    this.cameras.main.fadeOut(180, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.restart({ playerId: this.playerId, profile: this.profile, roomId: to })
    })
  }

  _renderWorldItems(worldItems) {
    for (const g of this._worldItemGfx.values()) g.destroy()
    this._worldItemGfx.clear()

    const originX = this.scale.width / 2
    const originY = 80

    for (const item of worldItems) {
      const { x, y } = toScreen(item.wx, item.wy, item.wz, originX, originY)
      const g = this.add.graphics()
      g.fillStyle(0xfab387, 1)
      g.fillCircle(0, 0, 6)
      g._baseX = x
      g._baseY = y
      g.setPosition(x, y)
      this._worldItemGfx.set(item.worldItemId, g)
      g._worldItemId = item.worldItemId
      g._wx = item.wx
      g._wy = item.wy
    }
  }

  update(_time, delta) {
    const dt = delta / 1000
    if (this._transitioning) return
    this.player.update(dt, this.cursors, this.keys, this.grid, this.platforms)

    // Riser: redraw at its (possibly tweening) height, and carry a rider up/down with it.
    if (this.riser) {
      this._drawRiser()
      if (this.player.onGround &&
          Math.floor(this.player.tx) === this.riser.tx &&
          Math.floor(this.player.ty) === this.riser.ty) {
        this.player.tz = this.riser.tz
      }
    }

    // Portal travel: step onto a portal tile to change rooms.
    if (!this._portalLock) {
      for (const portal of this.portals) {
        if (Math.abs(this.player.tx - portal.tx) < 0.6 && Math.abs(this.player.ty - portal.ty) < 0.6) {
          this._enterPortal(portal.to)
          break
        }
      }
    }

    // Send position to server (only when changed)
    const state = this.player.getState()
    const last = this._lastState
    if (!last || state.x !== last.x || state.y !== last.y || state.z !== last.z || state.facing !== last.facing) {
      this._socket.emit(E.MOVE, state)
      this._lastState = state
    }

    // Auto-pickup: within 0.8 tiles, empty-handed, rate-limited
    this._pickupCooldown = Math.max(0, this._pickupCooldown - delta)
    if (!this._heldItem && this._pickupCooldown === 0) {
      for (const [worldItemId, g] of this._worldItemGfx) {
        const dx = Math.abs(this.player.tx - g._wx)
        const dy = Math.abs(this.player.ty - g._wy)
        if (dx < 0.8 && dy < 0.8) {
          this._socket.emit(E.ITEM_PICKUP, { worldItemId })
          this._heldItem = { pending: true }   // optimistic: treat as holding until ITEM_STATE
          this._pickupCooldown = 500
          break
        }
      }
    }

    // Animate world items bobbing
    this._itemBobTime += delta
    const bobOffset = Math.sin(this._itemBobTime * 0.003) * 5
    for (const g of this._worldItemGfx.values()) {
      g.setPosition(g._baseX, g._baseY + bobOffset)
    }

    // Interpolate remote players
    for (const rp of this.remotePlayers.values()) rp.update()
  }

  _showDiscoveryFlash(secretId) {
    const text = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2 - 60,
      '✦ discovered',
      { color: '#a6e3a1', fontSize: '22px', fontStyle: 'bold' }
    ).setOrigin(0.5).setAlpha(0)

    this.tweens.add({
      targets: text,
      alpha: { from: 1, to: 0 },
      y: '-=40',
      duration: 2000,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    })
  }

  shutdown() {
    const socket = getSocket()
    socket.off(E.JOIN_OK)
    socket.off(E.TICK)
    socket.off(E.ITEM_STATE)
    socket.off(E.DISCOVER_OK)
    socket.off(E.BOUNCE_HEAD)
    socket.off(E.PUZZLE_STATE)
  }
}
