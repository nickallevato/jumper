const SAMPLE_LIMIT = 1200

class RollingSeries {
  constructor() {
    this.values = new Array(SAMPLE_LIMIT)
    this.index = 0
    this.size = 0
    this.sum = 0
  }

  add(value) {
    if (!Number.isFinite(value)) return
    if (this.size < SAMPLE_LIMIT) {
      this.values[this.index] = value
      this.sum += value
      this.size += 1
    } else {
      const previous = this.values[this.index] ?? 0
      this.values[this.index] = value
      this.sum += value - previous
    }
    this.index = (this.index + 1) % SAMPLE_LIMIT
  }

  snapshot() {
    if (this.size === 0) return { count: 0, avg: 0, p50: 0, p95: 0, max: 0 }
    const sorted = this.values.slice(0, this.size).sort((a, b) => a - b)
    return {
      count: this.size,
      avg: this.sum / this.size,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      max: sorted[sorted.length - 1] ?? 0,
    }
  }
}

class RoomMetrics {
  constructor() {
    this.simMs = new RollingSeries()
    this.patchMs = new RollingSeries()
    this.patchEncodeMs = new RollingSeries()
    this.patchBytes = new RollingSeries()
    this.patchBytesPerClient = new RollingSeries()
    this.patchFanout = new RollingSeries()
    this.players = 0
    this.ticks = 0
    this.patchAttempts = 0
    this.patchesApplied = 0
  }
}

export class JumperMetrics {
  constructor() {
    this.rooms = new Map()
    this.connectedClients = 0
  }

  reset() {
    this.rooms.clear()
    this.connectedClients = 0
  }

  clientConnected() {
    this.connectedClients += 1
  }

  clientDisconnected() {
    this.connectedClients = Math.max(0, this.connectedClients - 1)
  }

  playerJoinedRoom(roomId) {
    this.room(roomId).players += 1
  }

  playerLeftRoom(roomId) {
    const room = this.room(roomId)
    room.players = Math.max(0, room.players - 1)
    if (room.players === 0) this.rooms.delete(roomId)
  }

  recordSim(roomId, ms) {
    const room = this.room(roomId)
    room.ticks += 1
    room.simMs.add(ms)
  }

  recordPatch(roomId, ms, { encodeMs, bytes, fanout }) {
    const room = this.room(roomId)
    room.patchAttempts += 1
    room.patchesApplied += 1
    room.patchMs.add(ms)
    room.patchEncodeMs.add(encodeMs)
    room.patchBytes.add(bytes)
    room.patchBytesPerClient.add(fanout > 0 ? bytes / fanout : 0)
    room.patchFanout.add(fanout)
  }

  prometheusText() {
    const mem = process.memoryUsage()
    const lines = [
      '# HELP jumper_room_count Active Jumper room count.',
      '# TYPE jumper_room_count gauge',
      `jumper_room_count ${this.rooms.size}`,
      '# HELP jumper_connected_clients Connected socket.io clients.',
      '# TYPE jumper_connected_clients gauge',
      `jumper_connected_clients ${this.connectedClients}`,
      '# HELP jumper_process_heap_bytes Node.js process heap used.',
      '# TYPE jumper_process_heap_bytes gauge',
      `jumper_process_heap_bytes ${mem.heapUsed}`,
      '# HELP jumper_process_rss_bytes Node.js process resident set size.',
      '# TYPE jumper_process_rss_bytes gauge',
      `jumper_process_rss_bytes ${mem.rss}`,
    ]

    for (const [roomId, room] of this.rooms) {
      const label = `room_id="${escapeLabel(roomId)}"`
      lines.push(
        '# HELP jumper_players_per_room Current player count by room.',
        '# TYPE jumper_players_per_room gauge',
        `jumper_players_per_room{${label}} ${room.players}`,
        '# HELP jumper_tick_total Simulation ticks processed by room.',
        '# TYPE jumper_tick_total counter',
        `jumper_tick_total{${label}} ${room.ticks}`,
        '# HELP jumper_tick_ms Simulation tick duration in milliseconds.',
        '# TYPE jumper_tick_ms summary',
        ...summaryLines('jumper_tick_ms', label, room.simMs.snapshot()),
        '# HELP jumper_patch_ms Socket patch broadcast duration in milliseconds.',
        '# TYPE jumper_patch_ms summary',
        ...summaryLines('jumper_patch_ms', label, room.patchMs.snapshot()),
        '# HELP jumper_patch_encode_ms Socket patch encode duration in milliseconds.',
        '# TYPE jumper_patch_encode_ms summary',
        ...summaryLines('jumper_patch_encode_ms', label, room.patchEncodeMs.snapshot()),
        '# HELP jumper_patch_bytes Serialized bytes per room patch.',
        '# TYPE jumper_patch_bytes summary',
        ...summaryLines('jumper_patch_bytes', label, room.patchBytes.snapshot()),
        '# HELP jumper_patch_bytes_per_client Serialized bytes per room patch recipient.',
        '# TYPE jumper_patch_bytes_per_client summary',
        ...summaryLines('jumper_patch_bytes_per_client', label, room.patchBytesPerClient.snapshot()),
        '# HELP jumper_patch_fanout Recipients per room patch.',
        '# TYPE jumper_patch_fanout summary',
        ...summaryLines('jumper_patch_fanout', label, room.patchFanout.snapshot()),
        '# HELP jumper_patch_attempts_total Socket patch attempts by room.',
        '# TYPE jumper_patch_attempts_total counter',
        `jumper_patch_attempts_total{${label}} ${room.patchAttempts}`,
        '# HELP jumper_patches_applied_total Socket patches emitted by room.',
        '# TYPE jumper_patches_applied_total counter',
        `jumper_patches_applied_total{${label}} ${room.patchesApplied}`,
      )
    }

    return `${lines.join('\n')}\n`
  }

  room(roomId) {
    let room = this.rooms.get(roomId)
    if (!room) {
      room = new RoomMetrics()
      this.rooms.set(roomId, room)
    }
    return room
  }
}

export const jumperMetrics = new JumperMetrics()

export function metricsHandler(metrics = jumperMetrics) {
  return (_req, res) => {
    res.type('text/plain; version=0.0.4; charset=utf-8')
    res.send(metrics.prometheusText())
  }
}

export function logEvent(event, fields = {}) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    service: 'jumper_server',
    event,
    ...fields,
  }))
}

function summaryLines(name, label, snapshot) {
  return [
    `${name}{${label}} ${snapshot.avg}`,
    `${name}{quantile="0.5",${label}} ${snapshot.p50}`,
    `${name}{quantile="0.95",${label}} ${snapshot.p95}`,
    `${name}_count{${label}} ${snapshot.count}`,
    `${name}_max{${label}} ${snapshot.max}`,
  ]
}

function percentile(sorted, p) {
  return sorted[Math.floor((sorted.length - 1) * p)] ?? 0
}

function escapeLabel(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}
