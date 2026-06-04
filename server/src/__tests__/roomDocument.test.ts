import { describe, expect, it } from "vitest";
import { createDefaultRoomDocument, validateRoomDocument, type RoomDocument } from "@jumper/shared";

describe("room document validation", () => {
  it("accepts the default room document", () => {
    expect(validateRoomDocument(createDefaultRoomDocument()).ok).toBe(true);
  });

  it("blocks export when spawn is outside bounds or not solid", () => {
    const room = createDefaultRoomDocument();
    room.spawn = { x: 99, y: 25 };
    expect(validateRoomDocument(room).errors).toContain("spawn must be within bounds");

    const floatingSpawn: RoomDocument = {
      ...createDefaultRoomDocument(),
      platforms: [],
      tiles: [{ x: 1, y: 1, solid: true }],
      spawn: { x: 2, y: 2 },
    };
    expect(validateRoomDocument(floatingSpawn).errors).toContain("spawn must land on a solid tile or platform");
  });

  it("requires portals and portal targets to resolve onto solid ground", () => {
    const unresolved: RoomDocument = {
      ...createDefaultRoomDocument(),
      portals: [{ id: "a", x: 4, y: 4, targetPortalId: "missing" }],
    };
    expect(validateRoomDocument(unresolved).errors).toContain("portals[0] targetPortalId must resolve within the room or include targetRoomId");

    const badTarget: RoomDocument = {
      ...createDefaultRoomDocument(),
      platforms: [{ id: "island", x: 0, y: 0, width: 2, height: 2, solid: true }],
      spawn: { x: 1, y: 1 },
      portals: [{ id: "a", x: 1, y: 1, targetX: 3, targetY: 3 }],
    };
    expect(validateRoomDocument(badTarget).errors).toContain("portals[0] target must land on a solid tile or platform");
  });

  it("rejects duplicate or unsupported walls", () => {
    const room: RoomDocument = {
      ...createDefaultRoomDocument(),
      walls: [
        { x: 1, y: 1, edge: "north" },
        { x: 1, y: 1, edge: "north" },
      ],
    };
    expect(validateRoomDocument(room).errors).toContain("walls[1] duplicates another wall");

    const floatingWall: RoomDocument = {
      ...createDefaultRoomDocument(),
      platforms: [],
      spawn: { x: 1, y: 1 },
      tiles: [{ x: 1, y: 1, solid: true }],
      walls: [{ x: 3, y: 3, edge: "south" }],
    };
    expect(validateRoomDocument(floatingWall).errors).toContain("walls[0] must border at least one solid tile or platform");
  });
});
