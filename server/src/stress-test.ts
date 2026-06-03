import { Client, Room as ClientRoom } from "colyseus.js";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function intOption(name: string, envName: string, fallback: number): number {
  const raw = argValue(name) ?? process.env[envName];
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SERVER_URL = argValue("server") ?? process.env.SERVER_URL ?? "http://localhost:2567";
const NUM_PLAYERS = intOption("clients", "NUM_PLAYERS", 4);
const DURATION_SEC = intOption("duration-sec", "DURATION_SEC", intOption("duration-min", "DURATION_MIN", 15) * 60);
const DURATION_MS = DURATION_SEC * 1000;
const INPUT_INTERVAL_MS = 200;
const STATS_INTERVAL_MS = 10_000;

interface BotStats {
  sessionId: string;
  messagesReceived: number;
  messagesSent: number;
  errors: string[];
  disconnects: number;
  reconnects: number;
  lastStateUpdate: number;
  peakPlayersSeen: number;
  stateUpdateCount: number;
}

const bots: { room: ClientRoom; stats: BotStats; inputTimer?: ReturnType<typeof setInterval> }[] = [];
let testStart = 0;
let fatalErrors: string[] = [];

function randomInput() {
  return {
    left: Math.random() < 0.2,
    right: Math.random() < 0.2,
    up: Math.random() < 0.2,
    down: Math.random() < 0.2,
    jump: Math.random() < 0.1,
  };
}

async function connectBot(index: number): Promise<typeof bots[0]> {
  const client = new Client(SERVER_URL);
  const stats: BotStats = {
    sessionId: "",
    messagesReceived: 0,
    messagesSent: 0,
    errors: [],
    disconnects: 0,
    reconnects: 0,
    lastStateUpdate: Date.now(),
    peakPlayersSeen: 0,
    stateUpdateCount: 0,
  };

  const room = await client.joinOrCreate("jumper");
  stats.sessionId = room.sessionId;
  console.log(`[Bot ${index}] joined as ${room.sessionId}`);

  room.onStateChange(() => {
    stats.messagesReceived++;
    stats.stateUpdateCount++;
    stats.lastStateUpdate = Date.now();
    const playerCount = room.state?.players?.size ?? 0;
    if (playerCount > stats.peakPlayersSeen) {
      stats.peakPlayersSeen = playerCount;
    }
  });

  room.onError((code, message) => {
    const err = `[Bot ${index}] error: code=${code} msg=${message}`;
    console.error(err);
    stats.errors.push(err);
  });

  room.onLeave((code) => {
    console.warn(`[Bot ${index}] left room: code=${code}`);
    stats.disconnects++;
  });

  const inputTimer = setInterval(() => {
    try {
      room.send("input", randomInput());
      stats.messagesSent++;
    } catch (e: any) {
      stats.errors.push(`send error: ${e.message}`);
    }
  }, INPUT_INTERVAL_MS);

  return { room, stats, inputTimer };
}

function printStats() {
  const elapsed = ((Date.now() - testStart) / 1000).toFixed(0);
  console.log(`\n=== ${elapsed}s elapsed ===`);
  for (let i = 0; i < bots.length; i++) {
    const b = bots[i];
    const staleSec = ((Date.now() - b.stats.lastStateUpdate) / 1000).toFixed(1);
    const playerCount = b.room.state?.players?.size ?? "?";
    console.log(
      `  Bot ${i}: sid=${b.stats.sessionId.slice(0, 8)} ` +
      `players=${playerCount} peak=${b.stats.peakPlayersSeen} ` +
      `sent=${b.stats.messagesSent} recv=${b.stats.stateUpdateCount} ` +
      `stale=${staleSec}s disconnects=${b.stats.disconnects} errors=${b.stats.errors.length}`
    );
  }
}

async function run() {
  console.log(`Stress test: ${NUM_PLAYERS} players, ${DURATION_SEC}s, server=${SERVER_URL}`);
  testStart = Date.now();

  for (let i = 0; i < NUM_PLAYERS; i++) {
    try {
      const bot = await connectBot(i);
      bots.push(bot);
      await new Promise((r) => setTimeout(r, 500));
    } catch (e: any) {
      const msg = `Failed to connect bot ${i}: ${e.message}`;
      console.error(msg);
      fatalErrors.push(msg);
    }
  }

  if (bots.length === 0) {
    console.error("No bots connected. Aborting.");
    process.exit(1);
  }

  console.log(`\n${bots.length}/${NUM_PLAYERS} bots connected. Running for ${DURATION_SEC}s...\n`);

  const statsTimer = setInterval(printStats, STATS_INTERVAL_MS);

  await new Promise((r) => setTimeout(r, DURATION_MS));

  clearInterval(statsTimer);

  console.log("\n\n========== FINAL REPORT ==========");
  console.log(`Duration: ${DURATION_SEC}s`);
  console.log(`Target players: ${NUM_PLAYERS}`);
  console.log(`Connected: ${bots.length}`);
  console.log(`Fatal errors: ${fatalErrors.length}`);

  let totalErrors = 0;
  let totalDisconnects = 0;
  let anyDesync = false;

  for (let i = 0; i < bots.length; i++) {
    const b = bots[i];
    totalErrors += b.stats.errors.length;
    totalDisconnects += b.stats.disconnects;
    const staleSec = (Date.now() - b.stats.lastStateUpdate) / 1000;
    if (staleSec > 5) anyDesync = true;

    console.log(`\n  Bot ${i} (${b.stats.sessionId}):`);
    console.log(`    Messages sent: ${b.stats.messagesSent}`);
    console.log(`    State updates: ${b.stats.stateUpdateCount}`);
    console.log(`    Peak players seen: ${b.stats.peakPlayersSeen}`);
    console.log(`    Disconnects: ${b.stats.disconnects}`);
    console.log(`    Errors: ${b.stats.errors.length}`);
    if (b.stats.errors.length > 0) {
      b.stats.errors.slice(0, 5).forEach((e) => console.log(`      - ${e}`));
    }
    console.log(`    Last state update: ${staleSec.toFixed(1)}s ago`);
  }

  console.log("\n========== VERDICT ==========");
  const pass = fatalErrors.length === 0 && totalDisconnects === 0 && !anyDesync && bots.length === NUM_PLAYERS;
  console.log(`Result: ${pass ? "PASS" : "FAIL"}`);
  if (fatalErrors.length > 0) console.log(`  - ${fatalErrors.length} fatal connection error(s)`);
  if (totalDisconnects > 0) console.log(`  - ${totalDisconnects} disconnect(s) during session`);
  if (anyDesync) console.log(`  - State desync detected (>5s since last update)`);
  if (bots.length < NUM_PLAYERS) console.log(`  - Only ${bots.length}/${NUM_PLAYERS} bots connected`);

  for (const b of bots) {
    if (b.inputTimer) clearInterval(b.inputTimer);
    try { b.room.leave(); } catch {}
  }

  process.exit(pass ? 0 : 1);
}

run().catch((e) => {
  console.error("Stress test crashed:", e);
  process.exit(1);
});
