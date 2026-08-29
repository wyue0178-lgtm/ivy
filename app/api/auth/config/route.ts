import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtime = env as unknown as { TENCENT_CLOUDBASE_ENV_ID?: string };
  return Response.json({
    envId: runtime.TENCENT_CLOUDBASE_ENV_ID?.trim() || "",
    region: "ap-shanghai",
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
