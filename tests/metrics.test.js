import express from 'express'
import { describe, expect, it, afterEach } from 'vitest'
import { JumperMetrics, jumperMetrics, metricsHandler } from '../server/metrics.js'

describe('jumper metrics', () => {
  afterEach(() => {
    jumperMetrics.reset()
  })

  it('renders tick and socket patch p95 in Prometheus text', () => {
    const metrics = new JumperMetrics()
    metrics.clientConnected()
    metrics.playerJoinedRoom('overworld')
    metrics.recordSim('overworld', 1)
    metrics.recordSim('overworld', 8)
    metrics.recordPatch('overworld', 2, { encodeMs: 0.4, bytes: 120, fanout: 2 })
    metrics.recordPatch('overworld', 5, { encodeMs: 0.9, bytes: 200, fanout: 2 })

    const text = metrics.prometheusText()

    expect(text).toContain('jumper_room_count 1')
    expect(text).toContain('jumper_connected_clients 1')
    expect(text).toContain('jumper_players_per_room{room_id="overworld"} 1')
    expect(text).toContain('jumper_tick_ms{quantile="0.95",room_id="overworld"}')
    expect(text).toContain('jumper_patch_encode_ms{quantile="0.95",room_id="overworld"}')
    expect(text).toContain('jumper_patch_bytes{quantile="0.95",room_id="overworld"}')
  })

  it('serves GET /metrics over HTTP', async () => {
    jumperMetrics.playerJoinedRoom('grove')
    jumperMetrics.recordSim('grove', 3)
    const app = express()
    app.get('/metrics', metricsHandler())
    const server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s))
    })
    try {
      const { port } = server.address()
      const response = await fetch(`http://127.0.0.1:${port}/metrics`)
      const body = await response.text()

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/plain')
      expect(body).toContain('jumper_tick_ms{quantile="0.95",room_id="grove"} 3')
    } finally {
      await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
    }
  })
})
