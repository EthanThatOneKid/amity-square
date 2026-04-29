import type { Context } from "hono";
import { writeFileSync, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR      = "/home/workspace/amity-square";
const VERSIONS = join(DIR, "versions");
const MASK_PATH    = join(DIR, "amity-square-walk-mask.png");
const OBJS_PATH    = join(DIR, "amity-square-objects.json");
const INDEX_PATH   = join(VERSIONS, "index.json");

function readIndex() {
  try {
    return JSON.parse(readFileSync(INDEX_PATH, "utf8"));
  } catch {
    return { versions: [] as any[] };
  }
}
function writeIndex(index: { versions: any[] }) {
  if (!existsSync(VERSIONS)) mkdirSync(VERSIONS, { recursive: true });
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

export default async (c: Context) => {
  if (c.req.method !== "POST") return c.json({ error: "POST only" }, 405);

  let body: {
    maskBase64?: string;
    objects?: any[];
  } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const errors: string[] = [];
  const ts = Date.now();

  if (body.maskBase64) {
    try {
      const buf = Buffer.from(body.maskBase64, "base64");
      if (!existsSync(VERSIONS)) mkdirSync(VERSIONS, { recursive: true });

      writeFileSync(MASK_PATH, buf);
      const versionId = `v_${ts}`;
      copyFileSync(MASK_PATH, join(VERSIONS, `${versionId}-mask.png`));

      const index = readIndex();
      index.versions.push({
        id: versionId,
        created_at: ts,
        mask_file: `${versionId}-mask.png`,
        note: "editor publish",
      });
      writeIndex(index);
    } catch (e: any) {
      errors.push(`mask: ${e.message}`);
    }
  }

  if (body.objects !== undefined) {
    try {
      const objectsJson = JSON.stringify(body.objects, null, 2);
      writeFileSync(OBJS_PATH, objectsJson);

      const versionId = `v_${ts}`;
      writeFileSync(join(VERSIONS, `${versionId}-objects.json`), objectsJson);

      const index = readIndex();
      if (!index.versions.at(-1)?.id.startsWith(`v_${ts}`)) {
        index.versions.push({ id: versionId, created_at: ts, objects_file: `${versionId}-objects.json` });
      } else {
        index.versions[index.versions.length - 1].objects_file = `${versionId}-objects.json`;
      }
      writeIndex(index);
    } catch (e: any) {
      errors.push(`objects: ${e.message}`);
    }
  }

  const index = readIndex();
  const current = index.versions.at(-1);

  return c.json({
    ok: errors.length === 0,
    saved: { mask: !!body.maskBase64, objects: body.objects?.length ?? 0 },
    errors: errors.length ? errors : undefined,
    current_version: current?.id,
    total_versions: index.versions.length,
    message: `Published v_${ts} · ${index.versions.length} versions total`,
  });
};
