export type Badge = {
  id: string;
  label: string;
  description: string;
};

export function computeBadges(stats: {
  createdCount: number;
  joinedCount: number;
  diaryCount: number;
  reviewCount: number;
  avgRating: number | null;
}): Badge[] {
  const badges: Badge[] = [];

  if (stats.createdCount >= 3) {
    badges.push({
      id: "organizer",
      label: "Organizer",
      description: "Created 3+ tasks or meetups.",
    });
  }

  if (stats.joinedCount >= 5) {
    badges.push({
      id: "team-player",
      label: "Team Player",
      description: "Joined 5+ community activities.",
    });
  }

  if (stats.diaryCount >= 3) {
    badges.push({
      id: "explorer",
      label: "Explorer",
      description: "Shared 3+ diary gallery entries.",
    });
  }

  if (stats.reviewCount >= 3 && stats.avgRating !== null && stats.avgRating >= 4) {
    badges.push({
      id: "trusted",
      label: "Trusted",
      description: "Maintains a high review rating.",
    });
  }

  if (!badges.length) {
    badges.push({
      id: "new",
      label: "New Member",
      description: "Getting started in the community.",
    });
  }

  return badges;
}
