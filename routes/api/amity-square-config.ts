import type { Context } from "hono";

type ObjectType = { name: string; sprite: string; color: string };

const CONFIG = {
  version: "2",
  map: { w: 1006, h: 774, tile: 16, gridCols: 63, gridRows: 49 },
  assets: {
    map: "/images/amity-square/amity-square-map.png",
    mask: "/images/amity-square/amity-square-walk-mask.png",
    objects: "/amity-square-objs.json",
  },
  objectTypes: {
    npc: { name: "NPC", sprite: "", color: "#4A90D9" },
    trainer: { name: "Trainer", sprite: "", color: "#9B59B6" },
    sign: { name: "Sign", sprite: "", color: "#27AE60" },
    item: { name: "Item", sprite: "", color: "#F1C40F" },
  } as Record<string, ObjectType>,
};

export default (c: Context) => c.json(CONFIG);