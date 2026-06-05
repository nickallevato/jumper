# Build Tools Usage

This project does not currently ship a separate visual Level Editor or Room Designer
app. Room authoring happens in code through the canonical shared room catalog. Treat
the files below as the build tools until a visual editor exists.

## Quick Start

1. Start the app locally:

   ```sh
   npm run dev:server
   npm run dev:client
   ```

2. Edit room content in `shared/roomCatalog.js`.
3. Use `client/src/maps.js` and `shared/constants.js` as runtime adapters; both
   derive room data from the catalog.
4. Run the focused checks:

   ```sh
   npm run build
   npm test
   ```

5. Open the Vite URL printed by `npm run dev:client` and walk the edited room.

## Level Editor

Use `shared/roomCatalog.js` to author the visible level geometry.

- Tile grids are arrays of rows. Coordinates are `tx, ty`, with `tx` increasing
  left-to-right and `ty` increasing top-to-bottom.
- Tile values are:
  - `1`: ground
  - `2`: wall
  - `3`: water, currently walkable but rendered differently
- Platforms are `{ tx, ty, tz }`. `tz` is height above the base tile plane.
- Hidden platforms use the same shape and live in a room's `hidden` list. They
  are only visible and solid when the player's item effect reveals hidden content.
- `bg` controls the room background color.
- `follow: true` enables camera follow for rooms larger or taller than one screen.

When changing a wall tile that should affect movement, update the matching wall
set in `shared/constants.js` too. The server uses that data to clamp authoritative
movement, so client-only wall edits can create prediction corrections.

## Room Designer

Use the canonical room registry in `shared/roomCatalog.js`.

To add a room:

1. Add a `ROOM_CATALOG.<room_id>` entry with `id`, `name`, `grid`,
   `contentBounds`, `platforms`, `spawn`, `bg`, and optional `portals`,
   `wallTiles`, `hidden`, `follow`, or room-specific interaction data.
2. Add portal entries in the room's `portals` list for both directions if it should
   be reachable and returnable.
3. Add wall collision coordinates to `wallTiles` when the room contains blocking
   interior walls. `shared/constants.js` derives authoritative collision from this.
4. Add locked door geometry in `shared/doors.js` when a wall tile can be opened
   with a key.
5. Add secrets or unlock triggers in `server/secrets.js` when the room contains
   discoverable actions.

Room ids are plain strings such as `overworld`, `dungeon_grove`, or
`dungeon_library`. Keep ids stable after release because profiles, unlocks, and
telemetry can refer to them.

## Coordinate Checklist

Before committing a room edit, check these points:

- `contentBounds` keeps players inside the intended playable area.
- `spawn` lands on a passable tile and inside `contentBounds`.
- Each portal source tile and landing tile are passable.
- Any locked door tile starts as a wall in the grid and is listed in
  `shared/doors.js`.
- Any server-blocking wall is present in `ROOM_WALL_TILES`.
- Platform `tz` values fit within the room's `maxZ`.
- Tall or expanded rooms use `follow: true` if the player needs camera tracking.

## Verification

For layout-only documentation or data changes, `npm run build` is the smallest
check that proves the client imports still resolve. For gameplay-affecting room
changes, also run `npm test` and manually verify the room in a browser.
