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

const COURSES_STORAGE_KEY = 'generated_courses_v1';

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).map((item) => item.trim()).filter(Boolean);
};

const normalizeStoredPlan = (plan: any): GeneratedCoursePlan | null => {
  if (!plan || typeof plan !== 'object') return null;
  if (!plan.id || !plan.title) return null;

  const modules = Array.isArray(plan.modules)
    ? plan.modules.map((module: any, index: number) => ({
        id: String(module?.id || `module-${index + 1}`),
        name: String(module?.name || `Module ${index + 1}`),
        conceptsCovered: asStringArray(module?.conceptsCovered || module?.concepts || module?.topics),
        difficultyLevel: String(module?.difficultyLevel || module?.difficulty || 'Mixed'),
        expectedOutcome: String(module?.expectedOutcome || module?.outcome || 'Build confidence with this module.'),
        videos: Array.isArray(module?.videos)
          ? module.videos.map((video: any, videoIndex: number) => ({
              title: String(video?.title || `YouTube Lesson ${videoIndex + 1}`),
              educator: video?.educator ? String(video.educator) : undefined,
              url: video?.url ? String(video.url) : undefined,
            }))
          : [],
        // Backward compatibility for courses saved before module quizzes were added.
        quizzes: Array.isArray(module?.quizzes)
          ? module.quizzes.map((quiz: any) => ({
              question: String(quiz?.question || ''),
              options: asStringArray(quiz?.options),
              correctAnswer: String(quiz?.correctAnswer || ''),
              explanation: quiz?.explanation ? String(quiz.explanation) : undefined,
              sourceVideoTitle: quiz?.sourceVideoTitle ? String(quiz.sourceVideoTitle) : undefined,
            })).filter((quiz: any) => quiz.question && quiz.options.length >= 2 && quiz.correctAnswer)
          : [],
      }))
    : [];

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
      quizScores: Array.isArray(plan?.tracking?.quizScores)
        ? plan.tracking.quizScores.map((score: unknown) => Number(score)).filter((score: number) => Number.isFinite(score))
        : [],
    },
    finalOutcome: String(plan.finalOutcome || ''),
  };
};

export const getCourseTrackingKey = (courseId: string) => `course_tracking_${courseId}`;

export const loadStoredTracking = (courseId: string): LocalTracking => {
  const raw = localStorage.getItem(getCourseTrackingKey(courseId));
  if (!raw) return { completedModuleIds: [], quizScores: [] };

  try {
    const parsed = JSON.parse(raw) as LocalTracking;
    return {
      completedModuleIds: Array.isArray(parsed.completedModuleIds) ? parsed.completedModuleIds : [],
      quizScores: Array.isArray(parsed.quizScores) ? parsed.quizScores : [],
    };
  } catch {
    return { completedModuleIds: [], quizScores: [] };
  }
};

export const saveStoredTracking = (courseId: string, tracking: LocalTracking) => {
  localStorage.setItem(getCourseTrackingKey(courseId), JSON.stringify(tracking));
};

export const loadStoredCourses = (): StoredCourse[] => {
  const raw = localStorage.getItem(COURSES_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    const rawCourses = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as any).courses)
        ? (parsed as any).courses
        : parsed && typeof parsed === 'object' && (parsed as any).plan
          ? [parsed]
          : [];

    return rawCourses
      .map((entry: any, index: number) => {
        const normalizedPlan = normalizeStoredPlan(entry?.plan);
        if (!normalizedPlan) return null;

        return {
          id: String(entry.id || `${normalizedPlan.id}-${entry.createdAt || Date.now()}-${index}`),
          plan: normalizedPlan,
          createdAt: Number(entry.createdAt || Date.now()),
        } as StoredCourse;
      })
      .filter((entry): entry is StoredCourse => !!entry);
  } catch {
    return [];
  }
};

export const saveStoredCourses = (courses: StoredCourse[]) => {
  localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(courses));
  window.dispatchEvent(new Event('course-storage-updated'));
};

export const addStoredCourse = (plan: GeneratedCoursePlan): StoredCourse[] => {
  const id = `course-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const nextCourses: StoredCourse[] = [
    { id, plan, createdAt: Date.now() },
    ...loadStoredCourses(),
  ];
  saveStoredCourses(nextCourses);
  return nextCourses;
};

export const deleteStoredCourse = (courseId: string): StoredCourse[] => {
  const nextCourses = loadStoredCourses().filter((entry) => entry.id !== courseId);
  saveStoredCourses(nextCourses);
  localStorage.removeItem(getCourseTrackingKey(courseId));
  return nextCourses;
};

export const computeStoredCourseProgress = (courseId: string, totalModules: number): number => {
  if (totalModules <= 0) return 0;
  const tracking = loadStoredTracking(courseId);
  return Math.round((tracking.completedModuleIds.length / totalModules) * 100);
};