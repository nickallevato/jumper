import Phaser from 'phaser'
import { IsoMap } from '../IsoMap.js'

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
  }
}
