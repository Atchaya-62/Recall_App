import { serve } from 'https://deno.land/std@0.200.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';

type CourseGeneratorInput = {
  topic: string;
  programmingLanguage?: string;
  currentLevel: CourseLevel;
  goal: string;
};

type SeedModule = {
  name: string;
  conceptsCovered: string[];
  difficultyLevel: string;
  expectedOutcome: string;
};

type SeedPlan = {
  title: string;
  overview: string;
  finalOutcome: string;
  modules: SeedModule[];
};

type YoutubeVideoCandidate = {
  id: string;
  title: string;
  description: string;
  channel: string;
  duration: number;
  viewCount: number;
  likeCount: number;
  url: string;
};

type CourseModuleQuiz = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

type FinalModule = SeedModule & {
  id: string;
  videos: YoutubeVideo[];
  quizzes: CourseModuleQuiz[];
};

const PREFERRED_EDUCATORS = [
  'NeetCode',
  'take U forward',
  'Abdul Bari',
  'freeCodeCamp',
  'MIT OpenCourseWare',
  'CS Dojo',
  'Back To Back SWE',
  'Tech With Tim',
  'WilliamFiset',
  'mycodeschool',
  'Khan Academy',
  'Coursera',
  'edX',
  'Udacity',
  'Google Cloud Tech',
  'AWS',
  'Microsoft Learn',
  'IBM',
  'DeepLearning.AI',
  'Stanford Online',
];

serve(async (req) => {
  console.log('[generate-course] Request received, method:', req.method);
  const authHeader = req.headers.get('authorization') || '';
  console.log('[generate-course] TOKEN header present:', authHeader.length > 0);
  console.log('[generate-course] TOKEN bearer undefined:', authHeader.toLowerCase().includes('bearer undefined'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const payload = typeof body === 'string' ? JSON.parse(body) : body;
    const input: CourseGeneratorInput = payload?.input || payload;

    validateInput(input);

    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY') || '';
    if (!youtubeApiKey) {
      throw new Error('Missing YOUTUBE_API_KEY secret in Supabase Edge Function environment.');
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY') || '';
    if (!groqApiKey) {
      throw new Error('Missing GROQ_API_KEY secret in Supabase Edge Function environment.');
    }

    const seedPlan = await buildSeedPlan(input, payload?.masterPrompt, groqApiKey);

    const finalModules: FinalModule[] = [];
    const weakModules: string[] = [];

    for (let index = 0; index < seedPlan.modules.length; index += 1) {
      const module = seedPlan.modules[index];
      const videos = await findVideosForModule(input, module, youtubeApiKey);
      if (videos.length < 1) {
        weakModules.push(module.name);
      }

      finalModules.push({
        id: `module-${index + 1}`,
        ...module,
        videos,
        quizzes: buildConceptQuizzes(module, input),
      });
    }

    if (weakModules.length > Math.min(2, seedPlan.modules.length)) {
      throw new Error(
        `Could not find high-quality YouTube videos for most modules. Found videos for ${seedPlan.modules.length - weakModules.length}/${seedPlan.modules.length} modules. This may indicate the topic is too niche or the YouTube API is having issues.`
      );
    }

    const plan = {
      id: `${slugify(input.topic)}-${Date.now()}`,
      title: seedPlan.title,
      overview: seedPlan.overview,
      modules: finalModules,
      checkpoints: buildCheckpoints(finalModules),
      tracking: {
        completionPercent: 0,
        completedModules: 0,
        totalModules: finalModules.length,
        quizScores: [],
      },
      finalOutcome: seedPlan.finalOutcome,
    };

    return new Response(JSON.stringify({ plan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[generate-course] Error occurred:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[generate-course] Error message:', errorMessage);

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: 'Failed to generate course plan. This may be due to AI service issues or invalid input.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function validateInput(input: CourseGeneratorInput) {
  if (!input || typeof input !== 'object') throw new Error('Missing input payload.');
  if (!String(input.topic || '').trim()) throw new Error('Topic is required.');
  if (!String(input.currentLevel || '').trim()) throw new Error('Current level is required.');
  if (!String(input.goal || '').trim()) throw new Error('Goal is required.');
}

async function buildSeedPlan(input: CourseGeneratorInput, masterPrompt?: string, groqApiKey?: string): Promise<SeedPlan> {
  if (!groqApiKey) {
    console.log('[generate-course] No Groq key provided, using fallback plan');
    return buildFallbackSeedPlan(input);
  }

  const prompt = [
    'You are an expert curriculum designer.',
    'Generate a course structure for the given topic.',
    'Return ONLY valid JSON. Do not include any explanations, markdown, or additional text.',
    'The response must be parseable JSON with no extra content.',
    '',
    `Topic: ${input.topic}`,
    input.programmingLanguage ? `Programming Language: ${input.programmingLanguage}` : '',
    `Current Level: ${input.currentLevel}`,
    `Goal: ${input.goal}`,
    '',
    'Required JSON structure:',
    '{',
    '  "title": "Course Title",',
    '  "overview": "Course overview text",',
    '  "finalOutcome": "What student achieves",',
    '  "modules": [',
    '    {',
    '      "name": "Module Name",',
    '      "conceptsCovered": ["concept1", "concept2"],',
    '      "difficultyLevel": "Beginner/Intermediate/Advanced",',
    '      "expectedOutcome": "What student can do after module"',
    '    }',
    '  ]',
    '}'
  ].filter(Boolean).join('\n');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: 0.25,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an expert curriculum designer. Return only valid JSON matching the requested schema.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  console.log('[generate-course] Groq API response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[generate-course] Groq API error response:', errorText);
    throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  let data;
  try {
    data = await response.json();
    console.log('[generate-course] Groq API response data keys:', Object.keys(data));
  } catch (parseError) {
    console.error('[generate-course] Failed to parse Groq API response as JSON:', parseError);
    throw new Error('Groq API returned invalid JSON response');
  }
  const text = String(data?.choices?.[0]?.message?.content || '');
  console.log('[generate-course] Groq response text length:', text.length);
  console.log('[generate-course] Groq response text preview:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));

  if (!text.trim()) {
    console.error('[generate-course] Groq returned empty response');
    throw new Error('Groq returned empty response');
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content from Groq");
  }

  const parsed = parseJsonFromText(text);
  console.log('[generate-course] Parsed result type:', typeof parsed);
  console.log('[generate-course] Parsed result keys:', parsed ? Object.keys(parsed) : 'null');

  if (!parsed) {
    console.error('[generate-course] Failed to parse Groq response as JSON');
    console.error('[generate-course] Raw text that failed to parse:', text);
    throw new Error('Groq returned response that could not be parsed as JSON');
  }

  if (!Array.isArray(parsed.modules)) {
    console.error('[generate-course] Parsed response missing modules array:', parsed);
    throw new Error('Groq response does not contain a valid modules array');
  }

  if (parsed.modules.length === 0) {
    console.error('[generate-course] Groq response contains empty modules array');
    throw new Error('Groq response contains no modules');
  }

  const modules = parsed.modules
    .map((module: any) => ({
      name: String(module?.name || '').trim(),
      conceptsCovered: Array.isArray(module?.conceptsCovered)
        ? module.conceptsCovered.map((item: unknown) => String(item).trim()).filter(Boolean)
        : [],
      difficultyLevel: String(module?.difficultyLevel || input.currentLevel).trim(),
      expectedOutcome: String(module?.expectedOutcome || '').trim(),
    }))
    .filter((module: SeedModule) => module.name.length > 0)
    .slice(0, input.currentLevel === 'Beginner' ? 8 : input.currentLevel === 'Intermediate' ? 9 : 10);

  if (modules.length === 0) {
    return buildFallbackSeedPlan(input);
  }

  return {
    title: String(parsed.title || `${input.topic} Roadmap${input.programmingLanguage ? ` (${input.programmingLanguage})` : ''}`).trim(),
    overview: String(parsed.overview || `Structured ${input.currentLevel.toLowerCase()} roadmap for ${input.topic}.`).trim(),
    finalOutcome: String(parsed.finalOutcome || `Apply ${input.topic} confidently for ${input.goal}.`).trim(),
    modules: modules.map((module: SeedModule, index: number) => ({
      ...module,
      name: module.name || `${input.topic} Module ${index + 1}`,
      conceptsCovered: module.conceptsCovered.length > 0 ? module.conceptsCovered : [`${input.topic} fundamentals`, input.programmingLanguage ? `${input.programmingLanguage} practice` : `${input.topic} application`],
      expectedOutcome: module.expectedOutcome || `Build practical skills in ${module.name}.`,
    })),
  };
}

function buildFallbackSeedPlan(input: CourseGeneratorInput): SeedPlan {
  const count = input.currentLevel === 'Beginner' ? 8 : input.currentLevel === 'Intermediate' ? 9 : 10;
  const names = [
    `${input.topic} Foundations`,
    `${input.topic} Core Concepts`,
    `${input.topic} Problem Solving Patterns`,
    `${input.topic} Intermediate Techniques`,
    `${input.topic} Applied Practice`,
    `${input.topic} Debugging and Optimization`,
    `${input.topic} Project Build`,
    `${input.topic} Interview/Assessment Prep`,
    `${input.topic} Advanced Patterns`,
    `${input.topic} Capstone`
  ];

  const modules: SeedModule[] = Array.from({ length: count }).map((_, index) => ({
    name: names[index] || `${input.topic} Module ${index + 1}`,
    conceptsCovered: [
      `${input.topic} concept ${index + 1}`,
      input.programmingLanguage ? `${input.programmingLanguage} implementation` : `${input.topic} application`,
      `${input.goal} practice`,
    ],
    difficultyLevel: input.currentLevel,
    expectedOutcome: `Apply ${input.topic} concepts from ${names[index] || `module ${index + 1}`} in realistic tasks.`,
  }));

  return {
    title: `${input.topic} Roadmap${input.programmingLanguage ? ` (${input.programmingLanguage})` : ''}`,
    overview: `A structured ${input.currentLevel.toLowerCase()} roadmap for ${input.topic}, focused on ${input.goal.toLowerCase()}.`,
    finalOutcome: `You will confidently apply ${input.topic}${input.programmingLanguage ? ` using ${input.programmingLanguage}` : ''} for ${input.goal.toLowerCase()}.`,
    modules,
  };
}

async function findVideosForModule(input: CourseGeneratorInput, module: SeedModule, apiKey: string): Promise<YoutubeVideo[]> {
  // More targeted search queries - handle optional programming language
  const baseQuery = `${input.topic} ${module.name}`;
  const queries = [
    input.programmingLanguage ? `${baseQuery} ${input.programmingLanguage} tutorial` : `${baseQuery} tutorial`,
  ];

  const allCandidates: YoutubeVideoCandidate[] = [];

  for (const query of queries) {
    const candidates = await searchAndRankYoutube(query, module, input, apiKey);
    console.log("Candidates value:", candidates);
    if (!Array.isArray(candidates)) {
      console.error("Candidates is not an array:", candidates);
      continue;
    }
    allCandidates.push(...candidates);
  }

  // Remove duplicates and rank all candidates
  const seen = new Set<string>();
  const uniqueCandidates = allCandidates.filter(candidate => {
    if (seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  });

  // Score and rank all candidates
  const scored = uniqueCandidates
    .map(candidate => ({ ...candidate, score: scoreVideo(candidate, module, input) }))
    .sort((a, b) => b.score - a.score);

  const topCandidates = scored.slice(0, 4);

  // Be more flexible - allow 0-2 videos per module
  const selected = topCandidates.slice(0, 2).map(({ score, ...video }) => ({
    title: video.title,
    educator: video.channel,
    url: video.url,
  }));

  // If we don't have enough high-quality videos, include some medium-quality ones
  if (selected.length < 2) {
    const mediumQuality = scored.filter(candidate => candidate.score >= 3 && candidate.score < 8);
    const additional = mediumQuality.slice(0, 2 - selected.length);
    selected.push(...additional.map(({ score, ...video }) => ({
      title: video.title,
      educator: video.channel,
      url: video.url,
    })));
  }

  return selected;
}

async function searchAndRankYoutube(query: string, module: SeedModule, input: CourseGeneratorInput, apiKey: string): Promise<YoutubeVideoCandidate[]> {
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('maxResults', '5'); // Reduced for API quota
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('relevanceLanguage', 'en');
  searchUrl.searchParams.set('safeSearch', 'moderate');
  searchUrl.searchParams.set('order', 'relevance'); // Prioritize relevance
  searchUrl.searchParams.set('key', apiKey);

  const searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) {
    if (searchRes.status === 403) {
      throw new Error('YouTube API quota exceeded or access denied. Please check your API key and billing settings.');
    }
    if (searchRes.status === 400) {
      throw new Error('Invalid YouTube API request. Please check your API key configuration.');
    }
    throw new Error(`YouTube API search failed with status ${searchRes.status}`);
  }
  const searchData = await searchRes.json();

  if (!searchData.items || !Array.isArray(searchData.items) || searchData.items.length === 0) {
    console.warn("No YouTube search results found for query:", query);
    return [];
  }

  const ids = (Array.isArray(searchData?.items) ? searchData.items : [])
    .map((item: any) => String(item?.id?.videoId || '').trim())
    .filter((id: string) => /^[a-zA-Z0-9_-]{11}$/.test(id));

  if (ids.length === 0) return [];

  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  videosUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
  videosUrl.searchParams.set('id', ids.join(','));
  videosUrl.searchParams.set('key', apiKey);

  const videosRes = await fetch(videosUrl.toString());
  if (!videosRes.ok) {
    if (videosRes.status === 403) {
      throw new Error('YouTube API quota exceeded or access denied. Please check your API key and billing settings.');
    }
    if (videosRes.status === 400) {
      throw new Error('Invalid YouTube API request. Please check your API key configuration.');
    }
    throw new Error(`YouTube API videos fetch failed with status ${videosRes.status}`);
  }
  const videosData = await videosRes.json();

  if (!videosData.items || !Array.isArray(videosData.items) || videosData.items.length === 0) {
    console.warn("No YouTube video details found for ids:", ids);
    return [];
  }

  const candidates = (Array.isArray(videosData?.items) ? videosData.items : [])
    .map((item: any) => {
      const id = String(item?.id || '').trim();
      const title = String(item?.snippet?.title || '').trim();
      const description = String(item?.snippet?.description || '').trim();
      const channel = String(item?.snippet?.channelTitle || '').trim();
      const duration = parseDurationToSeconds(String(item?.contentDetails?.duration || ''));
      const viewCount = parseInt(String(item?.statistics?.viewCount || '0'));
      const likeCount = parseInt(String(item?.statistics?.likeCount || '0'));

      return {
        id,
        title,
        description,
        channel,
        duration,
        viewCount,
        likeCount,
        url: `https://www.youtube.com/watch?v=${id}`,
      };
    })
    .filter((item: any) => {
      // Stricter filtering for quality
      return item.id && item.title &&
             item.duration >= 60 && // Minimum 1 minute (relaxed)
             item.duration <= 7200 && // Maximum 2 hours
             item.viewCount >= 100; // Minimum 100 views (relaxed)
    });

  return candidates;
}

function scoreVideo(video: YoutubeVideoCandidate, module: SeedModule, input: CourseGeneratorInput): number {
  let score = 0;
  const title = video.title.toLowerCase();
  const description = video.description.toLowerCase();
  const channel = video.channel.toLowerCase();

  // Base quality score
  if (video.viewCount > 10000) score += 2;  // Popular content
  if (video.likeCount > 100) score += 1;   // Well-liked content
  if (video.duration > 300 && video.duration < 3600) score += 2; // Good length (5-60 min)

  // Content relevance - check both title AND description
  const content = `${title} ${description}`;

  // Programming language match (only if specified)
  if (input.programmingLanguage && content.includes(input.programmingLanguage.toLowerCase())) score += 2;

  // Topic match
  if (content.includes(input.topic.toLowerCase())) score += 3;

  // Module name matching (weighted by specificity)
  const moduleTokens = module.name.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
  let moduleMatches = 0;
  for (const token of moduleTokens) {
    if (content.includes(token)) {
      moduleMatches++;
      score += 2; // +2 per module keyword match
    }
  }

  // Concept coverage (most important)
  let conceptMatches = 0;
  const totalConcepts = module.conceptsCovered.length;
  for (const concept of module.conceptsCovered) {
    const conceptTokens = concept.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
    const conceptCovered = conceptTokens.some(token => content.includes(token));
    if (conceptCovered) {
      conceptMatches++;
      score += 3; // +3 per concept covered
    }
  }

  // Bonus for comprehensive coverage
  if (conceptMatches >= Math.min(2, totalConcepts)) score += 2;
  if (conceptMatches >= Math.min(3, totalConcepts)) score += 3;

  // Educator quality bonus
  if (PREFERRED_EDUCATORS.some((name) => channel.includes(name.toLowerCase()))) score += 4;

  // Level appropriateness
  if (input.currentLevel === 'Beginner' && (title.includes('beginner') || title.includes('introduction') || title.includes('basics'))) score += 2;
  if (input.currentLevel === 'Advanced' && (title.includes('advanced') || title.includes('expert'))) score += 2;

  // Penalties for irrelevant content
  if (title.includes('full course') || title.includes('complete series') || title.includes('8 hour')) score -= 2;
  if (video.duration > 7200) score -= 1; // Too long
  if (video.duration < 180) score -= 1;  // Too short

  // Penalty for misleading titles (contains keywords but description doesn't match)
  const titleHasKeywords = moduleTokens.some(token => title.includes(token));
  const descHasKeywords = moduleTokens.some(token => description.includes(token));
  if (titleHasKeywords && !descHasKeywords) score -= 2; // Misleading title

  return score;
}

function dedupeVideos(videos: YoutubeVideo[]): YoutubeVideo[] {
  const seen = new Set<string>();
  return videos.filter((video) => {
    const idMatch = String(video.url || '').match(/v=([a-zA-Z0-9_-]{11})/);
    const id = idMatch?.[1] || video.url;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function parseDurationToSeconds(isoDuration: string): number {
  const match = isoDuration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function buildConceptQuizzes(module: SeedModule, input: CourseGeneratorInput): CourseModuleQuiz[] {
  const concepts = module.conceptsCovered.length > 0 ? module.conceptsCovered : [`${input.topic} fundamentals`];
  const primary = concepts[0];
  const secondary = concepts[1] || primary;
  const tertiary = concepts[2] || secondary;

  return [
    {
      question: `Which concept is a core part of ${module.name}?`,
      options: uniqueOptions([primary, `${input.topic} marketing strategy`, `${input.topic} history trivia`, `${input.topic} UI theme selection`]),
      correctAnswer: primary,
      explanation: `${primary} is explicitly listed in concepts covered.`
    },
    {
      question: `What is the best expected outcome for ${module.name}?`,
      options: uniqueOptions([
        module.expectedOutcome,
        'Only memorize creator names without practice.',
        'Skip implementation and avoid coding exercises.',
        'Ignore concepts and focus on unrelated tools.',
      ]),
      correctAnswer: module.expectedOutcome,
      explanation: 'Expected outcome comes directly from the module plan.'
    },
    {
      question: `Which concept pair best matches ${module.name}?`,
      options: uniqueOptions([
        `${primary} + ${secondary}`,
        `${input.topic} sales + branding`,
        input.programmingLanguage ? `${input.programmingLanguage} syntax only + no concepts` : `${input.topic} theory only + no practice`,
        `Random browsing + no structured practice`,
      ]),
      correctAnswer: `${primary} + ${secondary}`,
      explanation: 'This pair is derived from the module concept list.'
    },
    {
      question: `For ${module.name}, what should you practice first?`,
      options: uniqueOptions([
        `Hands-on exercises on ${primary}`,
        'Only watch without taking notes.',
        'Skip coding practice entirely.',
        'Study unrelated domains first.',
      ]),
      correctAnswer: `Hands-on exercises on ${primary}`,
      explanation: 'Concept mastery requires direct practice.'
    },
    {
      question: `Which concept is also covered in ${module.name}?`,
      options: uniqueOptions([secondary, tertiary, `${input.topic} unrelated legal policy`, `${input.topic} logo design`]),
      correctAnswer: secondary,
      explanation: `${secondary} is one of the module concepts.`
    },
  ];
}

function uniqueOptions(options: string[]): string[] {
  const set = new Set(options.map((item) => item.trim()).filter(Boolean));
  const values = Array.from(set);
  while (values.length < 4) {
    values.push(`Concept ${values.length + 1}`);
  }
  return values.slice(0, 4);
}

function buildCheckpoints(modules: FinalModule[]) {
  return modules
    .filter((_, index) => (index + 1) % 2 === 0)
    .map((module, index) => ({
      title: `Checkpoint ${index + 1}`,
      afterModule: modules.findIndex((item) => item.id === module.id) + 1,
      quizTopics: module.conceptsCovered.slice(0, 3),
      practiceSuggestions: [`Solve 5 practice problems on ${module.conceptsCovered[0] || module.name}`],
    }));
}

function parseJsonFromText(value: string): Record<string, any> | null {
  const text = String(value || '').trim();
  if (!text) return null;

  // Try direct JSON parsing first
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch {
    // Continue to other parsing methods
  }

  // Look for JSON in markdown code blocks
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    try {
      const parsed = JSON.parse(fencedMatch[1].trim());
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch {
      // Continue
    }
  }

  // Try to extract JSON object from text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch {
      // Continue
    }
  }

  // Last resort: try to find and parse any JSON-like content
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  for (const line of lines) {
    if (line.startsWith('{') && line.endsWith('}')) {
      try {
        const parsed = JSON.parse(line);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      } catch {
        // Continue
      }
    }
  }

  return null;
}

function slugify(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
