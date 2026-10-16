import type { Metadata } from "next";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = new URL(process.env.APP_URL || "http://localhost:3000");
  return {
    metadataBase: baseUrl,
    title: { default: "PetCare — Mua sắm & chăm sóc thú cưng", template: "%s · PetCare" },
    description: "Mua sắm đồ cho pet, tìm thú y và pet shop đang mở, đặt lịch khám và quản lý hồ sơ sức khỏe trong một nơi.",
    applicationName: "PetCare",
    openGraph: { type: "website", locale: "vi_VN", siteName: "PetCare", title: "PetCare — Mọi điều tốt nhất cho boss, trong một nơi.", description: "Mua sắm, tìm cơ sở đang mở, đặt lịch và giữ hồ sơ sức khỏe thú cưng trong một ứng dụng." },
    twitter: { card: "summary", title: "PetCare — Mọi điều tốt nhất cho boss", description: "Mua sắm và chăm sóc thú cưng trong một nơi." },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
