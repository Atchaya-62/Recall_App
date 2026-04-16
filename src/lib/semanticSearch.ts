import { Folder, Video } from '@/types';

export interface SemanticSearchResult {
  id: string;
  videoId: string;
  title: string;
  folderName?: string;
  snippet: string;
  matchedTerms: string[];
  score: number;
  matchSource: 'title' | 'summary' | 'notes' | 'folder';
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'by', 'from',
  'at', 'as', 'is', 'are', 'be', 'this', 'that', 'these', 'those', 'it', 'its', 'how',
  'what', 'why', 'when', 'where', 'who', 'your', 'my', 'our', 'their', 'into', 'about',
  'video', 'videos', 'note', 'notes', 'learn', 'learning', 'guide', 'tutorial', 'course'
]);

const SYNONYM_GROUPS: string[][] = [
  ['review', 'revise', 'revision', 'recall', 'memorize', 'remember', 'memory'],
  ['flashcard', 'question', 'quiz', 'practice', 'test'],
  ['algorithm', 'algorithms', 'dsa', 'data', 'structure', 'problem', 'leetcode'],
  ['react', 'frontend', 'ui', 'component', 'jsx', 'typescript', 'javascript'],
  ['backend', 'server', 'api', 'database', 'supabase', 'sql'],
  ['productivity', 'focus', 'habit', 'discipline', 'attention'],
  ['finance', 'money', 'investing', 'budget', 'banking', 'credit']
];

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stemToken(token: string): string {
  return token
    .replace(/(ing|edly|edly|ed|ly|s)$/g, '')
    .replace(/(tion|ions)$/g, 't');
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(' ')
    .map((token) => stemToken(token.trim()))
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function expandTokens(tokens: string[]): Set<string> {
  const expanded = new Set<string>(tokens);

  for (const token of tokens) {
    for (const group of SYNONYM_GROUPS) {
      if (group.some((candidate) => stemToken(candidate) === token)) {
        for (const candidate of group) {
          expanded.add(stemToken(candidate));
        }
      }
    }
  }

  return expanded;
}

function scoreOverlap(queryTokens: Set<string>, content: string): number {
  const contentTokens = tokenize(content);
  if (contentTokens.length === 0) return 0;

  let score = 0;
  for (const token of contentTokens) {
    if (queryTokens.has(token)) {
      score += 1;
    }
  }

  return score / Math.max(contentTokens.length, 1);
}

function buildSnippet(content: string, queryTokens: Set<string>): string {
  const raw = content.replace(/\s+/g, ' ').trim();
  if (!raw) return 'No additional context available.';

  const words = raw.split(' ');
  const matchIndex = words.findIndex((word) => queryTokens.has(stemToken(normalizeText(word))));

  if (matchIndex < 0) {
    return raw.slice(0, 180) + (raw.length > 180 ? '...' : '');
  }

  const start = Math.max(0, matchIndex - 12);
  const end = Math.min(words.length, matchIndex + 18);
  const snippet = words.slice(start, end).join(' ');
  const prefix = start > 0 ? '... ' : '';
  const suffix = end < words.length ? ' ...' : '';

  return `${prefix}${snippet}${suffix}`;
}

function collectMatchedTerms(content: string, queryTokens: Set<string>): string[] {
  const normalized = normalizeText(content);
  if (!normalized) return [];

  const uniqueTerms = new Set<string>();
  for (const token of normalized.split(' ')) {
    const trimmed = token.trim();
    if (trimmed.length <= 2) continue;
    if (queryTokens.has(stemToken(trimmed))) {
      uniqueTerms.add(trimmed);
    }
  }

  return Array.from(uniqueTerms);
}

export function semanticSearchVideos(
  query: string,
  videos: Video[],
  folders: Folder[],
  limit = 20
): SemanticSearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const expandedQuery = expandTokens(queryTokens);
  const normalizedQuery = normalizeText(query);

  const results: SemanticSearchResult[] = [];

  for (const video of videos) {
    const folderName = video.folderId
      ? folders.find((folder) => folder.id === video.folderId)?.name
      : undefined;

    const notesText = (video.notes || []).join(' ');
    const titleScore = scoreOverlap(expandedQuery, video.title) * 6;
    const summaryScore = scoreOverlap(expandedQuery, video.summary || '') * 4;
    const notesScore = scoreOverlap(expandedQuery, notesText) * 5;
    const folderScore = scoreOverlap(expandedQuery, folderName || '') * 2;

    const phraseBonus = normalizeText(`${video.title} ${video.summary || ''} ${notesText}`).includes(normalizedQuery)
      ? 2
      : 0;

    const totalScore = titleScore + summaryScore + notesScore + folderScore + phraseBonus;
    if (totalScore <= 0.22) continue;

    let matchSource: SemanticSearchResult['matchSource'] = 'title';
    let bestField = video.title;
    let bestFieldScore = titleScore;

    if (summaryScore > bestFieldScore) {
      bestFieldScore = summaryScore;
      bestField = video.summary || '';
      matchSource = 'summary';
    }

    if (notesScore > bestFieldScore) {
      bestFieldScore = notesScore;
      bestField = notesText;
      matchSource = 'notes';
    }

    if (folderScore > bestFieldScore) {
      bestField = folderName || '';
      matchSource = 'folder';
    }

    results.push({
      id: `${video.id}-${matchSource}`,
      videoId: video.id,
      title: video.title,
      folderName,
      snippet: buildSnippet(bestField, expandedQuery),
      matchedTerms: collectMatchedTerms(bestField, expandedQuery),
      score: totalScore,
      matchSource,
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
