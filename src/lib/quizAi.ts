import { GoogleGenerativeAI } from '@google/generative-ai';

export interface EssayEvaluation {
  score: number;
  isCorrect: boolean;
  feedback: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function extractJson(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

export async function gradeEssayWithAI(input: {
  question: string;
  referenceAnswer: string;
  userAnswer: string;
  topic: string;
}): Promise<EssayEvaluation | null> {
  const apiKey = import.meta.env.VITE_GOOGLE_AI_KEY as string | undefined;
  if (!apiKey) return null;

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = [
      'You are grading a learning quiz essay answer.',
      'Grade conceptual understanding instead of exact phrase matching.',
      'Return strict JSON only with fields: score (0-100 integer), feedback (short string).',
      `Topic: ${input.topic}`,
      `Question: ${input.question}`,
      `Reference Answer: ${input.referenceAnswer}`,
      `User Answer: ${input.userAnswer}`,
    ].join('\n');

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsedText = extractJson(raw);
    if (!parsedText) return null;

    const parsed = JSON.parse(parsedText) as { score?: number; feedback?: string };
    const score = clamp(Math.round(Number(parsed.score || 0)), 0, 100);
    const feedback = (parsed.feedback || 'Answer evaluated with AI feedback.').trim();

    return {
      score,
      isCorrect: score >= 60,
      feedback,
    };
  } catch {
    return null;
  }
}
