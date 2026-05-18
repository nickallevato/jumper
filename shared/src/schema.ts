import { Schema, MapSchema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") z: number = 0;
  @type("boolean") isJumping: boolean = false;
  @type("string") skin: string = "default";
  @type("number") color: number = 0xffffff;
  @type("string") name: string = "";
  @type("number") velZ: number = 0;
  @type("number") jumpCooldown: number = 0;
}

export class JumperRoomState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
