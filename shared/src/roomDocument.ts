export type CardinalDirection = "north" | "east" | "south" | "west";

export interface RoomBounds {
  width: number;
  height: number;
}

export interface RoomPoint {
  x: number;
  y: number;
  z?: number;
}

export interface RoomTile extends RoomPoint {
  solid?: boolean;
}

export interface RoomPlatform extends RoomPoint {
  id?: string;
  width: number;
  height: number;
  solid?: boolean;
}

export interface RoomWall {
  x: number;
  y: number;
  edge: CardinalDirection;
}

export interface RoomPortal extends RoomPoint {
  id: string;
  targetRoomId?: string;
  targetPortalId?: string;
  targetX?: number;
  targetY?: number;
}

export interface RoomDocument {
  id: string;
  version: number;
  bounds: RoomBounds;
  spawn: RoomPoint;
  tiles?: RoomTile[];
  platforms?: RoomPlatform[];
  walls?: RoomWall[];
  portals?: RoomPortal[];
  [key: string]: unknown;
}

export interface RoomValidationResult {
  ok: boolean;
  errors: string[];
}

const DIRECTIONS: CardinalDirection[] = ["north", "east", "south", "west"];

export function createDefaultRoomDocument(id = "dev-room"): RoomDocument {
  return {
    id,
    version: 1,
    bounds: { width: 50, height: 50 },
    spawn: { x: 25, y: 25, z: 0 },
    platforms: [{ id: "ground", x: 0, y: 0, z: 0, width: 50, height: 50, solid: true }],
    walls: [],
    portals: [],
  };
}

export function cloneRoomDocument(room: RoomDocument): RoomDocument {
  return JSON.parse(JSON.stringify(room)) as RoomDocument;
}

export function validateRoomDocument(value: unknown): RoomValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ["room must be a JSON object"] };

  const room = value as Partial<RoomDocument>;
  if (typeof room.id !== "string" || room.id.trim().length === 0) errors.push("id is required");
  if (typeof room.version !== "number" || !Number.isInteger(room.version) || room.version < 1) {
    errors.push("version must be a positive integer");
  }
  if (!isBounds(room.bounds)) {
    errors.push("bounds.width and bounds.height must be positive integers");
  }

  const bounds = isBounds(room.bounds) ? room.bounds : undefined;
  const tiles = Array.isArray(room.tiles) ? room.tiles : [];
  const platforms = Array.isArray(room.platforms) ? room.platforms : [];
  const walls = Array.isArray(room.walls) ? room.walls : [];
  const portals = Array.isArray(room.portals) ? room.portals : [];

  if (room.tiles !== undefined && !Array.isArray(room.tiles)) errors.push("tiles must be an array when present");
  if (room.platforms !== undefined && !Array.isArray(room.platforms)) errors.push("platforms must be an array when present");
  if (room.walls !== undefined && !Array.isArray(room.walls)) errors.push("walls must be an array when present");
  if (room.portals !== undefined && !Array.isArray(room.portals)) errors.push("portals must be an array when present");

  if (!isPoint(room.spawn)) {
    errors.push("spawn.x and spawn.y must be numbers");
  } else if (bounds) {
    validatePointBounds(room.spawn, bounds, "spawn", errors);
    if (!isSolid(room.spawn.x, room.spawn.y, tiles, platforms, bounds)) {
      errors.push("spawn must land on a solid tile or platform");
    }
  }

  validateTiles(tiles, bounds, errors);
  validatePlatforms(platforms, bounds, errors);
  validateWalls(walls, tiles, platforms, bounds, errors);
  validatePortals(portals, tiles, platforms, bounds, errors);

  return { ok: errors.length === 0, errors };
}

function validateTiles(tiles: unknown[], bounds: RoomBounds | undefined, errors: string[]): void {
  tiles.forEach((tile, index) => {
    if (!isPoint(tile)) {
      errors.push(`tiles[${index}] must include numeric x and y`);
      return;
    }
    if (bounds) validatePointBounds(tile, bounds, `tiles[${index}]`, errors);
  });
}

function validatePlatforms(platforms: unknown[], bounds: RoomBounds | undefined, errors: string[]): void {
  platforms.forEach((platform, index) => {
    if (!isPlatform(platform)) {
      errors.push(`platforms[${index}] must include x, y, width, and height`);
      return;
    }
    if (!bounds) return;
    validatePointBounds(platform, bounds, `platforms[${index}]`, errors);
    if (platform.x + platform.width > bounds.width || platform.y + platform.height > bounds.height) {
      errors.push(`platforms[${index}] must fit within bounds`);
    }
  });
}

function validateWalls(
  walls: unknown[],
  tiles: unknown[],
  platforms: unknown[],
  bounds: RoomBounds | undefined,
  errors: string[],
): void {
  const seen = new Set<string>();
  walls.forEach((wall, index) => {
    if (!isWall(wall)) {
      errors.push(`walls[${index}] must include integer x, integer y, and a cardinal edge`);
      return;
    }
    if (!bounds) return;
    validatePointBounds(wall, bounds, `walls[${index}]`, errors);
    const key = `${wall.x}:${wall.y}:${wall.edge}`;
    if (seen.has(key)) errors.push(`walls[${index}] duplicates another wall`);
    seen.add(key);
    const neighbor = wallNeighbor(wall.x, wall.y, wall.edge as CardinalDirection);
    const insideNeighbor = isWithinBounds(neighbor.x, neighbor.y, bounds);
    if (!isSolid(wall.x, wall.y, tiles, platforms, bounds) && (!insideNeighbor || !isSolid(neighbor.x, neighbor.y, tiles, platforms, bounds))) {
      errors.push(`walls[${index}] must border at least one solid tile or platform`);
    }
  });
}

function validatePortals(
  portals: unknown[],
  tiles: unknown[],
  platforms: unknown[],
  bounds: RoomBounds | undefined,
  errors: string[],
): void {
  const ids = new Set(
    portals
      .filter((portal): portal is RoomPortal => isPortal(portal))
      .map((portal) => portal.id),
  );
  const seen = new Set<string>();
  portals.forEach((portal, index) => {
    if (!isPortal(portal)) {
      errors.push(`portals[${index}] must include id, x, and y`);
      return;
    }
    if (seen.has(portal.id)) errors.push(`portals[${index}] duplicates another portal id`);
    seen.add(portal.id);
    if (!bounds) return;
    validatePointBounds(portal, bounds, `portals[${index}]`, errors);
    if (!isSolid(portal.x, portal.y, tiles, platforms, bounds)) {
      errors.push(`portals[${index}] must stand on a solid tile or platform`);
    }
    const targetX = typeof portal.targetX === "number" ? portal.targetX : undefined;
    const targetY = typeof portal.targetY === "number" ? portal.targetY : undefined;
    if (portal.targetRoomId === undefined && portal.targetPortalId !== undefined && !ids.has(portal.targetPortalId)) {
      errors.push(`portals[${index}] targetPortalId must resolve within the room or include targetRoomId`);
    }
    if ((targetX === undefined) !== (targetY === undefined)) {
      errors.push(`portals[${index}] targetX and targetY must be provided together`);
    }
    if (targetX !== undefined && targetY !== undefined) {
      validatePointBounds({ x: targetX, y: targetY }, bounds, `portals[${index}] target`, errors);
      if (!isSolid(targetX, targetY, tiles, platforms, bounds)) {
        errors.push(`portals[${index}] target must land on a solid tile or platform`);
      }
    }
  });
}

function isBounds(value: unknown): value is RoomBounds {
  return isRecord(value) && isPositiveInt(value.width) && isPositiveInt(value.height);
}

function isPoint(value: unknown): value is RoomPoint {
  return isRecord(value) && typeof value.x === "number" && Number.isFinite(value.x) && typeof value.y === "number" && Number.isFinite(value.y);
}

function isPlatform(value: unknown): value is RoomPlatform {
  return isRecord(value) && isPoint(value) && isPositiveInt(value.width) && isPositiveInt(value.height);
}

function isPortal(value: unknown): value is RoomPortal {
  return isRecord(value) && isPoint(value) && typeof value.id === "string" && value.id.trim().length > 0;
}

function isWall(value: unknown): value is RoomWall {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    Number.isInteger(value.x) &&
    typeof value.y === "number" &&
    Number.isInteger(value.y) &&
    DIRECTIONS.includes(value.edge as CardinalDirection)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function validatePointBounds(point: RoomPoint, bounds: RoomBounds, label: string, errors: string[]): void {
  if (!isWithinBounds(point.x, point.y, bounds)) errors.push(`${label} must be within bounds`);
}

function isWithinBounds(x: number, y: number, bounds: RoomBounds): boolean {
  return x >= 0 && y >= 0 && x < bounds.width && y < bounds.height;
}

function isSolid(
  x: number,
  y: number,
  tiles: unknown[],
  platforms: unknown[],
  bounds: RoomBounds,
): boolean {
  if (!isWithinBounds(x, y, bounds)) return false;
  if (tiles.some((tile) => isPoint(tile) && tile.x === x && tile.y === y && (tile as RoomTile).solid !== false)) return true;
  return platforms.some((platform) => (
    isPlatform(platform) &&
    platform.solid !== false &&
    x >= platform.x &&
    y >= platform.y &&
    x < platform.x + platform.width &&
    y < platform.y + platform.height
  ));
}

function wallNeighbor(x: number, y: number, edge: CardinalDirection): RoomPoint {
  switch (edge) {
    case "north": return { x, y: y - 1 };
    case "east": return { x: x + 1, y };
    case "south": return { x, y: y + 1 };
    case "west": return { x: x - 1, y };
  }
}
