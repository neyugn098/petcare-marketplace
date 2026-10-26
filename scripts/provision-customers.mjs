import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

// Run only by the project owner; never bundle an admin key into the app.
config({ path: process.env.PROVISION_ENV_FILE || '.env.provision.local', quiet: true });
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const directory = resolve('outputs/private');
mkdirSync(directory, { recursive: true });
const path = resolve(directory, 'petcare-customer-accounts.json');
const names = [['nguyenminhanh','Nguyễn Minh Anh'],['tranquanghuy','Trần Quang Huy'],['lethaonguyen','Lê Thảo Nguyên'],['phamgiabao','Phạm Gia Bảo'],['hoangngoclinh','Hoàng Ngọc Linh'],['vuducminh','Vũ Đức Minh'],['dangphuongnhi','Đặng Phương Nhi'],['buianhkhoa','Bùi Anh Khoa'],['dothanhtruc','Đỗ Thanh Trúc'],['ngohuonggiang','Ngô Hương Giang']];
const accounts = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : names.map(([username, fullName]) => ({ username, fullName, email: `${username}@users.petcare.invalid`, password: `Pc!${randomBytes(12).toString('base64url')}`, authId: null }));
const save = () => writeFileSync(path, JSON.stringify(accounts, null, 2), { mode: 0o600 });
save();
for (const account of accounts) {
  if (account.authId) continue;
  const { data, error } = await client.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true, user_metadata: { full_name: account.fullName, username: account.username } });
  if (error) throw new Error(`Cannot create ${account.username}: ${error.message}`);
  account.authId = data.user.id;
  save();
  console.log(`Created customer ${account.username}`);
}
writeFileSync(resolve(directory, 'PetCare-10-tai-khoan.txt'), '\uFEFFĐĂNG NHẬP PETCARE\nhttps://petcare-rho-six.vercel.app/login\n\nCác tài khoản khách hàng thử nghiệm, không có quyền quản trị/đối tác.\nGiữ file này riêng tư. Username không phân biệt hoa/thường; mật khẩu có phân biệt.\nEmail nội bộ không nhận thư; liên hệ chủ dự án nếu cần đặt lại mật khẩu.\n\n' + accounts.map((a,i)=>`${i+1}. ${a.fullName}\nUsername: ${a.username}\nPassword: ${a.password}`).join('\n\n')+'\n', { mode: 0o600 });
console.log('Saved private account list in outputs/private/PetCare-10-tai-khoan.txt');
