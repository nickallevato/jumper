import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

export class PlayerState extends Schema {
  id: string = "";
  x: number = 0;
  y: number = 0;
  z: number = 0;
  isJumping: boolean = false;
  skin: string = "default";
  color: number = 0xffffff;
  name: string = "";
  velZ: number = 0;
  jumpCooldown: number = 0;
}
defineTypes(PlayerState, {
  id: "string",
  x: "number",
  y: "number",
  z: "number",
  isJumping: "boolean",
  skin: "string",
  color: "number",
  name: "string",
  velZ: "number",
  jumpCooldown: "number",
});

export class JumperRoomState extends Schema {
  players = new MapSchema<PlayerState>();
}
defineTypes(JumperRoomState, {
  players: { map: PlayerState },
});
