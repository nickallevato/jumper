// Cosmetic catalog — the single source of truth for both the DB seed (server/db.js)
// and rendering (client Player/RemotePlayer). Array order defines the DB id (id = index + 1),
// so this list must stay append-only to keep ids stable.
//
// `unlock` is the secret_id or area_id that grants the look. `body`/`head` are fill colors;
// `accent` (nullable) draws a small marker above the head to signal a rarer unlock.
export const COSMETICS = [
  { name: 'default',      unlock: 'none',                 body: 0x89b4fa, head: 0xcdd6f4, accent: null },
  { name: 'sky_blue',     unlock: 'dungeon_sky',          body: 0x74c7ec, head: 0xbac2de, accent: null },
  { name: 'deep_crimson', unlock: 'dungeon_deep',         body: 0xe64553, head: 0xeba0ac, accent: null },
  { name: 'ghost_white',  unlock: 'secret_wall_crack',    body: 0xe6e9ef, head: 0xffffff, accent: 0xbac2de },
  { name: 'wall_jumper',  unlock: 'secret_wall_kick',     body: 0xfab387, head: 0xffd9a0, accent: 0xe67e22 },
  { name: 'spring_step',  unlock: 'secret_head_bounce',   body: 0xa6e3a1, head: 0xcfeecc, accent: 0x40a02b },
  { name: 'pogo_master',  unlock: 'secret_pogo',          body: 0xf9e2af, head: 0xfdf0c8, accent: 0xdba90a },
  { name: 'counterweight',unlock: 'secret_counterweight', body: 0x9399b2, head: 0xc7cbe0, accent: 0x4c4f69 },
  { name: 'locksmith',    unlock: 'secret_locksmith',     body: 0xeed49f, head: 0xfaf3dd, accent: 0xb5651d },
  { name: 'illuminated',  unlock: 'secret_illuminated',   body: 0xf2cdcd, head: 0xfff2cc, accent: 0xffd43b },
  { name: 'bell_ringer',  unlock: 'secret_bell',          body: 0xd4a017, head: 0xffe08a, accent: 0x8a5a00 },
]

// 1-based id → cosmetic (falls back to default).
export function cosmeticById(id) {
  return COSMETICS[(id ?? 1) - 1] ?? COSMETICS[0]
}

// secret_id / area_id → 1-based cosmetic id, or null if nothing matches.
export function cosmeticIdForUnlock(unlock) {
  const idx = COSMETICS.findIndex(c => c.unlock === unlock)
  return idx === -1 ? null : idx + 1
}
