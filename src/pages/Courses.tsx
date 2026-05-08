import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock3, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  computeCourseProgress,
  coursesApi,
  type LocalTracking,
  type StoredCourse,
} from '@/services/courses';
import { GeneratedCoursePlan } from '@/types';

const emptyTracking = (): LocalTracking => ({ completedModuleIds: [], quizScores: [] });

type ModuleQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

type ActiveModuleQuiz = {
  moduleId: string;
  moduleName: string;
  questions: ModuleQuizQuestion[];
  submitted: boolean;
  score: number | null;
};

const normalizeText = (value: string, maxLength = 90): string => {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).trim()}…`;
};

const uniqueStrings = (values: string[]): string[] => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const orderOptions = (correctAnswer: string, distractors: string[], seed: string): string[] =>
  uniqueStrings([correctAnswer, ...distractors].filter(Boolean))
    .filter((option) => option !== correctAnswer)
    .sort((left, right) => hashString(`${seed}:${left}`) - hashString(`${seed}:${right}`))
    .slice(0, 3)
    .concat(correctAnswer)
    .sort((left, right) => hashString(`${seed}:final:${left}`) - hashString(`${seed}:final:${right}`));

const buildQuizQuestions = (plan: GeneratedCoursePlan, moduleIndex: number): ModuleQuizQuestion[] => {
  const module = plan.modules[moduleIndex];
  const conceptPool = uniqueStrings(plan.modules.flatMap((item) => item.conceptsCovered));
  const moduleNamePool = uniqueStrings(plan.modules.map((item) => item.name));
  const outcomePool = uniqueStrings(plan.modules.map((item) => normalizeText(item.expectedOutcome, 80)));
  const moduleConcepts = uniqueStrings(module.conceptsCovered);
  const primaryConcept = moduleConcepts[0] || module.name;
  const secondaryConcept = moduleConcepts[1] || primaryConcept;

  const conceptQuestion = {
    id: `${module.id}-quiz-concept`,
    question: `Which concept is explicitly covered in ${module.name}?`,
    options: orderOptions(primaryConcept, conceptPool.filter((item) => item !== primaryConcept), `${module.id}-concept`),
    correctAnswer: primaryConcept,
    explanation: `This concept comes directly from the module's outline for ${module.name}.`,
  };

  const conceptPairAnswer = `${primaryConcept} + ${secondaryConcept}`;
  const conceptPairDistractors = uniqueStrings(
    plan.modules
      .filter((item) => item.id !== module.id)
      .map((item) => {
        const first = item.conceptsCovered[0] || item.name;
        const second = item.conceptsCovered[1] || first;
        return `${first} + ${second}`;
      })
  );

  const conceptPairQuestion = {
    id: `${module.id}-quiz-concept-pair`,
    question: `Which concept pair best matches the core content of ${module.name}?`,
    options: orderOptions(conceptPairAnswer, conceptPairDistractors, `${module.id}-concept-pair`),
    correctAnswer: conceptPairAnswer,
    explanation: 'These two concepts are part of this module\'s core coverage.',
  };

  const expectedOutcome = normalizeText(module.expectedOutcome, 80);
  const outcomeQuestion = {
    id: `${module.id}-quiz-outcome`,
    question: `What is the expected outcome after completing ${module.name}?`,
    options: orderOptions(expectedOutcome, outcomePool.filter((item) => item !== expectedOutcome), `${module.id}-outcome`),
    correctAnswer: expectedOutcome,
    explanation: 'This is the outcome written in the module card.',
  };

  const centralTopicQuestion = {
    id: `${module.id}-quiz-central-topic`,
    question: `Which topic is most central to ${module.name}?`,
    options: orderOptions(primaryConcept, conceptPool.filter((item) => item !== primaryConcept), `${module.id}-topic`),
    correctAnswer: primaryConcept,
    explanation: 'This module is centered on that concept in the roadmap.',
  };

  const sequenceAnswer = moduleIndex > 0 ? plan.modules[moduleIndex - 1].name : module.name;
  const sequenceQuestion = moduleIndex > 0
    ? {
        id: `${module.id}-quiz-sequence`,
        question: `Which module comes immediately before ${module.name}?`,
        options: orderOptions(sequenceAnswer, moduleNamePool.filter((item) => item !== sequenceAnswer), `${module.id}-sequence`),
        correctAnswer: sequenceAnswer,
        explanation: 'This keeps the quiz aligned with the course flow and module order.',
      }
    : {
        id: `${module.id}-quiz-sequence`,
        question: `Which module opens this roadmap?`,
        options: orderOptions(sequenceAnswer, moduleNamePool.filter((item) => item !== sequenceAnswer), `${module.id}-sequence`),
        correctAnswer: sequenceAnswer,
        explanation: 'The first module is the starting point of the roadmap.',
      };

  const practiceTaskAnswer = `Solve practice problems on ${primaryConcept}`;
  const practiceTaskQuestion = {
    id: `${module.id}-quiz-practice`,
    question: `Which practice task best aligns with ${module.name}?`,
    options: orderOptions(
      practiceTaskAnswer,
      [
        `Memorize creator names for ${module.name}`,
        `Skip practice and only watch videos`,
        `Focus only on unrelated tooling`,
      ],
      `${module.id}-practice`
    ),
    correctAnswer: practiceTaskAnswer,
    explanation: 'Practice on the module concepts is the expected learning action.',
  };

  return [conceptQuestion, conceptPairQuestion, outcomeQuestion, centralTopicQuestion, practiceTaskQuestion].map((question) => ({
    ...question,
    options: uniqueStrings(question.options).slice(0, 4),
  }));
};

export default function Courses() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<StoredCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [trackingByCourseId, setTrackingByCourseId] = useState<Record<string, LocalTracking>>({});
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(() => {
    const locationStateCourseId = (location.state as { selectedCourseId?: string } | null)?.selectedCourseId;
    return searchParams.get('courseId') || locationStateCourseId || null;
  });
  const [tracking, setTracking] = useState<LocalTracking>(emptyTracking());
  const [activeQuiz, setActiveQuiz] = useState<ActiveModuleQuiz | null>(null);
  const [quizSelections, setQuizSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setCoursesLoading(true);
      try {
        await coursesApi.migrateLegacyLocalCourses();
        const [fetchedCourses, fetchedTracking] = await Promise.all([
          coursesApi.listCourses(),
          coursesApi.listTrackingByCourseId(),
        ]);

        if (!isMounted) return;
        setCourses(fetchedCourses);
        setTrackingByCourseId(fetchedTracking);

        const preferredId =
          searchParams.get('courseId') ||
          (location.state as { selectedCourseId?: string } | null)?.selectedCourseId ||
          fetchedCourses[0]?.id ||
          null;
        setSelectedCourseId((current) => current || preferredId);
      } catch (error: any) {
        if (!isMounted) return;
        toast.error(error?.message || 'Failed to load saved courses.');
      } finally {
        if (isMounted) {
          setCoursesLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const nextSelectedId = searchParams.get('courseId') || (location.state as { selectedCourseId?: string } | null)?.selectedCourseId || courses[0]?.id || null;
    if (!selectedCourseId && nextSelectedId && courses.some((entry) => entry.id === nextSelectedId)) {
      setSelectedCourseId(nextSelectedId);
    }
  }, [courses, location.state, searchParams, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId) return;
    setTracking(trackingByCourseId[selectedCourseId] || emptyTracking());
  }, [selectedCourseId, trackingByCourseId]);

  useEffect(() => {
    if (courses.length === 0) {
      setSelectedCourseId(null);
      setTracking(emptyTracking());
      return;
    }

    const exists = courses.some((entry) => entry.id === selectedCourseId);
    if (!exists) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const selectedPlan: GeneratedCoursePlan | null = useMemo(
    () => courses.find((entry) => entry.id === selectedCourseId)?.plan || null,
    [courses, selectedCourseId]
  );

  const progressPercent = useMemo(() => {
    if (!selectedPlan || selectedPlan.modules.length === 0) return 0;
    return Math.round((tracking.completedModuleIds.length / selectedPlan.modules.length) * 100);
  }, [selectedPlan, tracking.completedModuleIds]);

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    setTracking(trackingByCourseId[courseId] || emptyTracking());
  };

  const handleToggleModuleCompletion = async (moduleId: string) => {
    if (!selectedPlan || !selectedCourseId) return;

    const completedModuleIds = tracking.completedModuleIds.includes(moduleId)
      ? tracking.completedModuleIds.filter((id) => id !== moduleId)
      : [...tracking.completedModuleIds, moduleId];

    const updatedTracking: LocalTracking = {
      ...tracking,
      completedModuleIds,
    };

    setTracking(updatedTracking);
    setTrackingByCourseId((current) => ({ ...current, [selectedCourseId]: updatedTracking }));

    try {
      const saved = await coursesApi.upsertTracking(selectedCourseId, updatedTracking);
      setTracking(saved);
      setTrackingByCourseId((current) => ({ ...current, [selectedCourseId]: saved }));
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save module completion.');
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    const courseTitle = courses.find((entry) => entry.id === courseId)?.plan.title || 'This course';
    const confirmed = window.confirm(`Delete ${courseTitle}? This will also remove its progress.`);
    if (!confirmed) return;

    try {
      await coursesApi.deleteCourse(courseId);
      const nextCourses = courses.filter((entry) => entry.id !== courseId);
      setCourses(nextCourses);
      setTrackingByCourseId((current) => {
        const next = { ...current };
        delete next[courseId];
        return next;
      });
      toast.success('Course deleted.');

      if (selectedCourseId === courseId) {
        const nextSelected = nextCourses[0]?.id || null;
        setSelectedCourseId(nextSelected);
        setTracking(nextSelected ? trackingByCourseId[nextSelected] || emptyTracking() : emptyTracking());
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete course.');
    }
  };

  const selectedCourseProgress = (courseId: string, totalModules: number) =>
    computeCourseProgress(trackingByCourseId[courseId] || emptyTracking(), totalModules);

  const openModuleQuiz = (moduleId: string) => {
    if (!selectedPlan) return;

    const moduleIndex = selectedPlan.modules.findIndex((module) => module.id === moduleId);
    if (moduleIndex < 0) return;

    const module = selectedPlan.modules[moduleIndex];
    setQuizSelections({});
    setActiveQuiz({
      moduleId,
      moduleName: module.name,
      questions: buildQuizQuestions(selectedPlan, moduleIndex),
      submitted: false,
      score: null,
    });
  };

  const closeModuleQuiz = () => {
    setActiveQuiz(null);
    setQuizSelections({});
  };

  const submitModuleQuiz = async () => {
    if (!selectedPlan || !selectedCourseId || !activeQuiz) return;

    const score = activeQuiz.questions.reduce(
      (count, question) => count + (quizSelections[question.id] === question.correctAnswer ? 1 : 0),
      0
    );

    const updatedTracking: LocalTracking = {
      ...tracking,
      quizScores: [...tracking.quizScores, score],
    };

    setTracking(updatedTracking);
    setTrackingByCourseId((current) => ({ ...current, [selectedCourseId]: updatedTracking }));

    try {
      const saved = await coursesApi.upsertTracking(selectedCourseId, updatedTracking);
      setTracking(saved);
      setTrackingByCourseId((current) => ({ ...current, [selectedCourseId]: saved }));
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save quiz score.');
      return;
    }

    setActiveQuiz({ ...activeQuiz, submitted: true, score });
    toast.success(`Module quiz completed: ${score}/5`);
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <section className="glass-strong rounded-3xl p-6 sm:p-10 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/20 to-orange-500/10 blur-3xl" />
          <div className="relative z-10">
            <p className="text-sm uppercase tracking-[0.18em] text-amber-400 font-semibold mb-3">Saved Courses</p>
            <h1 className="text-3xl sm:text-5xl font-bold mb-3">Your generated course library</h1>
            <p className="text-gray-300 max-w-3xl text-base sm:text-lg">
              Open any saved course to continue learning. Progress is stored per course, and you can delete any course you no longer need.
            </p>
          </div>
        </section>

        {coursesLoading ? (
          <div className="glass rounded-2xl p-8 border border-white/10 text-center text-gray-300">
            Loading saved courses...
          </div>
        ) : courses.length === 0 ? (
          <div className="glass rounded-2xl p-8 border border-white/10 text-center text-gray-300">
            No saved courses yet. Generate one from the Course Generator page.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6 items-start">
            <aside className="space-y-4 xl:sticky xl:top-24 self-start">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-amber-400 font-semibold">Library</p>
                  <h2 className="text-lg font-semibold text-white">Saved Courses</h2>
                </div>
                <p className="text-xs text-gray-500">{courses.length} total</p>
              </div>

              <div className="space-y-3 max-h-[calc(100vh-12rem)] xl:overflow-y-auto pr-1">
                {courses.map((entry) => {
                  const isSelected = selectedCourseId === entry.id;
                  const progress = selectedCourseProgress(entry.id, entry.plan.modules.length);

                  return (
                    <div
                      key={entry.id}
                      onClick={() => handleSelectCourse(entry.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleSelectCourse(entry.id);
                        }
                      }}
                      className={`w-full text-left rounded-2xl p-4 border transition-all cursor-pointer ${
                        isSelected
                          ? 'glass-strong border-amber-400/40 ring-1 ring-amber-400/30'
                          : 'glass border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-amber-400 mb-1">Generated Course</p>
                          <h3 className="text-base font-semibold line-clamp-2">{entry.plan.title}</h3>
                        </div>

                        <button
                          type="button"
                          aria-label={`Delete ${entry.plan.title}`}
                          className="mt-1 rounded-full p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteCourse(entry.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                        <p className="text-xs text-gray-400 line-clamp-2 mb-3">{entry.plan.overview}</p>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400">Progress</span>
                          <span className="text-amber-400 font-semibold">{progress}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>{entry.plan.modules.length} modules</span>
                          <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            <main className="space-y-4">
              {selectedPlan ? (
                <>
                  <div className="glass-strong rounded-2xl p-6 border border-white/10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-amber-400 font-semibold mb-2">Selected Course</p>
                        <h2 className="text-2xl sm:text-3xl font-bold mb-2">{selectedPlan.title}</h2>
                        <p className="text-gray-300">{selectedPlan.overview}</p>
                      </div>

                      <Button
                        variant="outline"
                        className="glass border-white/20 hover:bg-red-500/10 hover:text-red-300 shrink-0"
                        onClick={() => handleDeleteCourse(selectedCourseId || selectedPlan.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Course
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Progress</span>
                        <span className="font-semibold text-amber-400">{progressPercent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all" style={{ width: `${progressPercent}%` }} />
                      </div>
                      <p className="text-xs text-gray-400">
                        {tracking.completedModuleIds.length} of {selectedPlan.modules.length} modules completed
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {selectedPlan.modules.map((module, index) => {
                      const completed = tracking.completedModuleIds.includes(module.id);
                      return (
                        <article key={module.id} className="glass rounded-2xl p-5 sm:p-6 border border-white/10">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.08em] text-amber-400 mb-1">Module {index + 1}</p>
                              <h3 className="text-lg sm:text-xl font-semibold">{module.name}</h3>
                              <p className="text-sm text-gray-400 mt-1">Difficulty: {module.difficultyLevel}</p>
                            </div>

                            <Button
                              variant={completed ? 'secondary' : 'outline'}
                              onClick={() => handleToggleModuleCompletion(module.id)}
                              className={completed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'glass border-white/20'}
                            >
                              <CheckCircle2 className="mr-2 w-4 h-4" />
                              {completed ? 'Completed' : 'Mark Complete'}
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div>
                              <p className="text-sm font-semibold mb-2 text-gray-200">Concepts Covered</p>
                              <ul className="space-y-1 text-sm text-gray-300">
                                {module.conceptsCovered.map((concept) => (
                                  <li key={concept}>• {concept}</li>
                                ))}
                              </ul>
                            </div>

                            <div>
                              <p className="text-sm font-semibold mb-2 text-gray-200">YouTube Video Plan</p>
                              {module.videos.length === 0 ? (
                                <p className="text-sm text-gray-500">No videos found for this module.</p>
                              ) : (
                                <ul className="space-y-2 text-sm text-gray-300">
                                  {module.videos.map((video) => (
                                    <li key={`${module.id}-${video.title}-${video.url || 'na'}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                      <p className="font-medium text-gray-200">{video.title}</p>
                                      {video.educator ? <p className="text-xs text-gray-400">By {video.educator}</p> : null}
                                      {video.url ? (
                                        <a
                                          href={video.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center mt-2 text-xs text-amber-400 hover:text-amber-300"
                                        >
                                          Watch video
                                          <ExternalLink className="ml-1 w-3 h-3" />
                                        </a>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                            <p className="text-sm font-semibold mb-1 text-gray-200">Expected Outcome</p>
                            <p className="text-sm text-gray-300">{module.expectedOutcome}</p>
                          </div>

                          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <p className="text-sm font-semibold text-gray-200">Module Quiz</p>
                              <p className="text-sm text-gray-400">5 MCQs generated from module concepts and expected outcomes.</p>
                            </div>
                            <Button onClick={() => openModuleQuiz(module.id)} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold">
                              Take 5-Question Quiz
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <section className="glass rounded-2xl p-6 border border-white/10">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Clock3 className="w-4 h-4 text-amber-400" />
                      Tracking System
                    </h3>

                    <div className="space-y-4 text-sm text-gray-300">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <p>Completion: <span className="font-semibold text-amber-400">{progressPercent}%</span></p>
                        <p>Completed Modules: {tracking.completedModuleIds.length}</p>
                        <p>Total Modules: {selectedPlan.modules.length}</p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-gray-200">Quiz Scores</p>
                          <div className="text-xs text-gray-500">
                            {tracking.quizScores.length > 0 ? tracking.quizScores.join(', ') : 'No quiz attempts yet'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="glass-strong rounded-2xl p-6 border border-white/10">
                    <h3 className="text-lg font-semibold mb-2">Final Outcome</h3>
                    <p className="text-gray-300">{selectedPlan.finalOutcome}</p>
                  </section>
                </>
              ) : (
                <div className="glass rounded-2xl p-8 border border-white/10 text-center text-gray-300">
                  Select a course card to view the modules and progress.
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      {activeQuiz ? (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm px-4 py-6 flex items-center justify-center">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-neutral-950/95 shadow-2xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-amber-400 font-semibold mb-2">Module Quiz</p>
                <h3 className="text-2xl font-bold">{activeQuiz.moduleName}</h3>
                <p className="text-sm text-gray-400">Answer 5 questions built from the module content and video plan.</p>
              </div>
              <Button variant="outline" className="glass border-white/20" onClick={closeModuleQuiz}>
                Close
              </Button>
            </div>

            <div className="space-y-4">
              {activeQuiz.questions.map((question, index) => {
                const selectedAnswer = quizSelections[question.id];
                const answeredCorrectly = activeQuiz.submitted && selectedAnswer === question.correctAnswer;
                const answeredWrong = activeQuiz.submitted && selectedAnswer && selectedAnswer !== question.correctAnswer;

                return (
                  <div key={question.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm uppercase tracking-[0.12em] text-amber-400 mb-2">Q{index + 1}</p>
                    <h4 className="text-base sm:text-lg font-semibold text-gray-100">{question.question}</h4>

                    <div className="mt-4 grid grid-cols-1 gap-2">
                      {question.options.map((option) => {
                        const isSelected = selectedAnswer === option;
                        const isCorrect = activeQuiz.submitted && option === question.correctAnswer;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              if (activeQuiz.submitted) return;
                              setQuizSelections((current) => ({ ...current, [question.id]: option }));
                            }}
                            className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${
                              isCorrect
                                ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                                : isSelected
                                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-100'
                                  : 'border-white/10 bg-black/20 text-gray-200 hover:border-white/20'
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>

                    {activeQuiz.submitted ? (
                      <div className="mt-3 text-sm space-y-1">
                        <p className={answeredCorrectly ? 'text-emerald-300' : 'text-gray-400'}>
                          {answeredCorrectly ? 'Correct answer' : 'Correct answer: '}{question.correctAnswer}
                        </p>
                        {answeredWrong ? <p className="text-red-300">Your answer was incorrect.</p> : null}
                        <p className="text-gray-400">{question.explanation}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 flex-wrap border-t border-white/10 pt-4">
              <div>
                <p className="text-sm text-gray-400">{activeQuiz.submitted && activeQuiz.score !== null ? `Score: ${activeQuiz.score}/5` : 'Select one answer per question, then submit.'}</p>
              </div>
              <div className="flex items-center gap-3">
                {!activeQuiz.submitted ? (
                  <Button variant="outline" className="glass border-white/20" onClick={closeModuleQuiz}>
                    Cancel
                  </Button>
                ) : null}
                {!activeQuiz.submitted ? (
                  <Button onClick={submitModuleQuiz} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold">
                    Submit Quiz
                  </Button>
                ) : (
                  <Button onClick={closeModuleQuiz} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold">
                    Done
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
