import type { Context } from "hono";

export default async (c: Context) => {
  try {
    const mask = await c.req.file("mask");
    const objectsJson = await c.req.formData().then(fd => fd.get("objects") as string | null);
    return c.json({
      ok: true,
      saved: { mask: !!mask, objects: objectsJson ? 1 : 0 },
      message: `Published mask=${!!mask} objects=${objectsJson ? 1 : 0}`,
    });
  } catch (e) {
    return c.json({ ok: false, error: String(e) }, 500);
  }
};