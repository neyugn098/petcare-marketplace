import { ensureDatabase, getD1 } from "../../../../db/runtime";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!/^[a-zA-Z0-9-]{10,120}$/.test(token)) return Response.json({ error: "QR không hợp lệ" }, { status: 400 });
    const db = getD1();
    await ensureDatabase(db);
    const pet = await db.prepare(`SELECT id,name,species,breed,sex,date_of_birth,weight_kg,blood_type,microchip,allergies,avatar,updated_at FROM pets WHERE qr_token = ? LIMIT 1`).bind(token).first<Record<string, unknown>>();
    if (!pet) return Response.json({ error: "Hồ sơ không tồn tại hoặc QR đã được thu hồi" }, { status: 404 });
    const vaccinations = await db.prepare(`SELECT vaccine_name,administered_at,next_due_at,status,provider_name FROM vaccinations WHERE pet_id = ? ORDER BY administered_at DESC LIMIT 8`).bind(String(pet.id)).all();
    const microchip = String(pet.microchip ?? "");
    return Response.json({ pet: { ...pet, microchip: microchip ? `•••• •••• ${microchip.slice(-4)}` : null }, vaccinations: vaccinations.results }, { headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) {
    console.error("public_pet_card_failed", error);
    return Response.json({ error: "Không thể mở hồ sơ lúc này" }, { status: 500 });
  }
}
