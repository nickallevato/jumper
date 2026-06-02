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

describe('fixed-step server loop', () => {
  it('runs the same simulation ticks whether elapsed time arrives steadily or under load', () => {
    const steady = runLoopWithFrames([50, 50, 50])
    const delayed = runLoopWithFrames([150])

    expect(steady.steps).toEqual(delayed.steps)
    expect(delayed.steps.map(s => s.simulationTimeMs)).toEqual([50, 100, 150])
  })

  it('broadcasts on its own cadence after authoritative simulation catches up', () => {
    const { steps, broadcasts } = runLoopWithFrames([40, 40, 40, 40])

    expect(steps.map(s => s.tick)).toEqual([1, 2, 3])
    expect(broadcasts).toEqual([
      { tick: 2, simulationTimeMs: 100, alpha: 0.4 },
    ])
  })

  it('does not run partial simulation ticks for short frames', () => {
    const { steps, broadcasts } = runLoopWithFrames([16, 16, 16])

    expect(steps).toEqual([])
    expect(broadcasts).toEqual([])
  })
})
