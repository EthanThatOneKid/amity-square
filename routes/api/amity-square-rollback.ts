import type { Context } from "hono";
import { readFileSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const VERSIONS_DIR = "/home/workspace/amity-square/versions";

export default async (c: Context) => {
  const { version_id } = await c.req.json<{ version_id: string }>();

  const index = JSON.parse(readFileSync(join(VERSIONS_DIR, "index.json"), "utf8"));
  const target = index.versions.find((v: { id: string }) => v.id === version_id);
  if (!target) {
    return c.json({ ok: false, error: `Version ${version_id} not found` }, 404);
  }

  copyFileSync(
    join(VERSIONS_DIR, target.mask_file),
    "/home/workspace/amity-square/amity-square-walk-mask.png"
  );
  copyFileSync(
    join(VERSIONS_DIR, target.objects_file),
    "/home/workspace/amity-square/amity-square-objects.json"
  );

  return c.json({
    ok: true,
    rolled_back_to: version_id,
    created_at: target.created_at,
    message: `Rolled back to ${version_id}`,
  });
};
