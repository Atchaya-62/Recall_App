import { supabase } from '@/lib/supabase';
import { GeneratedCoursePlan } from '@/types';

export type LocalTracking = {
  completedModuleIds: string[];
  quizScores: number[];
};

export type StoredCourse = {
  id: string;
  plan: GeneratedCoursePlan;
  createdAt: number;
};

const LEGACY_COURSES_KEY = 'generated_courses_v1';
const LEGACY_TRACKING_PREFIX = 'course_tracking_';
const MIGRATION_FLAG_KEY = 'courses_migrated_to_supabase_v1';

const emptyTracking = (): LocalTracking => ({ completedModuleIds: [], quizScores: [] });

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).map((item) => item.trim()).filter(Boolean);
};

const asNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
};

const normalizePlan = (plan: any): GeneratedCoursePlan | null => {
  if (!plan || typeof plan !== 'object') return null;
  if (!plan.id || !plan.title || !Array.isArray(plan.modules)) return null;

  const modules = plan.modules.map((module: any, index: number) => ({
    id: String(module?.id || `module-${index + 1}`),
    name: String(module?.name || `Module ${index + 1}`),
    conceptsCovered: asStringArray(module?.conceptsCovered || module?.concepts || module?.topics),
    difficultyLevel: String(module?.difficultyLevel || module?.difficulty || 'Mixed'),
    expectedOutcome: String(module?.expectedOutcome || module?.outcome || ''),
    videos: Array.isArray(module?.videos)
      ? module.videos.map((video: any, videoIndex: number) => ({
          title: String(video?.title || `YouTube Lesson ${videoIndex + 1}`),
          educator: video?.educator ? String(video.educator) : undefined,
          url: video?.url ? String(video.url) : undefined,
        }))
      : [],
    quizzes: Array.isArray(module?.quizzes)
      ? module.quizzes
          .map((quiz: any) => ({
            question: String(quiz?.question || ''),
            options: asStringArray(quiz?.options),
            correctAnswer: String(quiz?.correctAnswer || ''),
            explanation: quiz?.explanation ? String(quiz.explanation) : undefined,
            sourceVideoTitle: quiz?.sourceVideoTitle ? String(quiz.sourceVideoTitle) : undefined,
          }))
          .filter((quiz: any) => quiz.question && quiz.options.length >= 2 && quiz.correctAnswer)
      : [],
  }));

  return {
    id: String(plan.id),
    title: String(plan.title),
    overview: String(plan.overview || ''),
    modules,
    checkpoints: Array.isArray(plan.checkpoints) ? plan.checkpoints : [],
    tracking: {
      completionPercent: Number(plan?.tracking?.completionPercent || 0),
      completedModules: Number(plan?.tracking?.completedModules || 0),
      totalModules: Number(plan?.tracking?.totalModules || modules.length),
      quizScores: asNumberArray(plan?.tracking?.quizScores),
    },
    finalOutcome: String(plan.finalOutcome || ''),
  };
};

const normalizeTracking = (row: any): LocalTracking => ({
  completedModuleIds: asStringArray(row?.completed_module_ids),
  quizScores: asNumberArray(row?.quiz_scores),
});

const getCurrentUserOrThrow = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error('Not authenticated');
  return user;
};

const parseLegacyCourses = (): Array<{ id: string; plan: GeneratedCoursePlan; createdAt: number }> => {
  const raw = localStorage.getItem(LEGACY_COURSES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    const candidates = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as any).courses)
        ? (parsed as any).courses
        : [];

    return candidates
      .map((entry: any) => {
        const plan = normalizePlan(entry?.plan);
        if (!plan) return null;
        return {
          id: String(entry?.id || ''),
          plan,
          createdAt: Number(entry?.createdAt || Date.now()),
        };
      })
      .filter((entry): entry is { id: string; plan: GeneratedCoursePlan; createdAt: number } => !!entry);
  } catch {
    return [];
  }
};

export const computeCourseProgress = (tracking: LocalTracking, totalModules: number): number => {
  if (totalModules <= 0) return 0;
  return Math.round((tracking.completedModuleIds.length / totalModules) * 100);
};

export const coursesApi = {
  listCourses: async (): Promise<StoredCourse[]> => {
    const user = await getCurrentUserOrThrow();
    const { data, error } = await supabase
      .from('generated_courses')
      .select('id, plan, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || [])
      .map((row: any) => {
        const plan = normalizePlan(row.plan);
        if (!plan) return null;
        return {
          id: String(row.id),
          plan,
          createdAt: new Date(row.created_at).getTime(),
        } as StoredCourse;
      })
      .filter((entry): entry is StoredCourse => !!entry);
  },

  createCourse: async (plan: GeneratedCoursePlan): Promise<StoredCourse> => {
    const user = await getCurrentUserOrThrow();
    const { data, error } = await supabase
      .from('generated_courses')
      .insert({
        user_id: user.id,
        plan,
      })
      .select('id, plan, created_at')
      .single();

    if (error) throw error;

    const normalizedPlan = normalizePlan(data.plan);
    if (!normalizedPlan) {
      throw new Error('Generated course could not be saved due to invalid plan shape.');
    }

    return {
      id: String(data.id),
      plan: normalizedPlan,
      createdAt: new Date(data.created_at).getTime(),
    };
  },

  deleteCourse: async (courseId: string): Promise<void> => {
    const user = await getCurrentUserOrThrow();
    const { error } = await supabase
      .from('generated_courses')
      .delete()
      .eq('id', courseId)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  listTrackingByCourseId: async (): Promise<Record<string, LocalTracking>> => {
    const user = await getCurrentUserOrThrow();
    const { data, error } = await supabase
      .from('course_tracking')
      .select('course_id, completed_module_ids, quiz_scores')
      .eq('user_id', user.id);

    if (error) throw error;

    return (data || []).reduce((acc: Record<string, LocalTracking>, row: any) => {
      acc[String(row.course_id)] = normalizeTracking(row);
      return acc;
    }, {});
  },

  getTracking: async (courseId: string): Promise<LocalTracking> => {
    const user = await getCurrentUserOrThrow();
    const { data, error } = await supabase
      .from('course_tracking')
      .select('completed_module_ids, quiz_scores')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return emptyTracking();
    return normalizeTracking(data);
  },

  upsertTracking: async (courseId: string, tracking: LocalTracking): Promise<LocalTracking> => {
    const user = await getCurrentUserOrThrow();

    const { data, error } = await supabase
      .from('course_tracking')
      .upsert(
        {
          course_id: courseId,
          user_id: user.id,
          completed_module_ids: tracking.completedModuleIds,
          quiz_scores: tracking.quizScores,
        },
        { onConflict: 'course_id,user_id' }
      )
      .select('completed_module_ids, quiz_scores')
      .single();

    if (error) throw error;
    return normalizeTracking(data);
  },

  migrateLegacyLocalCourses: async (): Promise<void> => {
    const alreadyMigrated = localStorage.getItem(MIGRATION_FLAG_KEY) === '1';
    if (alreadyMigrated) return;

    const legacyCourses = parseLegacyCourses();
    if (legacyCourses.length === 0) {
      localStorage.setItem(MIGRATION_FLAG_KEY, '1');
      return;
    }

    const user = await getCurrentUserOrThrow();

    for (const legacy of legacyCourses) {
      const createdAtIso = Number.isFinite(legacy.createdAt)
        ? new Date(legacy.createdAt).toISOString()
        : new Date().toISOString();

      const { data: inserted, error: insertError } = await supabase
        .from('generated_courses')
        .insert({
          user_id: user.id,
          plan: legacy.plan,
          created_at: createdAtIso,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      const legacyTrackingRaw = localStorage.getItem(`${LEGACY_TRACKING_PREFIX}${legacy.id}`);
      if (!legacyTrackingRaw) continue;

      try {
        const parsed = JSON.parse(legacyTrackingRaw) as LocalTracking;
        await supabase.from('course_tracking').upsert(
          {
            course_id: String(inserted.id),
            user_id: user.id,
            completed_module_ids: asStringArray(parsed?.completedModuleIds),
            quiz_scores: asNumberArray(parsed?.quizScores),
          },
          { onConflict: 'course_id,user_id' }
        );
      } catch {
        // Ignore malformed legacy tracking entries and continue migration.
      }
    }

    localStorage.removeItem(LEGACY_COURSES_KEY);
    for (const legacy of legacyCourses) {
      localStorage.removeItem(`${LEGACY_TRACKING_PREFIX}${legacy.id}`);
    }
    localStorage.setItem(MIGRATION_FLAG_KEY, '1');
  },
};