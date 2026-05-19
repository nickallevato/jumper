import Phaser from 'phaser'
import { IsoMap } from '../IsoMap.js'
import { Player } from '../Player.js'
import { RemotePlayer } from '../RemotePlayer.js'
import { getSocket } from '../net.js'
import { toScreen } from '../iso.js'
import { SOCKET_EVENTS as E, TILE_H } from '../../../shared/constants.js'

const OVERWORLD_GRID = Array.from({ length: 16 }, (_, ty) =>
  Array.from({ length: 16 }, (_, tx) => {
    if (tx === 0 || tx === 15 || ty === 0 || ty === 15) return 2
    return 1
  })
)

export class WorldScene extends Phaser.Scene {
  constructor() { super('WorldScene') }

  create(data) {
    this.playerId = data?.playerId
    this.profile  = data?.profile
    this.roomId   = data?.roomId ?? 'overworld'

    const originX = this.scale.width / 2
    const originY = 80

    this.isoMap = new IsoMap(this, OVERWORLD_GRID, originX, originY)
    this.player = new Player(this, 8, 8, this.profile)

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
    const socket = getSocket()
    this._socket = socket

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

    // Q = drop held item
    this.input.keyboard.on('keydown-Q', () => {
      const state = this.player.getState()
      this._socket.emit(E.ITEM_DROP, { x: state.x, y: state.y, z: state.z })
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
      g.setPosition(x, y)
      this._worldItemGfx.set(item.worldItemId, g)
      g._worldItemId = item.worldItemId
      g._wx = item.wx
      g._wy = item.wy
    }
  }

  update(_time, delta) {
    const dt = delta / 1000
    this.player.update(dt, this.cursors, this.keys, OVERWORLD_GRID)

    // Send position to server
    const state = this.player.getState()
    this._socket.emit(E.MOVE, state)

    // Auto-pickup: within 0.8 tiles, empty-handed
    if (!this.profile?.heldItem) {
      for (const [worldItemId, g] of this._worldItemGfx) {
        const dx = Math.abs(this.player.tx - g._wx)
        const dy = Math.abs(this.player.ty - g._wy)
        if (dx < 0.8 && dy < 0.8) {
          this._socket.emit(E.ITEM_PICKUP, { worldItemId })
          break
        }
      }
    }

    // Interpolate remote players
    for (const rp of this.remotePlayers.values()) rp.update()
  }
}
