export type ChallengeEventType =
  | 'quiz_started'
  | 'quiz_answered'
  | 'quiz_correct'
  | 'quiz_completed_60'
  | 'quiz_completed_80'
  | 'quiz_combo_4'
  | 'video_added'
  | 'learning_minutes';

type ChallengeMetric = ChallengeEventType;

type DailyChallengeProgress = Record<string, number>;
type DailyProgressStore = Record<string, DailyChallengeProgress>;

type RewardsStore = {
  totalXp: number;
  claimedByDate: Record<string, string[]>;
};

type RotationStore = Record<string, string[]>;

type ChallengeDefinition = {
  id: string;
  title: string;
  metric: ChallengeMetric;
  target: number;
  xp: number;
};

export type ChallengeItem = {
  id: string;
  title: string;
  progress: number;
  target: number;
  completed: boolean;
  xp: number;
  claimed: boolean;
};

export type ChallengeSnapshot = {
  dateKey: string;
  challenges: ChallengeItem[];
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
};

const PROGRESS_KEY = 'recall_challenge_progress_v2';
const REWARDS_KEY = 'recall_challenge_rewards_v2';
const ROTATION_KEY = 'recall_challenge_rotation_v1';

const CHALLENGE_POOL: ChallengeDefinition[] = [
  { id: 'answer-6', title: 'Answer 6 quiz questions', metric: 'quiz_answered', target: 6, xp: 16 },
  { id: 'answer-10', title: 'Answer all 10 quiz questions', metric: 'quiz_answered', target: 10, xp: 28 },
  { id: 'correct-5', title: 'Get 5 answers correct', metric: 'quiz_correct', target: 5, xp: 20 },
  { id: 'correct-8', title: 'Get 8 answers correct', metric: 'quiz_correct', target: 8, xp: 30 },
  { id: 'quiz-60', title: 'Score at least 60% in a quiz', metric: 'quiz_completed_60', target: 1, xp: 30 },
  { id: 'quiz-80', title: 'Score at least 80% in a quiz', metric: 'quiz_completed_80', target: 1, xp: 42 },
  { id: 'combo-4', title: 'Get a 4-answer correct streak', metric: 'quiz_combo_4', target: 1, xp: 24 },
  { id: 'quiz-start-1', title: 'Start your daily quiz', metric: 'quiz_started', target: 1, xp: 12 },
  { id: 'add-video-1', title: 'Upload 1 new video today', metric: 'video_added', target: 1, xp: 22 },
  { id: 'add-video-2', title: 'Upload 2 new videos today', metric: 'video_added', target: 2, xp: 34 },
  { id: 'learn-10', title: 'Spend 10 minutes learning', metric: 'learning_minutes', target: 10, xp: 18 },
  { id: 'learn-15', title: 'Spend 15 minutes learning', metric: 'learning_minutes', target: 15, xp: 26 },
  { id: 'correct-10', title: 'Get 10 answers correct', metric: 'quiz_correct', target: 10, xp: 36 },
];

function getDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function readProgressStore(): DailyProgressStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DailyProgressStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeProgressStore(store: DailyProgressStore): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(store));
}

function readRewardsStore(): RewardsStore {
  if (typeof window === 'undefined') return { totalXp: 0, claimedByDate: {} };
  try {
    const raw = window.localStorage.getItem(REWARDS_KEY);
    if (!raw) return { totalXp: 0, claimedByDate: {} };
    const parsed = JSON.parse(raw) as RewardsStore;
    if (!parsed || typeof parsed !== 'object') return { totalXp: 0, claimedByDate: {} };
    return {
      totalXp: Number(parsed.totalXp || 0),
      claimedByDate: parsed.claimedByDate && typeof parsed.claimedByDate === 'object' ? parsed.claimedByDate : {},
    };
  } catch {
    return { totalXp: 0, claimedByDate: {} };
  }
}

function writeRewardsStore(store: RewardsStore): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REWARDS_KEY, JSON.stringify(store));
}

function readRotationStore(): RotationStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ROTATION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RotationStore;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeRotationStore(store: RotationStore): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ROTATION_KEY, JSON.stringify(store));
}

function getCurrentLevel(totalXp: number): { level: number; xpIntoLevel: number; xpForNextLevel: number } {
  let level = 0;
  let threshold = 1000;

  while (totalXp >= threshold) {
    level += 1;
    threshold += (level + 1) * 1000;
  }

  const previousThreshold = level === 0 ? 0 : level * (level + 1) * 500;
  return {
    level,
    xpIntoLevel: totalXp - previousThreshold,
    xpForNextLevel: threshold - previousThreshold,
  };
}

function previousDateKey(dateKey: string, offset: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - offset);
  return getDateKey(date);
}

function pickChallengesForDate(dateKey: string): ChallengeDefinition[] {
  const rotation = readRotationStore();
  if (rotation[dateKey]?.length === 3) {
    const ids = new Set(rotation[dateKey]);
    const resolved = CHALLENGE_POOL.filter((challenge) => ids.has(challenge.id));
    if (resolved.length === 3) {
      return resolved;
    }

    // Pool may have changed; regenerate today's rotation to avoid missing cards.
    delete rotation[dateKey];
    writeRotationStore(rotation);
  }

  const recentIds = new Set<string>();
  for (let i = 1; i <= 3; i += 1) {
    const priorKey = previousDateKey(dateKey, i);
    for (const id of rotation[priorKey] || []) {
      recentIds.add(id);
    }
  }

  const freshPool = CHALLENGE_POOL.filter((challenge) => !recentIds.has(challenge.id));
  const fallbackPool = CHALLENGE_POOL;
  const selectionSource = freshPool.length >= 3 ? freshPool : fallbackPool;

  const pool = [...selectionSource];
  const selected: ChallengeDefinition[] = [];
  let seed = hashSeed(dateKey);

  while (selected.length < 3 && pool.length > 0) {
    const index = seed % pool.length;
    selected.push(pool[index]);
    pool.splice(index, 1);
    seed = hashSeed(`${dateKey}-${seed}-${selected.length}`);
  }

  rotation[dateKey] = selected.map((challenge) => challenge.id);
  writeRotationStore(rotation);

  return selected;
}

function applyRewardsForDay(dateKey: string): void {
  const progressStore = readProgressStore();
  const rewardsStore = readRewardsStore();
  const progress = progressStore[dateKey] || {};
  const challenges = pickChallengesForDate(dateKey);

  const claimed = new Set(rewardsStore.claimedByDate[dateKey] || []);
  let gainedXp = 0;

  for (const challenge of challenges) {
    const done = (progress[challenge.metric] || 0) >= challenge.target;
    if (done && !claimed.has(challenge.id)) {
      claimed.add(challenge.id);
      gainedXp += challenge.xp;
    }
  }

  if (gainedXp > 0) {
    rewardsStore.totalXp += gainedXp;
    rewardsStore.claimedByDate[dateKey] = Array.from(claimed);
    writeRewardsStore(rewardsStore);
  }
}

export function recordChallengeEvent(event: ChallengeEventType, amount = 1, now = new Date()): ChallengeSnapshot {
  const safeAmount = Math.max(0, amount);
  const dateKey = getDateKey(now);
  const progressStore = readProgressStore();
  const day = progressStore[dateKey] || {};
  day[event] = (day[event] || 0) + safeAmount;
  progressStore[dateKey] = day;
  writeProgressStore(progressStore);

  applyRewardsForDay(dateKey);
  return getChallengeSnapshot(now);
}

export function getChallengeSnapshot(now = new Date()): ChallengeSnapshot {
  const dateKey = getDateKey(now);
  applyRewardsForDay(dateKey);

  const progressStore = readProgressStore();
  const rewardsStore = readRewardsStore();
  const progress = progressStore[dateKey] || {};
  const challenges = pickChallengesForDate(dateKey);
  const claimedSet = new Set(rewardsStore.claimedByDate[dateKey] || []);

  const items: ChallengeItem[] = challenges.map((challenge) => {
    const value = progress[challenge.metric] || 0;
    return {
      id: challenge.id,
      title: challenge.title,
      progress: Math.min(value, challenge.target),
      target: challenge.target,
      completed: value >= challenge.target,
      xp: challenge.xp,
      claimed: claimedSet.has(challenge.id),
    };
  });

  const levelState = getCurrentLevel(rewardsStore.totalXp);

  return {
    dateKey,
    challenges: items,
    totalXp: rewardsStore.totalXp,
    level: levelState.level,
    xpIntoLevel: levelState.xpIntoLevel,
    xpForNextLevel: levelState.xpForNextLevel,
  };
}
