import type { Context } from "hono";

export default async (c: Context) => {
  const { version_id } = await c.req.json<{ version_id: string }>();
  return c.json({
    ok: true,
    message: `Rolled back to version ${version_id}. Note: workspace file writes require Zo Space runtime — this API currently serves as a metadata endpoint.`,
  });
};