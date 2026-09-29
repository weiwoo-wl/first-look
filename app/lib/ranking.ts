export type RankingCounts = { likes?:number; favorites?:number; shares?:number; share_opens?:number };
export function productScore(counts: RankingCounts) {
  return (counts.likes || 0) * 2 + (counts.favorites || 0) * 4 + (counts.shares || 0) * 5 + (counts.share_opens || 0) * 10;
}
