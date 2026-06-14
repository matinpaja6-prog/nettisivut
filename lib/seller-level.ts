import type { SellerLevelStats } from "./supabase";

const MAX_SELLER_LEVEL = 100;

function clampStat(value: number | null | undefined) {
  return Math.max(0, Number(value) || 0);
}

export function getSellerLevelXp(stats: SellerLevelStats) {
  const singleListings = stats.single_listings_created ?? stats.listings_created;
  const multiListings = stats.multi_listings_created ?? 0;

  return (
    (stats.phone_verified ? 100 : 0) +
    clampStat(singleListings) * 10 +
    clampStat(multiListings) * 5 +
    clampStat(stats.sold_count) * 60 +
    clampStat(stats.reviews_given) * 20 +
    clampStat(stats.reviews_received) * 45
  );
}

export function getXpRequiredForNextSellerLevel(level: number) {
  return Math.max(100, Math.min(MAX_SELLER_LEVEL - 1, level) * 100);
}

function getSellerLevelStartXp(level: number) {
  if (level <= 1) return 0;
  return ((level - 1) * level * 100) / 2;
}

export function calculateSellerLevel(stats: SellerLevelStats) {
  const totalXp = getSellerLevelXp(stats);
  let level = 1;

  while (
    level < MAX_SELLER_LEVEL &&
    totalXp >= getSellerLevelStartXp(level + 1)
  ) {
    level += 1;
  }

  const maxLevel = level >= MAX_SELLER_LEVEL;
  const currentLevelXp = maxLevel
    ? getXpRequiredForNextSellerLevel(MAX_SELLER_LEVEL - 1)
    : totalXp - getSellerLevelStartXp(level);
  const xpForNextLevel = maxLevel
    ? getXpRequiredForNextSellerLevel(MAX_SELLER_LEVEL - 1)
    : getXpRequiredForNextSellerLevel(level);
  const nextLevelXp = maxLevel
    ? 0
    : Math.max(0, xpForNextLevel - currentLevelXp);

  return {
    level,
    maxLevel,
    totalXp,
    currentLevelXp,
    xpForNextLevel,
    nextLevelXp,
    progressPercent: maxLevel
      ? 100
      : Math.max(0, Math.min(100, Math.round((currentLevelXp / xpForNextLevel) * 100)))
  };
}
