import { ensureDatabase, getD1 } from "../../../../db/runtime";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!/^petcare-[a-zA-Z0-9-]{8,100}$/.test(token)) return Response.json({ error: "QR không hợp lệ" }, { status: 400 });
    const db = getD1();
    await ensureDatabase(db);
    const pet = await db.prepare(`SELECT id,name,species,breed,sex,weight_kg,blood_type,microchip,allergies,avatar,updated_at FROM pets WHERE qr_token = ? LIMIT 1`).bind(token).first<Record<string, unknown>>();
    if (!pet) return Response.json({ error: "Hồ sơ không tồn tại hoặc QR đã được thu hồi" }, { status: 404 });
    const vaccinations = await db.prepare(`SELECT vaccine_name,administered_at,next_due_at,status,provider_name FROM vaccinations WHERE pet_id = ? ORDER BY administered_at DESC LIMIT 8`).bind(String(pet.id)).all();
    const microchip = String(pet.microchip ?? "");
    const publicPet = {
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      sex: pet.sex,
      weight_kg: pet.weight_kg,
      blood_type: pet.blood_type,
      microchip: microchip ? `•••• •••• ${microchip.slice(-4)}` : null,
      allergies: pet.allergies,
      avatar: pet.avatar,
      updated_at: pet.updated_at,
    };
    return Response.json({ pet: publicPet, vaccinations: vaccinations.results }, { headers: { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow", "Vary": "Accept-Encoding" } });
  } catch (error) {
    console.error("public_pet_card_failed", error);
    return Response.json({ error: "Không thể mở hồ sơ lúc này" }, { status: 500 });
  }
}
