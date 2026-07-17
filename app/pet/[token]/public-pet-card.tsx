"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatVietnamDate } from "../../format";

type PublicData = { pet: { name: string; species: string; breed: string; sex: string; date_of_birth: string; weight_kg: number; blood_type: string | null; microchip: string | null; allergies: string; avatar: string; updated_at: string }; vaccinations: Array<{ vaccine_name: string; administered_at: string; next_due_at: string | null; status: string; provider_name: string }> };

export default function PublicPetCard({ token }: { token: string }) {
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void fetch(`/api/pet/${encodeURIComponent(token)}`, { cache: "no-store" }).then(async (response) => { const body = await response.json() as PublicData & { error?: string }; if (!response.ok) throw new Error(body.error ?? "Không thể mở hồ sơ"); setData(body); }).catch((caught) => setError(caught instanceof Error ? caught.message : "Không thể mở hồ sơ")); }, [token]);
  if (error) return <main className="public-pet-page"><section className="public-pet-error"><span>🔒</span><h1>Không mở được hồ sơ</h1><p>{error}</p><Link href="/">Về PetCare</Link></section></main>;
  if (!data) return <main className="public-pet-page"><div className="public-card-loading">Đang mở thẻ an toàn...</div></main>;
  const pet = data.pet;
  return <main className="public-pet-page"><section className="public-pet-card"><header><Link className="partner-brand" href="/"><span>P</span><b>PetCare</b></Link><i>THẺ AN TOÀN</i></header><div className="public-pet-hero"><div>{pet.avatar}</div><span><em>✓ Hồ sơ đã xác minh</em><h1>Xin chào, mình là {pet.name}!</h1><p>{pet.breed} · {pet.sex} · {pet.weight_kg} kg</p></span></div><div className="public-alert"><span>!</span><div><b>Lưu ý dị ứng</b><p>{pet.allergies || "Không ghi nhận dị ứng"}</p></div></div><dl><div><dt>Nhóm máu</dt><dd>{pet.blood_type ?? "Chưa cập nhật"}</dd></div><div><dt>Microchip</dt><dd>{pet.microchip ?? "Chưa có"}</dd></div><div><dt>Loài</dt><dd>{pet.species}</dd></div></dl><section><div className="public-section-head"><h2>Tiêm phòng gần đây</h2><span>✓ Từ cơ sở thú y</span></div>{data.vaccinations.map((item) => <article key={`${item.vaccine_name}-${item.administered_at}`}><i className={item.status}>✓</i><div><b>{item.vaccine_name}</b><small>{item.provider_name}</small></div><span><b>{formatVietnamDate(item.administered_at)}</b><small>{item.status === "completed" ? "Đã tiêm" : "Sắp đến hạn"}</small></span></article>)}</section><button className="public-contact" onClick={() => window.alert("PetCare sẽ gửi thông báo bảo mật cho chủ nuôi. Tính năng SMS có thể kết nối ở bước vận hành.")}>♡ Báo cho chủ nuôi rằng bạn đã tìm thấy bé</button><footer><span>🔒 Thẻ này không hiển thị thông tin liên hệ hay ghi chú riêng tư.</span><small>Cập nhật {formatVietnamDate(pet.updated_at)}</small></footer></section></main>;
}
