import type { Metadata } from "next";
import { getCurrentActor } from "../auth";
import PartnerApp from "./partner-app";

export const metadata: Metadata = {
  title: "PetCare Partner — Quản lý cơ sở",
  description: "Portal vận hành dành cho phòng khám thú y và pet shop trên PetCare.",
};

export const dynamic = "force-dynamic";

export default async function PartnerPage() {
  const user = await getCurrentActor();
  return <PartnerApp initialActor={user} />;
}
