export function venmoPayUrl(username: string, amount: number | string, note: string): string {
  return `https://venmo.com/${encodeURIComponent(username)}?txn=pay&amount=${amount}&note=${encodeURIComponent(note)}`;
}
