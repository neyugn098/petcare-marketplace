export function paymentDetails(partnerId: string) {
  const bank = process.env.PAYMENT_BANK_NAME?.trim();
  const accountNumber = process.env.PAYMENT_ACCOUNT_NUMBER?.trim();
  const accountName = process.env.PAYMENT_ACCOUNT_NAME?.trim();
  if (!partnerId || partnerId !== process.env.PAYMENT_PARTNER_ID || !bank || !accountName || !accountNumber || !/^\d{6,24}$/.test(accountNumber)) return null;
  return { bank, accountNumber, accountName };
}
