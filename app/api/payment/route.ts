import { resolveActor, getDatabase } from "../../../db/runtime";
import { paymentDetails } from "../../../lib/payment";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const actor = await resolveActor(request);
  if (!actor) return Response.json({ error: "Vui lòng đăng nhập" }, { status: 401, headers });
  const id = new URL(request.url).searchParams.get("order");
  const order = await getDatabase().prepare("SELECT partner_id,order_code,total_amount,status FROM orders WHERE id=$1 AND owner_email=$2").bind(id, actor.email).first<{partner_id:string;order_code:string;total_amount:number;status:string}>();
  if (!order) return Response.json({ error: "Không tìm thấy đơn hàng" }, { status:404, headers });
  const bank = paymentDetails(order.partner_id);
  return Response.json({ bank, orderCode: order.order_code, total: order.total_amount, payable: Boolean(bank) && order.status === "pending_payment" }, { headers });
}
