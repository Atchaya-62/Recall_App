import { Flashcard, Folder, Video } from '@/types';

export interface ReviewCard extends Flashcard {
  videoTitle: string;
  folderName: string;
  folderId: string | null;
  recallProbability: number;
  urgencyScore: number;
  dueToday: boolean;
  nextReviewAt: string;
}

export interface DailyReviewSession {
  today: ReviewCard[];
  upcoming: ReviewCard[];
  stats: {
    totalCards: number;
    dueTodayCount: number;
    masteredCount: number;
    progressScore: number;
    suggestedSessionSize: number;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso).getTime();
  return Math.max(0, (to.getTime() - from) / DAY_MS);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildDailyReviewSession(
  flashcards: Flashcard[],
  videos: Video[],
  folders: Folder[],
  options?: { now?: Date; maxDailyCards?: number }
): DailyReviewSession {
  const now = options?.now ?? new Date();
  const maxDailyCards = options?.maxDailyCards ?? 25;

  if (flashcards.length === 0) {
    return {
      today: [],
      upcoming: [],
      stats: {
        totalCards: 0,
        dueTodayCount: 0,
        masteredCount: 0,
        progressScore: 0,
        suggestedSessionSize: 0,
      },
    };
  }

  const masteredCount = flashcards.filter((card) => card.mastered).length;
  const reviewedCount = flashcards.filter((card) => !!card.lastReviewed).length;

  const masteryRatio = masteredCount / flashcards.length;
  const reviewCoverage = reviewedCount / flashcards.length;
  const progressScore = clamp(0.6 * masteryRatio + 0.4 * reviewCoverage, 0, 1);

  const reviewCards: ReviewCard[] = flashcards.map((card) => {
    const video = videos.find((item) => item.id === card.videoId);
    const folder = video?.folderId
      ? folders.find((item) => item.id === video.folderId)
      : undefined;

    const referenceTime = card.lastReviewed || card.createdAt;
    const daysSinceReview = daysBetween(referenceTime, now);

    // Spacing gets longer as mastery/progress improves.
    const baseHalfLifeDays = card.mastered ? 5 : 1.5;
    const progressMultiplier = card.mastered
      ? 0.8 + progressScore * 1.0
      : 0.65 + progressScore * 0.5;

    const halfLifeDays = Math.max(0.75, baseHalfLifeDays * progressMultiplier);
    const recallProbability = Math.exp(-daysSinceReview / halfLifeDays);

    const dueThreshold = card.mastered ? 0.72 : 0.86;
    const dueToday = recallProbability <= dueThreshold;
    const urgencyScore = clamp(dueThreshold - recallProbability, 0, 1) +
      Math.min(daysSinceReview / 30, 0.35);

    const nextReviewDays = Math.max(0, -halfLifeDays * Math.log(dueThreshold));
    const nextReviewAt = new Date(new Date(referenceTime).getTime() + nextReviewDays * DAY_MS).toISOString();

    return {
      ...card,
      videoTitle: video?.title || 'Untitled video',
      folderName: folder?.name || 'Uncategorized',
      folderId: video?.folderId || null,
      recallProbability,
      urgencyScore,
      dueToday,
      nextReviewAt,
    };
  });

  const dueToday = reviewCards
    .filter((card) => card.dueToday)
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
    .slice(0, maxDailyCards);

  const upcoming = reviewCards
    .filter((card) => !card.dueToday)
    .sort(
      (a, b) =>
        new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime()
    );

  const suggestedSessionSize = clamp(
    Math.round(10 + dueToday.length * 0.5 + progressScore * 8),
    8,
    30
  );

  return {
    today: dueToday,
    upcoming,
    stats: {
      totalCards: flashcards.length,
      dueTodayCount: dueToday.length,
      masteredCount,
      progressScore,
      suggestedSessionSize,
    },
  };
}
