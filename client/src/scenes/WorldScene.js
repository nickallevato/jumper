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
import { Sound } from '../sound.js'

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
    // Deep-copy the grid so opening doors (mutating tiles) never corrupts the shared registry.
    this.grid = room.grid.map(r => [...r])
    this.platforms = room.platforms
    this.portals = room.portals ?? []
    this.doors = room.doors ?? []
    this._openDoors = new Set()
    this._bell = room.bell ?? null
    this._rang = false
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
    this._doorGfx = new Map()
    this._drawDoors(originX, originY)
    if (this.riser) {
      this._drawPlate(originX, originY)
      this._riserGfx = this.add.graphics()
      this._drawRiser()
    }
    const spawn = room.spawn ?? { tx: 8, ty: 8 }
    this.player = new Player(this, spawn.tx, spawn.ty, this.profile, collisionPlatforms)

    // Lantern-revealed hidden platforms: rendered + collidable only while holding a Lantern.
    this._basePlatforms = collisionPlatforms
    this._hidden = room.hidden ?? []
    this._hiddenGfx = this._hidden.map(p => this._drawHidden(p, originX, originY))
    this._applyReveal()

    if (this._bell) this._drawBell(originX, originY)

    // Tall/large rooms: camera follows the player, clamped to the room's content bounds.
    if (room.follow) {
      const b = this._computeBounds(originX, originY)
      this.cameras.main.setBounds(b.x, b.y, b.w, b.h)
      this.cameras.main.startFollow(this.player.gfx, true, 0.12, 0.12)
    }

    // Brief grace so we don't instantly re-trigger the portal we just arrived through.
    this._portalLock = true
    this.time.delayedCall(500, () => { this._portalLock = false })

    // Discovery counter HUD — count only (no totals/names), fixed to the camera.
    this._hud = this.add.text(16, 12, this._discoveryLabel(), {
      color: '#a6e3a1', fontSize: '18px', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(1000)

    // Room player-count HUD (top-right) — social awareness of who's here with you.
    this._countHud = this.add.text(this.scale.width - 16, 12, '', {
      color: '#89dceb', fontSize: '18px', fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000)
    this._setRoomCount(1)

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

    socket.on(E.JOIN_OK, ({ players, worldItems, puzzle, openDoors }) => {
      for (const p of players) {
        if (p.id === this.playerId) continue
        this.remotePlayers.set(p.id, new RemotePlayer(this, p.id, p.x, p.y, p.z, p.cosmeticId))
      }
      this._renderWorldItems(worldItems)
      this._setRoomCount(players.length)
      for (const d of openDoors ?? []) this._openDoor(d.tx, d.ty)
      // Snap the riser to whatever state the room is already in (no animation on join).
      if (this.riser) {
        this.riser.tz = puzzle?.raised ? COUNTERWEIGHT.riser.raisedZ : COUNTERWEIGHT.riser.loweredZ
        this._drawRiser()
      }
    })

    socket.on(E.TICK, ({ players }) => {
      this._setRoomCount(players.length)
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
      Sound.discover()
      this._juiceDiscovery()
      if (this.profile) {
        const already = (this.profile.discoveredSecrets ?? []).includes(secretId)
        if (!already) {
          this.profile.discoveredSecrets = [...(this.profile.discoveredSecrets ?? []), secretId]
          this._bumpHud()
        }
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

    socket.on(E.DOOR_OPEN, ({ tx, ty }) => {
      this._openDoor(tx, ty)
      // The Key consumer's held state is corrected privately via item:held — not here,
      // so a door opening doesn't wrongly clear other players' items.
    })

    socket.on(E.EMOTE, ({ id, type }) => {
      this.remotePlayers.get(id)?.showEmote(type)
    })

    socket.on(E.WORLD_EVENT, ({ type }) => {
      if (type === 'bell') { this._showWorldBanner('🔔 a bell tolls in the distance'); Sound.bell() }
    })

    // Authoritative held-item state: keeps the indicator + pickup gate in sync with the server.
    socket.on(E.ITEM_HELD, ({ item }) => {
      this._heldItem = item
      this.player.setHeldItem(item)
      this._applyReveal()
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
      this.player.setHeldItem(null)   // optimistic; server confirms via item:held
    })

    // F = wave emote (shown locally + relayed to others in the room).
    this.input.keyboard.on('keydown-F', () => {
      this.player.showEmote('wave')
      this._socket.emit(E.EMOTE, { type: 'wave' })
    })

    // E = use held item on a nearby door (server validates it's a Key).
    this.input.keyboard.on('keydown-E', () => {
      const near = this.doors.find(d =>
        !this._openDoors.has(`${d.tx},${d.ty}`) &&
        Math.hypot(this.player.tx - d.tx, this.player.ty - d.ty) < 1.3
      )
      if (!near) return
      this._socket.emit(E.ITEM_USE, { triggerId: 'unlock_door', x: this.player.tx, y: this.player.ty })
    })

    // M = toggle sound (persisted).
    this.input.keyboard.on('keydown-M', () => {
      const muted = Sound.toggleMute()
      this._showWorldBanner(muted ? 'sound off' : 'sound on')
    })
  }

  // Door markers: a distinct banded diamond on the closed door tile so it reads as a door.
  _drawDoors(originX, originY) {
    const hw = TILE_W / 2, hh = TILE_H / 2
    const diamond = [{ x: 0, y: -hh }, { x: hw, y: 0 }, { x: 0, y: hh }, { x: -hw, y: 0 }]
    for (const d of this.doors) {
      const { x, y } = toScreen(d.tx, d.ty, 0, originX, originY)
      const g = this.add.graphics()
      g.fillStyle(0x9a6b3f, 1)
      g.fillPoints(diamond, true)
      g.lineStyle(2, 0xd9a066, 1)
      g.strokePoints(diamond, true)
      g.fillStyle(0x2b1d10, 1)
      g.fillCircle(0, -4, 3)   // keyhole
      g.setPosition(x, y - 6)
      this._doorGfx.set(`${d.tx},${d.ty}`, g)
    }
  }

  // Open a door tile: make it passable, redraw the map, drop its marker.
  _openDoor(tx, ty) {
    const key = `${tx},${ty}`
    if (this._openDoors.has(key)) return
    this._openDoors.add(key)
    if (this.grid[ty]?.[tx] !== undefined) this.grid[ty][tx] = 1
    this.isoMap.draw()
    const g = this._doorGfx.get(key)
    if (g) { g.destroy(); this._doorGfx.delete(key) }
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

  // Screen-space bounding rect covering all tiles + platforms, with margin (for camera clamp).
  _computeBounds(originX, originY) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    const consider = (tx, ty, tz) => {
      const { x, y } = toScreen(tx, ty, tz, originX, originY)
      minX = Math.min(minX, x - TILE_W / 2); maxX = Math.max(maxX, x + TILE_W / 2)
      minY = Math.min(minY, y - TILE_H / 2); maxY = Math.max(maxY, y + TILE_H + 40)
    }
    for (let ty = 0; ty < this.grid.length; ty++)
      for (let tx = 0; tx < this.grid[ty].length; tx++)
        if (this.grid[ty][tx]) consider(tx, ty, 0)
    for (const p of this._basePlatforms) consider(p.tx, p.ty, p.tz)
    const m = 140
    return { x: minX - m, y: minY - m, w: (maxX - minX) + 2 * m, h: (maxY - minY) + 2 * m }
  }

  // The bell at the top of the tower — gold; reaching it records secret_bell.
  _drawBell(originX, originY) {
    const { x, y } = toScreen(this._bell.tx, this._bell.ty, this._bell.tz, originX, originY)
    const g = this.add.graphics()
    g.fillStyle(0xffd43b, 1)
    g.fillEllipse(0, -20, 16, 18)        // bell body
    g.fillRect(-9, -14, 18, 4)           // rim
    g.fillStyle(0x8a5a00, 1)
    g.fillCircle(0, -10, 2.5)            // clapper
    g.setPosition(x, y)                  // base anchored on the bell-platform top (same convention as the player)
    g.setDepth(900)
    this.tweens.add({ targets: g, angle: { from: -6, to: 6 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
  }

  // A hidden platform, drawn as a ghostly box (hidden until the Lantern reveals it).
  _drawHidden(p, originX, originY) {
    const g = this.add.graphics()
    const { x, y } = toScreen(p.tx, p.ty, p.tz, originX, originY)
    const hw = TILE_W / 2, hh = TILE_H / 2
    const D = Math.max(10, p.tz * TILE_H + 10)
    g.fillStyle(0x94e2d5, 0.32)
    g.fillPoints([{ x: x - hw, y }, { x, y: y + hh }, { x, y: y + hh + D }, { x: x - hw, y: y + D }], true)
    g.fillStyle(0x74c7ec, 0.32)
    g.fillPoints([{ x, y: y + hh }, { x: x + hw, y }, { x: x + hw, y: y + D }, { x, y: y + hh + D }], true)
    g.fillStyle(0xb9f2e6, 0.6)
    g.fillPoints([{ x, y: y - hh }, { x: x + hw, y }, { x, y: y + hh }, { x: x - hw, y }], true)
    g.setVisible(false)
    return g
  }

  // Toggle hidden platforms (visible + collidable) based on whether a Lantern is held.
  _applyReveal() {
    const reveal = this.player.heldItem?.passive_effect === 'reveal_hidden'
    for (const g of this._hiddenGfx ?? []) g.setVisible(reveal)
    this.player.setPlatforms(reveal ? [...this._basePlatforms, ...this._hidden] : this._basePlatforms)
  }

  // Glowing portal markers — step onto one to travel to another room. Each destination
  // gets a distinct color so the entrances are tellable apart at a glance in the big world.
  _drawPortals(originX, originY) {
    const COLORS = {
      dungeon_grove:     { fill: 0xa6e3a1, line: 0xcfeecc },  // green
      dungeon_belltower: { fill: 0xf9e2af, line: 0xffe08a },  // gold
      dungeon_library:   { fill: 0xcba6f7, line: 0xf5c2e7 },  // violet
      overworld:         { fill: 0x89dceb, line: 0xbfeaf2 },  // sky (return)
    }
    const hw = TILE_W / 2, hh = TILE_H / 2
    const diamond = [{ x: 0, y: -hh }, { x: hw, y: 0 }, { x: 0, y: hh }, { x: -hw, y: 0 }]
    for (const portal of this.portals) {
      const c = COLORS[portal.to] ?? COLORS.overworld
      const { x, y } = toScreen(portal.tx, portal.ty, 0, originX, originY)
      const g = this.add.graphics()
      g.fillStyle(c.fill, 0.9)
      g.fillPoints(diamond, true)
      g.lineStyle(2, c.line, 1)
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
      g.fillCircle(0, -6, 6)   // bottom of the orb rests on the tile-top diamond center (toScreen base)
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
          Math.round(this.player.tx) === this.riser.tx &&
          Math.round(this.player.ty) === this.riser.ty) {
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

    // Ring the bell: reaching the top platform records the discovery (once).
    if (this._bell && !this._rang &&
        Math.hypot(this.player.tx - this._bell.tx, this.player.ty - this._bell.ty) < 0.6 &&
        this.player.tz >= this._bell.reachZ) {
      this._rang = true
      this._socket.emit(E.DISCOVER, {
        action: 'ring_bell', wx: this._bell.tx, wy: this._bell.ty,
        wz: Math.floor(this.player.tz), itemId: null,
      })
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
          Sound.pickup()
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

  _discoveryLabel() {
    return `✦ ${(this.profile?.discoveredSecrets ?? []).length}`
  }

  _setRoomCount(n) {
    const count = Math.max(1, n | 0)
    this._countHud?.setText(count === 1 ? 'here alone' : `${count} here`)
  }

  // Update the counter and pop it briefly to acknowledge a new find.
  _bumpHud() {
    if (!this._hud) return
    this._hud.setText(this._discoveryLabel())
    this.tweens.add({
      targets: this._hud,
      scale: { from: 1.6, to: 1 },
      duration: 320,
      ease: 'Back.easeOut',
    })
  }

  // A brief shake + soft green flash to make a discovery feel momentous.
  _juiceDiscovery() {
    const cam = this.cameras.main
    cam.shake(160, 0.004)
    cam.flash(220, 166, 227, 161)   // soft green (#a6e3a1)
  }

  // Camera-fixed banner near the top for world events (e.g. a bell tolling).
  _showWorldBanner(text) {
    const t = this.add.text(this.scale.width / 2, 64, text, {
      color: '#f9e2af', fontSize: '20px', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0).setScrollFactor(0).setDepth(1000)
    this.tweens.add({
      targets: t,
      alpha: { from: 0, to: 1 },
      duration: 400,
      yoyo: true,
      hold: 2200,
      onComplete: () => t.destroy(),
    })
  }

  _showDiscoveryFlash(secretId) {
    const text = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2 - 60,
      '✦ discovered',
      { color: '#a6e3a1', fontSize: '22px', fontStyle: 'bold' }
    ).setOrigin(0.5).setAlpha(0).setScrollFactor(0).setDepth(1000)

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
    socket.off(E.DOOR_OPEN)
    socket.off(E.EMOTE)
    socket.off(E.ITEM_HELD)
    socket.off(E.WORLD_EVENT)
  }
}
