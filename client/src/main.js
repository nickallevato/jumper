import Phaser from 'phaser'
import { Boot } from './scenes/Boot.js'
import { WorldScene } from './scenes/WorldScene.js'

new Phaser.Game({
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1a2e',
  scene: [Boot, WorldScene],
})
