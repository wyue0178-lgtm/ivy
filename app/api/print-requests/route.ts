import { env } from "cloudflare:workers";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 10 * 1024 * 1024;

function clean(value: FormDataEntryValue | null, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const customerName = clean(form.get("name"), 80);
    const contact = clean(form.get("contact"), 120);
    const desiredSize = clean(form.get("size"), 60) || "还不确定";
    const notes = clean(form.get("notes"), 500);

    if (!customerName || !contact) {
      return Response.json({ error: "请填写称呼与联系方式。" }, { status: 400 });
    }
    if (!(image instanceof File) || !allowedTypes.has(image.type)) {
      return Response.json({ error: "请上传 JPG、PNG 或 WEBP 图片。" }, { status: 400 });
    }
    if (image.size > maxBytes) {
      return Response.json({ error: "图片请控制在 10 MB 以内。" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const extension = image.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
    const imageKey = `print-requests/${id}/inspiration.${extension}`;

    await env.UPLOADS.put(imageKey, image.stream(), {
      httpMetadata: { contentType: image.type },
      customMetadata: { originalName: image.name.slice(0, 180), requestId: id },
    });

    const db = env.DB;
    await db.prepare(`CREATE TABLE IF NOT EXISTS print_requests (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      contact TEXT NOT NULL,
      desired_size TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      image_key TEXT NOT NULL,
      image_name TEXT NOT NULL,
      image_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();
    await db.prepare(`INSERT INTO print_requests
      (id, customer_name, contact, desired_size, notes, image_key, image_name, image_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, customerName, contact, desiredSize, notes, imageKey, image.name.slice(0, 180), image.type)
      .run();

    return Response.json({ requestId: id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("print request failed", message);
    return Response.json({ error: "暂时没能收到，请稍后再试。" }, { status: 500 });
  }
}
