import { supabase } from '@/lib/supabase';
import { Folder, Video, Flashcard } from '@/types';

// Folders API
export const foldersApi = {
  getAll: async (): Promise<Folder[]> => {
    const { data, error } = await supabase
      .from('folders')
      .select(`
        *,
        videos:videos(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(folder => ({
      id: folder.id,
      userId: folder.user_id,
      name: folder.name,
      color: folder.color as 'amber' | 'orange' | 'emerald',
      videoCount: folder.videos?.[0]?.count || 0,
      createdAt: folder.created_at,
      updatedAt: folder.updated_at,
    }));
  },

  getById: async (id: string): Promise<Folder> => {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      color: data.color as 'amber' | 'orange' | 'emerald',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  create: async (name: string, color: string): Promise<Folder> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('folders')
      .insert({ name, color, user_id: user.id })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      color: data.color as 'amber' | 'orange' | 'emerald',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  update: async (id: string, updates: Partial<Folder>): Promise<Folder> => {
    const dbUpdates: any = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.color) dbUpdates.color = updates.color;

    const { data, error } = await supabase
      .from('folders')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      color: data.color as 'amber' | 'orange' | 'emerald',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// Videos API
export const videosApi = {
  getAll: async (): Promise<Video[]> => {
    const { data, error } = await supabase
      .from('videos')
      .select(`
        *,
        flashcards:flashcards(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(mapVideoFromDb);
  },

  getByFolder: async (folderId: string): Promise<Video[]> => {
    const { data, error } = await supabase
      .from('videos')
      .select(`
        *,
        flashcards:flashcards(count)
      `)
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(mapVideoFromDb);
  },

  getById: async (id: string): Promise<Video> => {
    const { data, error } = await supabase
      .from('videos')
      .select(`
        *,
        flashcards:flashcards(count)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return mapVideoFromDb(data);
  },

  create: async (video: Partial<Video>): Promise<Video> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Auto-categorize when folder is not explicitly provided.
    let resolvedFolderId: string | null = video.folderId || null;
    if (!resolvedFolderId && video.title) {
      const matchedOrCreatedFolderId = await resolveFolderForVideo(user.id, video.title);
      resolvedFolderId = matchedOrCreatedFolderId;
    }

    // Reuse existing video if the same YouTube video was already added by this user.
    if (video.videoId) {
      const { data: existingVideos, error: existingError } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', user.id)
        .eq('video_id', video.videoId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingError) throw existingError;
      if (existingVideos && existingVideos.length > 0) {
        const existing = existingVideos[0];

        // If video is categorized differently now, update the existing record's folder.
        if (resolvedFolderId && existing.folder_id !== resolvedFolderId) {
          const { data: updatedExisting, error: updateExistingError } = await supabase
            .from('videos')
            .update({ folder_id: resolvedFolderId })
            .eq('id', existing.id)
            .select(`
              *,
              flashcards:flashcards(count)
            `)
            .single();

          if (updateExistingError) throw updateExistingError;
          return {
            ...mapVideoFromDb(updatedExisting),
            isExisting: true,
          };
        }

        return {
          ...mapVideoFromDb(existing),
          isExisting: true,
        };
      }
    }

    const dbVideo: any = {
      user_id: user.id,
      folder_id: resolvedFolderId,
      youtube_url: video.youtubeUrl,
      video_id: video.videoId,
      title: video.title,
      thumbnail: video.thumbnail || null,
      summary: video.summary || null,
      notes: video.notes || [],
      duration: video.duration || null,
      watched: video.watched || false,
    };

    const { data, error } = await supabase
      .from('videos')
      .insert(dbVideo)
      .select(`
        *,
        flashcards:flashcards(count)
      `)
      .single();

    if (error) throw error;
    return {
      ...mapVideoFromDb(data),
      isExisting: false,
    };
  },

  update: async (id: string, updates: Partial<Video>): Promise<Video> => {
    const dbUpdates: any = {};
    if (updates.folderId !== undefined) dbUpdates.folder_id = updates.folderId;
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.summary) dbUpdates.summary = updates.summary;
    if (updates.notes) dbUpdates.notes = updates.notes;
    if (updates.watched !== undefined) dbUpdates.watched = updates.watched;
    if (updates.thumbnail) dbUpdates.thumbnail = updates.thumbnail;
    if (updates.duration) dbUpdates.duration = updates.duration;

    const { data, error } = await supabase
      .from('videos')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapVideoFromDb(data);
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// Flashcards API
export const flashcardsApi = {
  getByVideo: async (videoId: string): Promise<Flashcard[]> => {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('video_id', videoId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data.map(mapFlashcardFromDb);
  },

  getAll: async (): Promise<Flashcard[]> => {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(mapFlashcardFromDb);
  },

  update: async (id: string, updates: Partial<Flashcard>): Promise<Flashcard> => {
    const dbUpdates: any = {};
    if (updates.question) dbUpdates.question = updates.question;
    if (updates.answer) dbUpdates.answer = updates.answer;
    if (updates.mastered !== undefined) dbUpdates.mastered = updates.mastered;
    if (updates.lastReviewed) dbUpdates.last_reviewed = updates.lastReviewed;

    const { data, error } = await supabase
      .from('flashcards')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapFlashcardFromDb(data);
  },

  bulkCreate: async (flashcards: Array<Omit<Flashcard, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Flashcard[]> => {
    const dbFlashcards = flashcards.map(fc => ({
      video_id: fc.videoId,
      question: fc.question,
      answer: fc.answer,
      mastered: fc.mastered || false,
      last_reviewed: fc.lastReviewed || null,
    }));

    const { data, error } = await supabase
      .from('flashcards')
      .insert(dbFlashcards)
      .select();

    if (error) throw error;
    return data.map(mapFlashcardFromDb);
  },
};

// Helper mapping functions
function mapVideoFromDb(video: any): Video {
  return {
    id: video.id,
    userId: video.user_id,
    folderId: video.folder_id,
    youtubeUrl: video.youtube_url,
    videoId: video.video_id,
    title: video.title,
    thumbnail: video.thumbnail,
    summary: video.summary,
    notes: video.notes || [],
    duration: video.duration,
    watched: video.watched || false,
    flashcardsCount: video.flashcards?.[0]?.count || 0,
    createdAt: video.created_at,
    updatedAt: video.updated_at,
  };
}

function mapFlashcardFromDb(card: any): Flashcard {
  return {
    id: card.id,
    videoId: card.video_id,
    question: card.question,
    answer: card.answer,
    mastered: card.mastered || false,
    lastReviewed: card.last_reviewed,
    createdAt: card.created_at,
    updatedAt: card.updated_at,
  };
}

async function resolveFolderForVideo(userId: string, videoTitle: string): Promise<string | null> {
  const { data: folders, error } = await supabase
    .from('folders')
    .select('id, name')
    .eq('user_id', userId);

  if (error) throw error;

  const intentFolderName = deriveIntentFolderName(videoTitle);
  if (intentFolderName) {
    return findOrCreateFolderByName(userId, folders || [], intentFolderName);
  }

  const normalizedTitle = normalizeText(videoTitle);
  const titleTokens = getMeaningfulTokens(normalizedTitle);

  let bestFolder: { id: string; score: number; overlapCount: number } | null = null;
  for (const folder of folders || []) {
    const { score, overlapCount } = folderMatchScore(folder.name, normalizedTitle, titleTokens);
    if (!bestFolder || score > bestFolder.score) {
      bestFolder = { id: folder.id, score, overlapCount };
    }
  }

  // Match an existing folder only when confidence is very high.
  if (bestFolder && bestFolder.score >= 0.9 && bestFolder.overlapCount >= 2) {
    return bestFolder.id;
  }

  // Unknown topic goes to a stable fallback folder instead of creating noisy names from title words.
  return findOrCreateFolderByName(userId, folders || [], 'Inbox');
}

async function findOrCreateFolderByName(
  userId: string,
  folders: Array<{ id: string; name: string }>,
  folderName: string
): Promise<string> {
  const normalizedTarget = normalizeText(folderName);
  const existing = folders.find((folder) => normalizeText(folder.name) === normalizedTarget);
  if (existing) {
    return existing.id;
  }

  const color = pickFolderColor(folderName);

  const { data: createdFolder, error: createError } = await supabase
    .from('folders')
    .insert({
      user_id: userId,
      name: folderName,
      color,
    })
    .select('id')
    .single();

  if (createError) throw createError;
  return createdFolder.id;
}

function folderMatchScore(
  folderName: string,
  normalizedTitle: string,
  titleTokens: string[]
): { score: number; overlapCount: number } {
  const normalizedFolder = normalizeText(folderName);
  if (!normalizedFolder) return { score: 0, overlapCount: 0 };

  if (normalizedTitle.includes(normalizedFolder)) {
    return { score: 0.95, overlapCount: 2 };
  }

  const folderTokens = getMeaningfulTokens(normalizedFolder);
  if (folderTokens.length === 0) return { score: 0, overlapCount: 0 };

  let overlap = 0;
  for (const token of folderTokens) {
    if (titleTokens.includes(token)) {
      overlap += 1;
    }
  }

  const ratio = overlap / Math.max(folderTokens.length, 1);
  const score = overlap >= 2 ? ratio : ratio * 0.5;
  return { score, overlapCount: overlap };
}

function deriveIntentFolderName(videoTitle: string): string | null {
  const title = normalizeText(videoTitle);

  const rules: Array<{ keywords: string[]; folder: string }> = [
    { keywords: ['credit card', 'credit cards', 'bank', 'banking', 'finance', 'financial', 'investing', 'money'], folder: 'Finance' },
    { keywords: ['attention span', 'focus', 'productivity', 'self improvement', 'habits'], folder: 'Productivity & Self Improvement' },
    { keywords: ['leetcode', 'leet code', 'lc problem'], folder: 'Leetcode Instructions' },
    { keywords: ['codeforces', 'competitive programming'], folder: 'Competitive Programming' },
    { keywords: ['system design', 'low level design', 'lld', 'hld'], folder: 'System Design' },
    { keywords: ['javascript', 'typescript', 'react', 'nodejs', 'node js'], folder: 'Web Development' },
    { keywords: ['python', 'java', 'c++', 'cpp', 'golang', 'rust'], folder: 'Programming Languages' },
    { keywords: ['data structure', 'algorithm', 'dsa', 'dynamic programming', 'graph', 'trees'], folder: 'DSA Concepts' },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => title.includes(normalizeText(keyword)))) {
      return rule.folder;
    }
  }

  return null;
}

function pickFolderColor(seed: string): 'amber' | 'orange' | 'emerald' {
  const options: Array<'amber' | 'orange' | 'emerald'> = ['amber', 'orange', 'emerald'];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return options[Math.abs(hash) % options.length];
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMeaningfulTokens(input: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'by', 'from', 'at', 'as', 'is', 'are', 'be',
    'this', 'that', 'these', 'those', 'video', 'course', 'tutorial', 'lecture', 'lesson', 'part', 'basics',
    'how', 'what', 'why', 'when', 'where', 'who', 'your', 'my', 'our', 'their', 'works', 'work', 'working', 'fix',
    'guide', 'explained', 'complete', 'full', 'best', 'new', 'ultimate', 'vs', 'tips', 'tricks'
  ]);

  return input
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

