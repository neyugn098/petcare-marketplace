// Reserved, non-deliverable identifiers for provisioned username accounts.
// Google identities continue to use their verified email addresses.
export function usernameEmail(value: string): string | null {
  const username = value.trim().toLowerCase();
  return /^[a-z][a-z0-9_]{2,31}$/.test(username) ? `${username}@users.petcare.invalid` : null;
}
