import Phaser from 'phaser'
import { authenticate, getSocket } from '../net.js'
import { SOCKET_EVENTS } from '../../../shared/constants.js'

export class Boot extends Phaser.Scene {
  constructor() { super('Boot') }

  async create() {
    const text = this.add.text(
      this.scale.width / 2, this.scale.height / 2,
      'connecting...', { color: '#ffffff', fontSize: '18px' }
    ).setOrigin(0.5)

    const { token, profile } = await authenticate()
    const socket = getSocket()

    socket.emit(SOCKET_EVENTS.AUTH, { token })
    socket.once(SOCKET_EVENTS.AUTH_OK, ({ playerId }) => {
      this.scene.start('WorldScene', { playerId, profile, roomId: 'overworld' })
    })
  }
}
