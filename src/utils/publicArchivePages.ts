// Shared by the visible archive navigation and server-rendered HTML.
// A crawler or visitor can jump to deep archives without walking every page.
export function publicArchivePageNumbers(page: number, total: number, pageSize: number): number[] {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(pageSize) || pageSize <= 0) return [];
  const last = Math.min(5000, Math.ceil(total / pageSize));
  if (last <= 1 || !Number.isInteger(page) || page < 1 || page > last) return [];
  if (last <= 100) return Array.from({ length: last }, (_, index) => index + 1);
  // For larger collections, link to block starts plus all pages in the
  // current block. This bounds link counts while keeping every page reachable.
  const blockSize = Math.max(10, Math.ceil(last / 50));
  const start = Math.floor((page - 1) / blockSize) * blockSize + 1;
  const numbers = new Set<number>([1, last]);
  for (let n = 1; n <= last; n += blockSize) numbers.add(n);
  for (let n = start; n <= Math.min(last, start + blockSize - 1); n++) numbers.add(n);
  return [...numbers].sort((a, b) => a - b);
}
