import { useMemo, useState } from 'react';
import { useAllFlashcards, useVideos, useFolders } from '@/hooks/useData';
import { Loader2, Target, Trophy, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  getDailyQuizSnapshot,
  getQuizTopicStats,
  recordDailyQuizCompletion,
  recordQuizTopicAttempt,
} from '@/lib/dailyQuiz';
import { recordChallengeEvent } from '../lib/challenges';
import { gradeEssayWithAI } from '@/lib/quizAi';

type QuizType = 'mixed' | 'mcq' | 'fill' | 'essay';
type QuestionType = 'mcq' | 'fill' | 'essay';
const DAILY_QUIZ_SIZE = 10;

type QuizQuestion = {
  id: string;
  cardId: string;
  type: QuestionType;
  prompt: string;
  answer: string;
  options?: string[];
  topic: string;
  videoTitle: string;
};

type SubmissionResult = {
  correct: boolean;
  feedback: string;
  score?: number;
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function evaluateTextAnswer(expected: string, received: string): boolean {
  const expectedNorm = normalizeText(expected);
  const receivedNorm = normalizeText(received);

  if (!expectedNorm || !receivedNorm) return false;
  if (expectedNorm === receivedNorm) return true;

  const expectedTokens = expectedNorm.split(' ').filter((t) => t.length > 2);
  const receivedTokens = new Set(receivedNorm.split(' ').filter((t) => t.length > 2));

  if (expectedTokens.length === 0) {
    return receivedNorm.includes(expectedNorm.slice(0, 8));
  }

  let matches = 0;
  for (const token of expectedTokens) {
    if (receivedTokens.has(token)) matches += 1;
  }

  const ratio = matches / expectedTokens.length;
  return ratio >= 0.45;
}

function sentenceFirst(text: string): string {
  const sentence = text.split(/[.!?]/)[0]?.trim() || text.trim();
  return sentence.slice(0, 140);
}

function buildConceptPrompt(baseQuestion: string, topic: string, type: QuestionType, relatedHint?: string): string {
  const stem = baseQuestion.trim();
  const suffix = relatedHint ? ` Consider this related idea: ${relatedHint}` : '';

  if (type === 'mcq') {
    return `In ${topic}, which option best addresses this concept: ${stem}?${suffix}`;
  }

  if (type === 'fill') {
    return `Complete the key idea for this concept in ${topic}: ${stem}`;
  }

  return `Explain this concept in your own words and include one practical example: ${stem}.${suffix}`;
}

function syntheticDistractors(answer: string): string[] {
  const base = sentenceFirst(answer);
  const variants = [
    `${base} only in edge cases`,
    `${base} but only after optimization`,
    `A partially correct idea: ${base}`,
  ];
  return variants;
}

function getRelevantDistractors(
  card: { id: string; answer: string; topic: string; videoTitle: string },
  cards: Array<{ id: string; answer: string; topic: string; videoTitle: string }>
): string[] {
  const sameTopic = cards
    .filter((c) => c.id !== card.id && c.topic === card.topic)
    .map((c) => sentenceFirst(c.answer));

  const sameVideo = cards
    .filter((c) => c.id !== card.id && c.videoTitle === card.videoTitle)
    .map((c) => sentenceFirst(c.answer));

  const unique = Array.from(new Set([...sameTopic, ...sameVideo])).filter(
    (value) => normalizeText(value) !== normalizeText(card.answer)
  );

  const picked = shuffle(unique).slice(0, 3);
  if (picked.length < 3) {
    const extra = syntheticDistractors(card.answer).filter(
      (item) => !picked.includes(item)
    );
    return [...picked, ...extra].slice(0, 3);
  }

  return picked;
}

function getRandomQuestionType(mode: QuizType): QuestionType {
  if (mode !== 'mixed') return mode;
  const pool: QuestionType[] = ['mcq', 'fill', 'essay'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickBalancedCards(
  cards: Array<{ id: string; question: string; answer: string; topic: string; videoTitle: string }>,
  size: number
): Array<{ id: string; question: string; answer: string; topic: string; videoTitle: string }> {
  if (cards.length === 0 || size <= 0) return [];

  const grouped = new Map<string, Array<{ id: string; question: string; answer: string; topic: string; videoTitle: string }>>();
  cards.forEach((card) => {
    const key = card.topic || 'Uncategorized';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(card);
  });

  const pools = new Map<string, Array<{ id: string; question: string; answer: string; topic: string; videoTitle: string }>>();
  grouped.forEach((topicCards, topic) => {
    pools.set(topic, shuffle(topicCards));
  });

  const selected: Array<{ id: string; question: string; answer: string; topic: string; videoTitle: string }> = [];
  const topics = shuffle(Array.from(grouped.keys()));
  let topicIndex = 0;

  while (selected.length < size) {
    const availableTopics = topics.filter((topic) => (pools.get(topic)?.length || 0) > 0);

    if (availableTopics.length === 0) {
      break;
    }

    const topic = availableTopics[topicIndex % availableTopics.length];
    const topicPool = pools.get(topic);
    const card = topicPool?.shift();
    if (card) selected.push(card);
    topicIndex += 1;
  }

  if (selected.length >= size) return selected;

  const fallbackPool = shuffle(cards);
  while (selected.length < size && fallbackPool.length > 0) {
    const candidate = fallbackPool[selected.length % fallbackPool.length];
    selected.push(candidate);
  }

  return selected;
}

function buildQuizQuestions(input: {
  cards: Array<{ id: string; question: string; answer: string; topic: string; videoTitle: string }>;
  mode: QuizType;
  size: number;
}): QuizQuestion[] {
  const pickedCards = pickBalancedCards(input.cards, input.size);

  return pickedCards.map((card, index) => {
    const type = getRandomQuestionType(input.mode);
    const relatedHint = shuffle(
      input.cards
        .filter((c) => c.id !== card.id && c.topic === card.topic)
        .map((c) => sentenceFirst(c.question))
    )[0];
    const prompt = buildConceptPrompt(card.question, card.topic, type, relatedHint);

    if (type === 'mcq') {
      const distractors = getRelevantDistractors(card, input.cards);

      const options = shuffle([sentenceFirst(card.answer), ...distractors]);
      return {
        id: `${card.id}-mcq-${index}`,
        cardId: card.id,
        type,
        prompt,
        answer: sentenceFirst(card.answer),
        options,
        topic: card.topic,
        videoTitle: card.videoTitle,
      };
    }

    if (type === 'fill') {
      return {
        id: `${card.id}-fill-${index}`,
        cardId: card.id,
        type,
        prompt,
        answer: card.answer,
        topic: card.topic,
        videoTitle: card.videoTitle,
      };
    }

    return {
      id: `${card.id}-essay-${index}`,
      cardId: card.id,
      type,
      prompt,
      answer: card.answer,
      topic: card.topic,
      videoTitle: card.videoTitle,
    };
  });
}

export default function FlashcardReview() {
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState('');
  const [textAnswer, setTextAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [submissionFeedback, setSubmissionFeedback] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [score, setScore] = useState(0);
  const [, setCorrectStreak] = useState(0);
  const [maxCorrectStreak, setMaxCorrectStreak] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [, setQuizStartedAt] = useState<number | null>(null);
  const [quizSnapshot, setQuizSnapshot] = useState(() => getDailyQuizSnapshot());

  const { data: allFlashcardsData = [], isLoading: flashcardsLoading } = useAllFlashcards();
  const { data: videos = [], isLoading: videosLoading } = useVideos();
  const { data: folders = [] } = useFolders();

  const isLoading = flashcardsLoading || videosLoading;

  const enrichedCards = useMemo(() => {
    return allFlashcardsData.map((card) => {
      const video = videos.find((item) => item.id === card.videoId);
      const folder = video?.folderId ? folders.find((item) => item.id === video.folderId) : undefined;
      return {
        id: card.id,
        question: card.question,
        answer: card.answer,
        topic: folder?.name || 'Uncategorized',
        topicId: folder?.id || null,
        videoTitle: video?.title || 'Unknown video',
      };
    });
  }, [allFlashcardsData, videos, folders]);

  const filteredCards = enrichedCards;

  const currentQuestion = quizQuestions[currentIndex];
  const isQuizActive = quizQuestions.length > 0 && !quizFinished;

  const topicMastery = useMemo(() => {
    const stored = getQuizTopicStats();
    const topics = Array.from(new Set(enrichedCards.map((card) => card.topic)));

    return topics
      .map((topic) => {
        const stat = stored[topic] || { correct: 0, attempts: 0 };
        const mastery = stat.attempts > 0 ? (stat.correct / stat.attempts) * 100 : 0;
        return {
          topic,
          attempts: stat.attempts,
          mastery,
        };
      })
      .sort((a, b) => b.mastery - a.mastery);
  }, [enrichedCards, quizFinished, score]);

  const weakAreas = useMemo(() => {
    return topicMastery
      .filter((item) => item.attempts >= 2)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 3);
  }, [topicMastery]);

  const startQuiz = () => {
    if (filteredCards.length === 0) {
      toast.error('No flashcards available for this deck.');
      return;
    }

    const questions = buildQuizQuestions({
      cards: filteredCards,
      mode: 'mixed',
      size: DAILY_QUIZ_SIZE,
    });

    setQuizQuestions(questions);
    setCurrentIndex(0);
    setSelectedOption('');
    setTextAnswer('');
    setSubmitted(false);
    setLastCorrect(null);
    setSubmissionFeedback('');
    setScore(0);
    setCorrectStreak(0);
    setMaxCorrectStreak(0);
    setQuizFinished(false);
    setQuizStartedAt(Date.now());
    recordChallengeEvent('quiz_started');
  };

  const submitCurrentAnswer = async () => {
    if (!currentQuestion || submitted) return;

    let result: SubmissionResult = { correct: false, feedback: '' };

    if (currentQuestion.type === 'mcq') {
      if (!selectedOption) {
        toast.error('Select an option first.');
        return;
      }
      const correct = normalizeText(selectedOption) === normalizeText(currentQuestion.answer);
      result = {
        correct,
        feedback: correct
          ? 'Great pick. This option best matches the concept.'
          : 'This option is not the best conceptual match for the question.',
      };
    } else if (currentQuestion.type === 'fill') {
      if (!textAnswer.trim()) {
        toast.error('Enter your answer first.');
        return;
      }

      const correct = evaluateTextAnswer(currentQuestion.answer, textAnswer);
      result = {
        correct,
        feedback: correct
          ? 'Good completion. You captured the core idea.'
          : 'Your completion misses some key concepts from the reference answer.',
      };
    } else {
      if (!textAnswer.trim()) {
        toast.error('Enter your answer first.');
        return;
      }

      setIsEvaluating(true);
      const aiResult = await gradeEssayWithAI({
        question: currentQuestion.prompt,
        referenceAnswer: currentQuestion.answer,
        userAnswer: textAnswer,
        topic: currentQuestion.topic,
      });
      setIsEvaluating(false);

      if (aiResult) {
        result = {
          correct: aiResult.isCorrect,
          feedback: `AI evaluation: ${aiResult.feedback}`,
          score: aiResult.score,
        };
      } else {
        const correct = evaluateTextAnswer(currentQuestion.answer, textAnswer);
        result = {
          correct,
          feedback: correct
            ? 'Good conceptual answer (fallback grading).'
            : 'Answer needs more conceptual coverage (fallback grading).',
        };
      }
    }

    setSubmitted(true);
    setLastCorrect(result.correct);
    setSubmissionFeedback(result.feedback);
    if (result.correct) {
      setScore((prev) => prev + 1);
      setCorrectStreak((prev) => {
        const next = prev + 1;
        setMaxCorrectStreak((maxPrev) => Math.max(maxPrev, next));
        return next;
      });
    } else {
      setCorrectStreak(0);
    }

    recordQuizTopicAttempt(currentQuestion.topic, result.correct);
    recordChallengeEvent('quiz_answered');
    if (result.correct) {
      recordChallengeEvent('quiz_correct');
    }
  };

  const nextQuestion = () => {
    if (!currentQuestion || !submitted) return;

    const isLast = currentIndex === quizQuestions.length - 1;
    const finalScore = score;

    if (isLast) {
      const ratio = quizQuestions.length > 0 ? finalScore / quizQuestions.length : 0;
      if (ratio >= 0.6) {
        recordChallengeEvent('quiz_completed_60');
      }
      if (ratio >= 0.8) {
        recordChallengeEvent('quiz_completed_80');
      }
      if (maxCorrectStreak >= 4) {
        recordChallengeEvent('quiz_combo_4');
      }

      const snapshot = recordDailyQuizCompletion({
        score: finalScore,
        total: quizQuestions.length,
      });
      setQuizSnapshot(snapshot);
      setScore(finalScore);
      setQuizFinished(true);
      toast.success('Daily quiz submitted. Streak updated.');
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setSelectedOption('');
    setTextAnswer('');
    setSubmitted(false);
    setLastCorrect(null);
    setSubmissionFeedback('');
  };

  const resetQuiz = () => {
    setQuizQuestions([]);
    setCurrentIndex(0);
    setSelectedOption('');
    setTextAnswer('');
    setSubmitted(false);
    setLastCorrect(null);
    setSubmissionFeedback('');
    setScore(0);
    setCorrectStreak(0);
    setMaxCorrectStreak(0);
    setQuizFinished(false);
    setQuizStartedAt(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-xl text-gray-400">Loading quiz decks...</p>
        </div>
      </div>
    );
  }

  if (enrichedCards.length === 0) {
    return (
      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
        <div className="text-center max-w-xl px-4">
          <Target className="w-16 h-16 text-gray-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">No Quiz Decks Available</h1>
          <p className="text-xl text-gray-400 mb-8">
            Process videos first to generate flashcards. Then your daily quizzes can start.
          </p>
          <Button onClick={() => (window.location.href = '/process')} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold">
            Create Flashcards
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-5xl font-bold mb-4">
            <span className="text-gradient">Quiz Mode</span>
          </h1>
          <p className="text-sm uppercase tracking-[0.2em] text-amber-400 mb-2">Daily Quiz</p>
          <p className="text-xl text-gray-400">
            Complete the compulsory daily quiz to keep your streak alive. Every session contains 10 randomized questions across your topics.
          </p>
        </div>

        <div className="glass rounded-2xl p-6 mb-8 border border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass rounded-xl p-4 border border-white/10">
              <p className="text-sm text-gray-400 mb-1">Daily format</p>
              <p className="text-base text-white font-medium">10 questions, mixed types</p>
              <p className="text-sm text-gray-400 mt-1">Randomized from all available topics</p>
            </div>

            <div className="flex items-end">
              {!isQuizActive ? (
                <Button onClick={startQuiz} className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold">
                  {quizSnapshot.todayCompleted ? 'Retake Daily Quiz' : 'Start Daily Quiz'}
                </Button>
              ) : (
                <Button onClick={resetQuiz} variant="outline" className="w-full h-11 glass border-white/20">
                  Reset Quiz
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-400">
            Streak: <span className="text-amber-400 font-semibold">{quizSnapshot.streak} 🔥</span>
            {quizSnapshot.todayCompleted && quizSnapshot.todayScore !== null ? (
              <span className="ml-3">Today's best: {quizSnapshot.todayScore}/{quizSnapshot.todayTotal}</span>
            ) : null}
            {!quizSnapshot.todayCompleted ? (
              <span className="ml-3 text-orange-300">Daily quiz pending</span>
            ) : null}
          </div>
        </div>

        {isQuizActive && currentQuestion ? (
          <div className="glass-strong rounded-3xl p-8 mb-8 border border-white/10">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-gray-400">Question {currentIndex + 1} of {quizQuestions.length}</p>
              <p className="text-sm text-amber-400 font-semibold">{currentQuestion.type.toUpperCase()}</p>
            </div>

            <div className="glass rounded-xl p-4 mb-4 text-sm text-gray-300">
              <span className="text-amber-400 font-semibold">{currentQuestion.topic}</span> / {currentQuestion.videoTitle}
            </div>

            <h2 className="text-2xl font-semibold leading-relaxed mb-6">{currentQuestion.prompt}</h2>

            {currentQuestion.type === 'mcq' ? (
              <div className="space-y-3 mb-6">
                {currentQuestion.options?.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={submitted}
                    onClick={() => setSelectedOption(option)}
                    className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                      selectedOption === option
                        ? 'border-amber-500/50 bg-amber-500/10'
                        : 'border-white/10 hover:border-white/25'
                    } ${submitted ? 'opacity-80' : ''}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : currentQuestion.type === 'fill' ? (
              <div className="mb-6">
                <Input
                  value={textAnswer}
                  onChange={(event) => setTextAnswer(event.target.value)}
                  disabled={submitted}
                  placeholder="Type your answer"
                  className="h-12 glass border-white/20"
                />
              </div>
            ) : (
              <div className="mb-6">
                <Textarea
                  value={textAnswer}
                  onChange={(event) => setTextAnswer(event.target.value)}
                  disabled={submitted}
                  placeholder="Write your essay answer"
                  className="min-h-[160px] glass border-white/20"
                />
              </div>
            )}

            {submitted ? (
              <div className={`rounded-xl p-4 mb-6 border ${lastCorrect ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-orange-400/30 bg-orange-500/10'}`}>
                <p className="font-semibold mb-1">{lastCorrect ? 'Correct' : 'Needs improvement'}</p>
                <p className="text-sm text-gray-300 mb-2">{submissionFeedback}</p>
                <p className="text-xs text-gray-400">Reference: {currentQuestion.answer}</p>
              </div>
            ) : null}

            <div className="flex gap-3">
              {!submitted ? (
                <Button onClick={submitCurrentAnswer} disabled={isEvaluating} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold disabled:opacity-50">
                  {isEvaluating ? 'Evaluating with AI...' : 'Submit Answer'}
                </Button>
              ) : (
                <Button onClick={nextQuestion} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold">
                  {currentIndex === quizQuestions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {quizFinished ? (
          <div className="glass-strong rounded-3xl p-8 border border-white/10 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="w-8 h-8 text-amber-400" />
              <h3 className="text-3xl font-bold">Quiz Complete</h3>
            </div>
            <p className="text-xl mb-4">Score: <span className="text-amber-400 font-semibold">{score}/{quizQuestions.length}</span></p>
            <p className="text-gray-300 mb-4">Your daily streak is now <span className="text-amber-400 font-semibold">{quizSnapshot.streak} 🔥</span></p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass rounded-2xl p-5 border border-white/10">
                <h4 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-300" /> Weak Areas</h4>
                {weakAreas.length > 0 ? (
                  <div className="space-y-2">
                    {weakAreas.map((item) => (
                      <p key={item.topic} className="text-sm text-gray-300">{item.topic}: {item.mastery.toFixed(0)}% ({item.attempts} attempts)</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Not enough data yet. Attempt more quizzes to identify weak areas.</p>
                )}
              </div>

              <div className="glass rounded-2xl p-5 border border-white/10">
                <h4 className="font-semibold mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-300" /> Topic Mastery</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {topicMastery.map((item) => (
                    <p key={item.topic} className="text-sm text-gray-300">
                      {item.topic}: {item.attempts > 0 ? `${item.mastery.toFixed(0)}%` : 'No quiz data yet'}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
