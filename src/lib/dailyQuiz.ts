type DailyQuizDayRecord = {
  completed: boolean;
  score: number;
  total: number;
};

type DailyQuizHistory = Record<string, DailyQuizDayRecord>;

type TopicStats = Record<string, { correct: number; attempts: number }>;

export interface DailyQuizSnapshot {
  streak: number;
  todayCompleted: boolean;
  todayScore: number | null;
  todayTotal: number;
}

const HISTORY_KEY = 'recall_daily_quiz_history_v1';
const TOPIC_KEY = 'recall_daily_quiz_topic_stats_v1';

function getDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readHistory(): DailyQuizHistory {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DailyQuizHistory;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeHistory(history: DailyQuizHistory): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function computeStreak(history: DailyQuizHistory, now = new Date()): number {
  let streak = 0;
  for (let i = 0; i < 3650; i += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const key = getDateKey(date);
    const record = history[key];
    if (record?.completed) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function getDailyQuizSnapshot(now = new Date()): DailyQuizSnapshot {
  const key = getDateKey(now);
  const history = readHistory();
  const today = history[key];

  return {
    streak: computeStreak(history, now),
    todayCompleted: !!today?.completed,
    todayScore: today?.total ? today.score : null,
    todayTotal: today?.total || 0,
  };
}

export function recordDailyQuizCompletion(input: {
  score: number;
  total: number;
  now?: Date;
}): DailyQuizSnapshot {
  const now = input.now || new Date();
  const key = getDateKey(now);
  const history = readHistory();
  const existing = history[key];

  if (!existing || input.score > existing.score || input.total > existing.total) {
    history[key] = {
      completed: true,
      score: input.score,
      total: input.total,
    };
    writeHistory(history);
  }

  return getDailyQuizSnapshot(now);
}

function readTopicStats(): TopicStats {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(TOPIC_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TopicStats;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeTopicStats(topicStats: TopicStats): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOPIC_KEY, JSON.stringify(topicStats));
}

export function recordQuizTopicAttempt(topic: string, correct: boolean): void {
  const normalizedTopic = topic?.trim() || 'Uncategorized';
  const topicStats = readTopicStats();

  const existing = topicStats[normalizedTopic] || { correct: 0, attempts: 0 };
  topicStats[normalizedTopic] = {
    correct: existing.correct + (correct ? 1 : 0),
    attempts: existing.attempts + 1,
  };

  writeTopicStats(topicStats);
}

export function getQuizTopicStats(): TopicStats {
  return readTopicStats();
}
