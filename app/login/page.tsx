/* Auth endpoints require a full navigation. */
/* eslint-disable @next/next/no-html-link-for-pages */
import { safeReturnTo } from "../../lib/supabase";

export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<{ return_to?: string; error?: string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.return_to || null);
  return <main className="login-page"><section className="login-card">
    <a className="brand" href="/">PetCare</a>
    <h1>Chào mừng bạn trở lại</h1>
    <p>Đăng nhập để quản lý hồ sơ thú cưng và lịch khám của bạn.</p>
    {params.error && <p className="form-error" role="alert">{params.error === "unavailable" ? "Chưa thể kết nối đăng nhập. Vui lòng thử lại sau." : "Tên đăng nhập hoặc mật khẩu chưa đúng. Vui lòng thử lại."}</p>}
    <form method="post" action="/auth/password" className="login-form">
      <input type="hidden" name="return_to" value={returnTo} />
      <label htmlFor="username">Tên đăng nhập</label>
      <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} pattern="[a-zA-Z][a-zA-Z0-9_]{2,31}" placeholder="Ví dụ: nguyenminhanh" />
      <label htmlFor="password">Mật khẩu</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
      <button className="primary-button" type="submit">Đăng nhập</button>
    </form>
    <div className="login-divider">hoặc</div>
    <a className="secondary-button" href={`/auth/signin?provider=google&return_to=${encodeURIComponent(returnTo)}`}>Tiếp tục với Google</a>
    <p className="login-help">Dùng tài khoản username được cấp, hoặc đăng nhập / tạo tài khoản bằng Google.</p>
    <a className="text-button" href="/">← Về trang chủ</a>
  </section></main>;
}
