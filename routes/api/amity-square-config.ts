import type { Context } from "hono";
import { readFileSync } from "node:fs";

const CONFIG_PATH = "/home/workspace/amity-square/versions/index.json";

export default async (c: Context) => {
  let current = { version: "v_unknown", created_at: 0, objects_file: "" };
  try {
    const index = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    current = index.versions?.[index.versions.length - 1] ?? current;
  } catch { /* not ready yet */ }

  const CONFIG = {
    version: "v2",
    map: {
      w: 1006,
      h: 774,
      tile: 16,
      gridCols: 63,
      gridRows: 49,
    },
    assets: {
      map:     "/images/amity-square/amity-square-map.png",
      mask:    "/images/amity-square/amity-square-walk-mask.png",
      objects: "/amity-square-objects.json",
    },
    current,
    versionsUrl: "/api/amity-square-versions",
    publishUrl:  "/api/amity-square-publish",
    objectTypes: {
      pikachu:  { name: "Pikachu",   sprite: "pikachu",  color: "#FFD000" },
      npc:      { name: "NPC",        sprite: "npc",      color: "#22AA22" },
      sign:     { name: "Sign",       sprite: "sign",      color: "#8B4513" },
      pokeball: { name: "Pokéball",   sprite: "pokeball", color: "#CC0000" },
    },
  };
  return c.json(CONFIG);
};
