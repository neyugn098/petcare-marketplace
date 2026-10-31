import Link from "next/link";
import { getCurrentActor } from "../auth";
import { getDatabase } from "../../db/client";
import { formatVnd } from "../format";
export const dynamic = "force-dynamic";
export default async function OwnerPage() {
  const actor = await getCurrentActor();
  const owner = process.env.PETCARE_OWNER_EMAIL?.trim().toLowerCase();
  if (!owner || !actor || actor.email !== owner) return <main className="section-wrap account-gate"><h1>Khu vực chủ shop</h1><p>Chỉ tài khoản chủ shop được cấu hình mới xem được lịch sử giao dịch. Tài khoản khách hàng không có quyền truy cập.</p><Link className="primary-button" href="/login">Đăng nhập</Link><Link className="text-button" href="/">Về trang chủ</Link></main>;
  const db = getDatabase();
  const rows = (await db.prepare("SELECT id,amount,transaction_date,displayed_time,description,classification FROM owner_payment_history ORDER BY source_reference").all()).results as Array<{id:string;amount:number;transaction_date:string|null;displayed_time:string;description:string;classification:string}>;
  const incoming = rows.filter(r=>r.amount>0).reduce((n,r)=>n+r.amount,0);
  const outgoing = rows.filter(r=>r.amount<0).reduce((n,r)=>n-r.amount,0);
  return <main className="section-wrap owner-history"><Link href="/">← PetCare</Link><h1>Lịch sử giao dịch nhập từ chứng từ</h1><p>Chỉ chủ shop xem. Đây là dữ liệu chép từ ảnh, chưa được xác minh qua ngân hàng; không gán vào đơn hàng hay tài khoản khách hàng. Ngày không có trong chứng từ được để trống.</p><div className="owner-totals"><b>Tiền vào: {formatVnd(incoming)}</b><b>Tiền ra: {formatVnd(outgoing)}</b><b>Chênh lệch: {formatVnd(incoming-outgoing)}</b></div><div className="owner-history-table"><table><thead><tr><th>Ngày</th><th>Giờ</th><th>Số tiền</th><th>Nội dung</th><th>Phân loại</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.transaction_date || "Chưa xác định"}</td><td>{r.displayed_time}</td><td>{r.amount>0?"+":""}{formatVnd(r.amount)}</td><td>{r.description}</td><td>{r.classification==='petcare_receipt'?"Nội dung Pet care":r.classification==='outgoing'?"Tiền chuyển đi":"Tiền vào — chưa rõ mục đích"}</td></tr>)}</tbody></table></div><p>Không công khai số dư, số tài khoản hoặc ảnh chứng từ.</p></main>;
}
