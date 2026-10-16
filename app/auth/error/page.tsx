/* OAuth endpoints require full navigation, not client-side routing. */
/* eslint-disable @next/next/no-html-link-for-pages */
export const dynamic = "force-dynamic";
export default async function AuthError({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return <main className="section-wrap account-gate"><span>🔒</span><h1>Chưa thể đăng nhập</h1>
    <p>{reason === "setup" ? "Đăng nhập Google đang được cấu hình. Bạn vẫn có thể xem PetCare và tìm cơ sở gần mình." : "Phiên đăng nhập đã hết hạn hoặc bạn chưa hoàn tất đăng nhập Google. Hãy thử lại trên cùng trình duyệt."}</p>
    <a className="primary-button" href="/auth/signin">Tiếp tục với Google</a><a className="text-button" href="/">Về trang chủ</a></main>;
}

