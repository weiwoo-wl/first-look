export const MB = 1024 * 1024;
export const UPLOAD_LIMITS = { image: 5 * MB, video: 50 * MB, technical: 10 * MB, product: 100 * MB, account: 300 * MB, site: 9_000_000_000, part: 8 * MB } as const;
export function formatBytes(bytes: number) { return bytes >= 1_000_000_000 ? (bytes / 1_000_000_000).toFixed(1) + " GB" : (bytes / MB).toFixed(1) + " MB"; }
export type StorageQuota = { used: number; limit: number; remaining: number; siteRemaining: number; productLimit: number };
