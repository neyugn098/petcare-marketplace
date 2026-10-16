import type { Metadata } from "next";
import { getCurrentActor } from "./auth";
import CustomerApp from "./customer-app";

export const metadata: Metadata = {
  title: "PetCare — Mua sắm & chăm sóc thú cưng",
  description: "Mua sắm đồ cho pet, tìm thú y và pet shop đang mở, đặt lịch khám và quản lý hồ sơ sức khỏe trong một nơi.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentActor();
  return <CustomerApp initialActor={user} />;
}
