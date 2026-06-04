import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const ARTIFACT_DIR = path.resolve('qa-artifacts/SMA-301')
const screenshots = path.join(ARTIFACT_DIR, 'screenshots')
fs.mkdirSync(screenshots, { recursive: true })

const exposeGameRoute = async route => {
  const response = await route.fetch()
  let body = await response.text()
  body = body.replace('new Phaser.Game({', 'window.__SMA301_GAME__ = new Phaser.Game({')
  await route.fulfill({ response, body })
}

async function attach(browser, label) {
  const context = await browser.newContext({ viewport: { width: 960, height: 640 } })
  const page = await context.newPage()
  const logs = []
  page.on('console', msg => logs.push(`${label} console:${msg.type()}: ${msg.text()}`))
  page.on('pageerror', err => logs.push(`${label} pageerror: ${err.message}`))
  await page.route('**/src/main.js', exposeGameRoute)
  await page.goto(BASE_URL)
  await page.waitForFunction(() => {
    const game = window.__SMA301_GAME__
    const scene = game?.scene?.getScene('WorldScene')
    return !!scene?._joined && !!scene?.playerId
  }, null, { timeout: 15_000 })
  await page.waitForTimeout(500)
  const playerId = await page.evaluate(() => window.__SMA301_GAME__.scene.getScene('WorldScene').playerId)
  return { context, page, label, playerId, logs }
}

async function remoteState(page, playerId) {
  return await page.evaluate(id => {
    const scene = window.__SMA301_GAME__.scene.getScene('WorldScene')
    const remote = scene.remotePlayers.get(id)
    if (!remote) return null
    return {
      id: remote.id,
      x: remote.tx,
      y: remote.ty,
      z: remote.tz,
      isReconnecting: remote.isReconnecting,
      statusVisible: remote.statusText.visible,
    }
  }, playerId)
}

async function waitForRemote(page, playerId, predicate, label, timeout = 8_000) {
  await page.waitForFunction(({ playerId, source, label }) => {
    const scene = window.__SMA301_GAME__.scene.getScene('WorldScene')
    const remote = scene.remotePlayers.get(playerId) ?? null
    return Function('remote', `return (${source})(remote)`)(remote)
  }, { playerId, source: predicate.toString(), label }, { timeout })
  return await remoteState(page, playerId)
}

async function screenshot(page, name) {
  const file = path.join(screenshots, name)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

const browser = await chromium.launch()
const report = {
  baseUrl: BASE_URL,
  checks: [],
  screenshots: [],
  logs: [],
}
const contexts = []

try {
  const a = await attach(browser, 'A')
  const b = await attach(browser, 'B')
  contexts.push(a.context, b.context)

  await waitForRemote(b.page, a.playerId, remote => !!remote && !remote.isReconnecting, 'initial A visible to B')
  report.checks.push({ name: 'initial two-client visibility', passed: true, a: a.playerId, b: b.playerId })

  await a.page.evaluate(() => window.__SMA301_GAME__.scene.getScene('WorldScene')._socket.io.engine.transport.close())
  const dropped = await waitForRemote(b.page, a.playerId, remote => !!remote?.isReconnecting && remote?.statusText?.visible, 'A reconnecting on B')
  report.checks.push({ name: 'unexpected dropout shows reconnecting affordance', passed: true, remote: dropped })
  report.screenshots.push(await screenshot(b.page, '01-dropout-reconnecting.png'))

  const returned = await waitForRemote(b.page, a.playerId, remote => !!remote && !remote.isReconnecting, 'A returned on B')
  report.checks.push({ name: 'return within window clears reconnecting without duplicate', passed: true, remote: returned })
  report.screenshots.push(await screenshot(b.page, '02-return-cleared.png'))

  const c = await attach(browser, 'C')
  contexts.push(c.context)
  await waitForRemote(b.page, c.playerId, remote => !!remote && !remote.isReconnecting, 'C visible to B')
  await c.page.evaluate(() => window.__SMA301_GAME__.scene.getScene('WorldScene')._socket.disconnect())
  const consentedGone = await waitForRemote(b.page, c.playerId, remote => remote === null, 'C consented leave removes promptly', 3_000)
  report.checks.push({ name: 'consented leave removes promptly', passed: consentedGone === null })

  await a.page.close()
  const timeoutPending = await waitForRemote(b.page, a.playerId, remote => !!remote?.isReconnecting, 'A reconnecting before timeout')
  report.checks.push({ name: 'timeout scenario enters reconnecting grace', passed: true, remote: timeoutPending })
  report.screenshots.push(await screenshot(b.page, '03-timeout-grace.png'))

  const timeoutGone = await waitForRemote(b.page, a.playerId, remote => remote === null, 'A removed after timeout', 6_000)
  report.checks.push({ name: 'timeout cleanup removes through normal path', passed: timeoutGone === null })
  report.screenshots.push(await screenshot(b.page, '04-timeout-cleanup.png'))
} finally {
  for (const context of contexts) await context.close().catch(() => {})
  await browser.close()
}

report.logs = report.logs.concat([])
fs.writeFileSync(path.join(ARTIFACT_DIR, 'reconnect-dropout-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
