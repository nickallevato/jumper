# SMA-326 Browser QA Plan

## Setup

1. Build the production client:

   ```sh
   npm run build
   ```

2. Start the server with an authored room snapshot:

   ```sh
   ROOM_CATALOG_PATH=data/authored-rooms.example.json DB_PATH=/tmp/jumper-sma326.db PORT=4302 npm start
   ```

3. Open the authored room directly:

   ```text
   http://localhost:4302/?room=studio_test_room
   ```

## Expected Result

- The page loads without console errors.
- The player joins `studio_test_room` through the normal `join:room` Socket.IO path.
- The spawn position is the authored room spawn from the snapshot: `tx=2`, `ty=4`.
- The room background, grid, and platforms match `data/authored-rooms.example.json`.
- Moving around the room respects the authored `contentBounds` and wall/collision data.

## Runtime Smoke Performed

- Started production server with `ROOM_CATALOG_PATH=data/authored-rooms.example.json`.
- Server log reported `authoredRooms: 1`.
- `GET /api/rooms/catalog` returned `schemaVersion: 1` and included `studio_test_room`.
- `GET /?room=studio_test_room` returned HTTP 200.
