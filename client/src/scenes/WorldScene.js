import Phaser from 'phaser'
import { IsoMap } from '../IsoMap.js'
import { Player } from '../Player.js'
import { RemotePlayer } from '../RemotePlayer.js'
import { getSocket } from '../net.js'
import { toScreen } from '../iso.js'
import { SOCKET_EVENTS as E, TILE_H } from '../../../shared/constants.js'

// 2 = wall, 1 = ground
const OVERWORLD_GRID = [
  [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,2,2,1,1,1,1,1,1,2,2,1,1,2],
  [2,1,1,2,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,2,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,2,2,1,1,2,2,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,2,2,1,1,2],
  [2,1,1,2,2,1,1,1,1,1,1,2,1,1,1,2],
  [2,1,1,2,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2],
  [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
]

// Elevated platforms — players can jump onto these
const PLATFORMS = [
  // Center-north pair (over the secret trigger zone x:5-8, y:5-8)
  { tx: 7, ty: 5, tz: 1 },
  { tx: 8, ty: 5, tz: 1 },
  // Extra step above
  { tx: 7, ty: 4, tz: 1.5 },
  // Center-south pair (symmetric landmark)
  { tx: 7, ty: 9, tz: 1 },
  { tx: 8, ty: 9, tz: 1 },
  // Top-right raised area (feather_wind secret zone x:10-13, y:3-6)
  { tx: 12, ty: 3, tz: 1 },
  { tx: 13, ty: 3, tz: 1 },
  { tx: 12, ty: 4, tz: 1 },
  // Bottom-left step (deep_dive secret zone x:0-3, y:10-13)
  { tx: 2, ty: 11, tz: 0.75 },
  { tx: 2, ty: 12, tz: 0.75 },
]

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

    const originX = this.scale.width / 2
    const originY = 80

    this.isoMap = new IsoMap(this, OVERWORLD_GRID, originX, originY, PLATFORMS)
    this.player = new Player(this, 8, 8, this.profile, PLATFORMS)

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

    socket.on(E.JOIN_OK, ({ players, worldItems }) => {
      for (const p of players) {
        if (p.id === this.playerId) continue
        this.remotePlayers.set(p.id, new RemotePlayer(this, p.id, p.x, p.y, p.z))
      }
      this._renderWorldItems(worldItems)
    })

    socket.on(E.TICK, ({ players }) => {
      const seen = new Set()
      for (const p of players) {
        if (p.id === this.playerId) continue
        seen.add(p.id)
        if (this.remotePlayers.has(p.id)) {
          this.remotePlayers.get(p.id).updateTarget(p.x, p.y, p.z)
        } else {
          this.remotePlayers.set(p.id, new RemotePlayer(this, p.id, p.x, p.y, p.z))
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
    })

    socket.on(E.BOUNCE_HEAD, ({ vel }) => {
      this.player.applyBounce(vel)
    })

    // Q = drop held item
    this.input.keyboard.on('keydown-Q', () => {
      if (!this._heldItem) return
      const state = this.player.getState()
      this._socket.emit(E.ITEM_DROP, { x: state.x, y: state.y, z: state.z })
      this._heldItem = null
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
    this.player.update(dt, this.cursors, this.keys, OVERWORLD_GRID, PLATFORMS)

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
  }
}
