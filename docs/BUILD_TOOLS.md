# Build Tools Usage

This project ships a lightweight room editor scaffold and keeps room data in the
canonical shared room catalog. Use the editor for placement work, export the
catalog JSON, and load authored rooms through `data/authored-rooms.json` when you
want to play them without hand-editing source code.

## Quick Start

1. Start the app locally:

   ```sh
   npm run dev:server
   npm run dev:client
   ```

2. Open the room editor:

   ```sh
   npm run dev:room-editor
   ```

3. Place room objects in the editor. It imports from `shared/roomCatalog.js` and
   exports the shared room catalog snapshot shape:
   `{ schemaVersion, rooms }`.
4. Save exported authored rooms to `data/authored-rooms.json`. To try the sample
   room first:

   ```sh
   cp data/authored-rooms.example.json data/authored-rooms.json
   ```

5. Use `client/src/maps.js` and `shared/constants.js` as runtime adapters; both
   derive room data from the catalog.
6. Run the focused checks:

   ```sh
   npm run build
   npm test
   ```

7. Open the Vite URL with the room id and walk the authored room:

   ```text
   http://localhost:5173/?room=studio_test_room
   ```

## Level Editor

Use `npm run dev:room-editor` to place visible level geometry, then export the
catalog JSON to `data/authored-rooms.json` for local play.

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
entry too. The editor writes wall placement into each room's `wallTiles` list,
and `shared/constants.js` derives authoritative collision from that list.

## Room Designer

Use the canonical room snapshot in `data/authored-rooms.json`. The room editor can
place spawn points, wall tiles, platforms, hidden platforms, and portals. Hold
Shift while clicking an existing placed object to inspect it, and use right-drag
to pan the canvas.

To add a room:

1. Add a `rooms.<room_id>` entry with `id`, `name`, `grid`,
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

## Launching Authored Rooms

At server start, Jumper loads `data/authored-rooms.json` when it exists. Set
`ROOM_CATALOG_PATH=/path/to/catalog.json` to load a different snapshot. The client
fetches `/api/rooms/catalog` before entering `WorldScene`, registers the merged
catalog, and starts the room from the `room` URL parameter:

```text
http://localhost:5173/?room=<room_id>
```

This uses the same Socket.IO `join:room` path as built-in rooms. If the room id
is missing from the loaded catalog, the shared catalog fallback still resolves to
`overworld`.
