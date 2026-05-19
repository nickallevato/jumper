import Phaser from 'phaser'
import { IsoMap } from '../IsoMap.js'
import { Player } from '../Player.js'

// Simple 16x16 overworld — 1=ground, 2=wall, 0=air
const OVERWORLD_GRID = Array.from({ length: 16 }, (_, ty) =>
  Array.from({ length: 16 }, (_, tx) => {
    if (tx === 0 || tx === 15 || ty === 0 || ty === 15) return 2   // border walls
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
  }

  update(_time, delta) {
    const dt = delta / 1000
    this.player.update(dt, this.cursors, this.keys, OVERWORLD_GRID)
  }
}
