import type { Metadata } from "next";
import PublicPetCard from "./public-pet-card";

export const metadata: Metadata = {
  title: "Thẻ an toàn thú cưng — PetCare",
  description: "Hồ sơ an toàn được chia sẻ bằng QR PetCare.",
  robots: { index: false, follow: false },
};

export default async function PetQrPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicPetCard token={token} />;
}
