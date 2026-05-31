# Jumper Art Bible

**Version:** 0.1 (draft)
**Last updated:** 2026-05-31

---

## 1. Tone & Mood

**Keywords:** cozy, playful, readable, coop-first

Jumper is a cozy isometric multiplayer playground. The visual language should feel inviting and low-stakes — like a Saturday-morning cartoon rendered in clean geometry. Players jump around a shared world together; the art must stay readable with 5 players on screen, even at small scale.

**Reference lineage:** Crossy Road's clean isometric readability, Monument Valley's palette discipline, Overcooked's warm co-op energy, Fez's tight geometric world.

**Emotional temperature:** warm and approachable. The world should feel like a place you'd want to hang out in, not conquer.

---

## 2. Palette

All colors are final hex values. The palette is intentionally small to enforce consistency.

### Primary (World)

| Role | Hex | Usage |
|------|-----|-------|
| Grass Light | `#5B8C3E` | Primary tile fill (lit face) |
| Grass Dark | `#3D6B2E` | Tile shadow / alternate checker |
| Earth | `#8B6B4A` | Paths, dirt, exposed ground |
| Stone | `#7A7D82` | Platforms, walls, hard surfaces |

### Secondary (Sky & Water)

| Role | Hex | Usage |
|------|-----|-------|
| Sky | `#87CEEB` | Background gradient top |
| Horizon | `#D4E8C2` | Background gradient bottom / fog |
| Water | `#4A90A4` | Ponds, puddles, water tiles |

### Accent (Energy & Feedback)

| Role | Hex | Usage |
|------|-----|-------|
| Warm Glow | `#F2C94C` | Collectibles, positive feedback, highlights |
| Alert | `#EB5757` | Danger, negative feedback |
| Cool Spark | `#56CCF2` | Jump trails, special abilities |

### Player Colors (5-player readability)

Each must pass a contrast check against grass tiles at 32px render size.

| Slot | Hex | Name |
|------|-----|------|
| P1 | `#E85D4A` | Coral Red |
| P2 | `#4A90D9` | Sky Blue |
| P3 | `#F2C94C` | Sunflower |
| P4 | `#6FCF97` | Mint |
| P5 | `#BB6BD9` | Lavender |

Reserve slots (if we expand beyond 5):

| Slot | Hex | Name |
|------|-----|------|
| P6 | `#F2994A` | Tangerine |
| P7 | `#EB5757` | Tomato |
| P8 | `#2D9CDB` | Ocean |

### Neutrals (UI & Chrome)

| Role | Hex | Usage |
|------|-----|-------|
| Panel BG | `#1A1A2E` | UI panels, overlays |
| Text Primary | `#F0F0F0` | Headings, labels |
| Text Secondary | `#A0A0B0` | Help text, hints |
| Shadow | `#000000` @ 30% | Drop shadows, depth cues |

---

## 3. Character Silhouette Rules

Players must be instantly distinguishable at isometric scale (roughly 24-32px tall on a 960x640 canvas with 5 players visible).

### Current phase (procedural)

- **Shape:** Rounded capsule (circle + vertical stretch on jump). This is the v0 placeholder.
- **Outline:** 2px stroke in a darkened variant of the player color (30% darker).
- **Self indicator:** White 3px stroke ring on the local player.
- **Shadow:** Black ellipse at 30% opacity, scaled inversely with jump height.
- **Label:** Player name in monospace, white on `#00000066` pill, positioned above the capsule.

### Target phase (sprite-based, future)

- Characters should be simple, top-heavy silhouettes (large head, small body) — think Crossy Road or Fall Guys proportions.
- Silhouette must read clearly against both grass-light and grass-dark tiles.
- Maximum 4 colors per character (player color + white highlight + dark outline + one accent).
- No fine detail below 2px at render scale.

---

## 4. World Tile Style

### Grid

- **Tile size:** 64x32px isometric (current).
- **Grid:** 50x50 tiles (current). May expand — art should tile seamlessly.

### Tile rendering

- **Checker pattern:** Alternate between Grass Light and Grass Dark for depth.
- **Grid lines:** Subtle, 1px, `#000000` @ 10% opacity. Present during dev; may be removed for final.
- **Edge treatment:** Tiles at world boundary should have a clean vertical face in Earth tone, suggesting a floating island.

### Lighting

- **Light direction:** Top-left (NW), consistent across all assets.
- **No dynamic lighting** in v1. Baked light/shadow implied by tile face colors.
- **Shadow direction:** Bottom-right, matching light source.

### Elevation

- Platforms and raised tiles use Stone color for vertical faces, with a 1-2px highlight on the top-left edge.
- Jump pads or special tiles use Warm Glow tint.

---

## 5. Background & Atmosphere

- **Background:** Vertical gradient from Sky (`#87CEEB`) at top to Horizon (`#D4E8C2`) at bottom.
- **No parallax layers in v1.** The isometric grid is the world.
- **Fog/fade:** Tiles near the world edge may fade toward Horizon color to soften the boundary.
- **Ambient particles (future):** Slow-drifting motes or leaves in Warm Glow at low opacity. Not in v1.

---

## 6. UI Typography & Chrome

### Typography

- **Primary font:** Monospace (system default for now). Target: a rounded monospace or pixel font that matches the cozy tone.
- **Heading size:** 18px
- **Body size:** 14px
- **Label size:** 12px (player names, counters)

### Chrome

- **Panels:** Rounded corners (8px radius), Panel BG fill, 1px border in `#333344`.
- **Buttons:** Warm Glow fill, Panel BG text, 4px padding, 6px radius.
- **Status bar:** Top-left overlay, semi-transparent Panel BG, player count in Mint, room code in Text Secondary.
- **No heavy chrome.** UI should feel like sticky notes on glass — present but not dominant.

---

## 7. Animation Principles

- **Squash & stretch:** Players compress on land, stretch on jump. Already implemented in v0.
- **Timing:** Snappy inputs, soft landings. Jump should feel responsive (fast up, slight hang, medium down).
- **Loop discipline:** Idle animations (future) must loop seamlessly with no visible seam.
- **Frame budget:** 4-8 frames for simple loops (idle, bounce). 6-12 for complex actions (jump arc, land).

---

## 8. Asset Naming & Format

- **Filenames:** `kebab-case-lowercase.png`
- **Format:** PNG with alpha channel. No JPEG for game assets.
- **Organization:**
  - `client/public/assets/characters/` — player sprites
  - `client/public/assets/tiles/` — world tiles
  - `client/public/assets/ui/` — interface elements
  - `client/public/assets/fx/` — particles, trails
  - `docs/art/` — reference images, mood boards, style guides (not shipped)

---

## 9. What This Bible Does NOT Cover Yet

- Specific character designs (pending gameplay identity decisions)
- Sound design (separate doc)
- Tile atlas layout (pending when we move to sprite-based tiles)
- Biome variations (pending world design)

These will be added as the project evolves. This draft establishes the foundational visual language.
