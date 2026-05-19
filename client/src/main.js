import Phaser from 'phaser'
import { Boot } from './scenes/Boot.js'

// WorldScene placeholder until Task 10
class WorldScene extends Phaser.Scene {
  constructor() { super('WorldScene') }
  create(data) {
    this.add.text(20, 20, `playerId: ${data.playerId}`, { color: '#0f0', fontSize: '14px' })
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1a2e',
  scene: [Boot, WorldScene],
})
