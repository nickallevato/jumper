import { describe, it, expect } from 'vitest'
import { createFixedStepLoop } from '../server/rooms.js'

function runLoopWithFrames(frames, options = {}) {
  let time = 0
  const steps = []
  const broadcasts = []
  const loop = createFixedStepLoop({
    stepMs: 50,
    broadcastMs: 100,
    pollMs: 16,
    now: () => time,
    setTimer: () => 1,
    clearTimer: () => {},
    step: frame => steps.push(frame),
    broadcast: frame => broadcasts.push(frame),
    ...options,
  })

  for (const frameMs of frames) {
    time += frameMs
    loop.runFrame()
  }
  loop.stop()

  return { steps, broadcasts }
}

function legacyBroadcastTimes(frames, { broadcastMs = 50 } = {}) {
  let time = 0
  let broadcastAccumulatorMs = 0
  const broadcasts = []
  for (const frameMs of frames) {
    time += frameMs
    broadcastAccumulatorMs += frameMs
    if (broadcastAccumulatorMs >= broadcastMs) {
      broadcasts.push(time)
      broadcastAccumulatorMs %= broadcastMs
    }
  }
  return broadcasts
}

function deltas(values) {
  return values.slice(1).map((v, i) => v - values[i])
}

describe('fixed-step server loop', () => {
  it('runs the same simulation ticks whether elapsed time arrives steadily or under load', () => {
    const steady = runLoopWithFrames([50, 50, 50])
    const delayed = runLoopWithFrames([150])

    expect(steady.steps).toEqual(delayed.steps)
    expect(delayed.steps.map(s => s.simulationTimeMs)).toEqual([50, 100, 150])
  })

  it('broadcasts on its own cadence after authoritative simulation catches up', () => {
    const { steps, broadcasts } = runLoopWithFrames([40, 40, 40, 40], { broadcastMs: 50 })

    expect(steps.map(s => s.tick)).toEqual([1, 2, 3])
    expect(broadcasts).toEqual([
      { tick: 1, simulationTimeMs: 50, alpha: 0.6 },
      { tick: 2, simulationTimeMs: 100, alpha: 0.4 },
      { tick: 3, simulationTimeMs: 150, alpha: 0.2 },
    ])
  })

  it('does not run partial simulation ticks for short frames', () => {
    const { steps, broadcasts } = runLoopWithFrames([16, 16, 16])

    expect(steps).toEqual([])
    expect(broadcasts).toEqual([])
  })

  it('keeps 20Hz broadcast simulation cadence despite 16ms polling jitter', () => {
    const frames = Array(100).fill(16)
    const before = legacyBroadcastTimes(frames)
    const { broadcasts } = runLoopWithFrames(frames, { broadcastMs: 50 })
    const after = broadcasts.map(b => b.simulationTimeMs)

    expect(deltas(before)).toContain(48)
    expect(deltas(before)).toContain(64)
    expect(after.slice(0, 6)).toEqual([50, 100, 150, 200, 250, 300])
    expect(new Set(deltas(after))).toEqual(new Set([50]))
  })
})
