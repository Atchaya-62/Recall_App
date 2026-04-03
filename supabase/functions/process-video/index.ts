import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessingRequest {
  videoId: string;
  youtubeUrl: string;
}

interface GeneratedContent {
  folderName: string;
  refinedTitle: string;
  summary: string;
  notes: Array<{
    heading: string;
    content: string;
  }>;
  flashcards: Array<{
    question: string;
    answer: string;
  }>;
}

interface VideoOwnerRecord {
  user_id: string;
  youtube_url: string;
  title?: string;
}

function normalizeProviderError(status: number, body: string, model: string): string {
  const lowerBody = body.toLowerCase();

  if (status === 429 || lowerBody.includes('resource_exhausted') || lowerBody.includes('quota')) {
    return 'AI usage limit reached right now. Please try again later, or check Google AI billing and quota settings.';
  }

  if (status === 403) {
    return 'Google AI request was denied. Verify your API key and project permissions.';
  }

  if (status === 404) {
    return `Model ${model} is unavailable in this project/region.`;
  }

  return `Google AI API error (${status}) while using model ${model}.`;
}

function normalizeGroqError(status: number, body: string, model: string): string {
  const lowerBody = body.toLowerCase();

  if (status === 429 || lowerBody.includes('rate') || lowerBody.includes('quota')) {
    return 'Groq rate limit reached right now. Please try again shortly.';
  }

  if (status === 401 || status === 403) {
    return 'Groq request was denied. Verify GROQ_API_KEY and model access.';
  }

  if (status === 404) {
    return `Groq model ${model} is unavailable.`;
  }

  return `Groq API error (${status}) while using model ${model}.`;
}

serve(async (req) => {
  console.log('[process-video] Request received, method:', req.method);
  const authHeader = req.headers.get('authorization') || '';
  console.log('[process-video] TOKEN header present:', authHeader.length > 0);
  console.log('[process-video] TOKEN bearer undefined:', authHeader.toLowerCase().includes('bearer undefined'));
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let requestBody: ProcessingRequest | null = null;

  try {
    console.log('[process-video] Parsing request body...');
    requestBody = await req.json();
    const { videoId, youtubeUrl } = requestBody;

    console.log('[process-video] Request parsed - videoId:', videoId, 'URL present:', !!youtubeUrl);
    if (!videoId || !youtubeUrl) {
      throw new Error('Missing required fields: videoId and youtubeUrl');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: videoRow, error: videoLookupError } = await supabaseClient
      .from('videos')
      .select('user_id, youtube_url, title')
      .eq('id', videoId)
      .single<VideoOwnerRecord>();

    if (videoLookupError || !videoRow) {
      throw new Error('Video not found for processing');
    }

    const ownerUserId = videoRow.user_id;

    await updateProcessingStatus(supabaseClient, videoId, ownerUserId, 'extracting', 'Analyzing video for categorization...', 10);

    // Extract video description early for faster folder naming
    let videoDescription = '';
    try {
      const pageContext = await extractVideoContextFromPage(youtubeUrl || videoRow.youtube_url);
      const descMatch = pageContext.match(/Description:\s*(.+)/);
      if (descMatch) {
        videoDescription = descMatch[1].slice(0, 1000); // Use first 1000 chars
      }
    } catch (error) {
      console.warn('[process-video] Could not extract description, will use default categorization');
    }

    // Try to generate specific folder name from description using Groq
    let preferredFolderName = '';
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (groqApiKey && videoDescription) {
      preferredFolderName = await generateFolderNameFromDescription(videoRow.title || null, videoDescription, groqApiKey);
    }

    await updateProcessingStatus(supabaseClient, videoId, ownerUserId, 'extracting', 'Extracting video transcript...', 20);

    const sourceText = await buildKnowledgeSource(youtubeUrl || videoRow.youtube_url);

    await updateProcessingStatus(supabaseClient, videoId, ownerUserId, 'generating', 'Generating summary and notes...', 50);

    const content = await generateContent(sourceText, videoRow.title || null);

    // Use description-based folder name if available, otherwise fall back to AI-generated name
    const finalFolderName = preferredFolderName || content.folderName;
    const resolvedFolderId = await resolveFolderByName(supabaseClient, ownerUserId, finalFolderName);

    await updateProcessingStatus(supabaseClient, videoId, ownerUserId, 'generating', 'Saving results...', 70);

    const { error: videoUpdateError } = await supabaseClient
      .from('videos')
      .update({
        folder_id: resolvedFolderId,
        title: content.refinedTitle,
        summary: content.summary,
        notes: content.notes.map(formatNoteForStorage),
      })
      .eq('id', videoId)
      .eq('user_id', ownerUserId);

    if (videoUpdateError) throw videoUpdateError;

    const { error: deleteFlashcardsError } = await supabaseClient
      .from('flashcards')
      .delete()
      .eq('video_id', videoId);

    if (deleteFlashcardsError) throw deleteFlashcardsError;

    const safeFlashcards = (content.flashcards || []).filter((fc) => fc?.question && fc?.answer);
    if (safeFlashcards.length > 0) {
      const { error: flashcardsError } = await supabaseClient
        .from('flashcards')
        .insert(
          safeFlashcards.map((fc) => ({
            video_id: videoId,
            question: fc.question,
            answer: fc.answer,
            mastered: false,
          }))
        );

      if (flashcardsError) throw flashcardsError;
    }

    await updateProcessingStatus(supabaseClient, videoId, ownerUserId, 'complete', 'Processing complete!', 100);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Processing complete!',
        folderName: finalFolderName,
        refinedTitle: content.refinedTitle,
        notesCount: content.notes.length,
        flashcardsCount: safeFlashcards.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing video:', error);

    try {
      const videoId = requestBody?.videoId;
      if (videoId) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          { auth: { persistSession: false } }
        );

        const { data: row } = await supabaseClient
          .from('videos')
          .select('user_id')
          .eq('id', videoId)
          .single<{ user_id: string }>();

        if (row?.user_id) {
          await updateProcessingStatus(
            supabaseClient,
            videoId,
            row.user_id,
            'error',
            'Processing failed',
            0,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
    } catch (statusError) {
      console.error('Error updating status:', statusError);
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An error occurred during processing',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function updateProcessingStatus(
  client: any,
  videoId: string,
  userId: string,
  stage: string,
  message: string,
  progress: number,
  error?: string
) {
  const { error: statusError } = await client
    .from('video_processing')
    .upsert({
      video_id: videoId,
      user_id: userId,
      stage,
      message,
      progress,
      error: error || null,
      updated_at: new Date().toISOString(),
    });

  if (statusError) {
    console.error('Error updating processing status:', statusError);
  }
}

async function extractTranscript(youtubeUrl: string): Promise<string> {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
  if (!watchRes.ok) {
    throw new Error('Failed to load YouTube page for transcript extraction');
  }

  const watchHtml = await watchRes.text();
  const playerResponse = extractJsonObjectAfterMarker(watchHtml, 'ytInitialPlayerResponse = ');
  const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  if (!Array.isArray(captionTracks) || captionTracks.length === 0) {
    throw new Error('No captions available for this video. Choose a video with captions enabled.');
  }

  const preferredTrack =
    captionTracks.find((track: any) => track.languageCode === 'en' && track.kind !== 'asr') ||
    captionTracks.find((track: any) => track.languageCode === 'en') ||
    captionTracks[0];

  if (!preferredTrack?.baseUrl) {
    throw new Error('Caption track URL not found');
  }

  const captionUrl = decodeYouTubeEscapes(String(preferredTrack.baseUrl));
  const transcriptRes = await fetch(`${captionUrl}&fmt=json3`);
  if (!transcriptRes.ok) {
    throw new Error('Failed to download caption track');
  }

  const transcriptJson = await transcriptRes.json();
  const events = Array.isArray(transcriptJson?.events) ? transcriptJson.events : [];
  const lines: string[] = [];

  for (const event of events) {
    if (!Array.isArray(event?.segs)) continue;

    const line = event.segs
      .map((seg: any) => String(seg?.utf8 || ''))
      .join('')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (line) lines.push(line);
  }

  const transcript = lines.join(' ').trim();
  if (transcript.length < 200) {
    throw new Error('Transcript is too short to generate detailed notes and flashcards.');
  }

  return transcript.slice(0, 120000);
}

async function buildKnowledgeSource(youtubeUrl: string): Promise<string> {
  try {
    const transcript = await extractTranscript(youtubeUrl);
    return `SOURCE_TYPE: transcript\n\n${transcript}`;
  } catch (transcriptError) {
    console.warn('Transcript extraction failed, using page context fallback:', transcriptError);
  }

  try {
    const pageContext = await extractVideoContextFromPage(youtubeUrl);
    if (pageContext.length >= 40) {
      return `SOURCE_TYPE: metadata_page\n\n${pageContext}`;
    }
  } catch (pageContextError) {
    console.warn('Page context extraction failed, using oEmbed fallback:', pageContextError);
  }

  try {
    const oembedContext = await extractVideoContextFromOEmbed(youtubeUrl);
    if (oembedContext.length >= 20) {
      return `SOURCE_TYPE: metadata_oembed\n\n${oembedContext}`;
    }
  } catch (oembedError) {
    console.warn('oEmbed context extraction failed, using minimal fallback:', oembedError);
  }

  const fallbackVideoId = extractVideoId(youtubeUrl) || 'unknown-video';
  return `SOURCE_TYPE: minimal\n\nVideo URL: ${youtubeUrl}\nVideo ID: ${fallbackVideoId}`;
}

async function extractVideoContextFromPage(youtubeUrl: string): Promise<string> {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
  if (!watchRes.ok) {
    throw new Error('Failed to load YouTube page for context extraction');
  }

  const watchHtml = await watchRes.text();
  const playerResponse = extractJsonObjectAfterMarker(watchHtml, 'ytInitialPlayerResponse = ');

  const title = String(playerResponse?.videoDetails?.title || '').trim();
  const shortDescription = String(playerResponse?.videoDetails?.shortDescription || '').trim();
  const author = String(playerResponse?.videoDetails?.author || '').trim();

  return [
    title ? `Title: ${title}` : '',
    author ? `Channel: ${author}` : '',
    shortDescription ? `Description: ${shortDescription}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 120000);
}

async function extractVideoContextFromOEmbed(youtubeUrl: string): Promise<string> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`;
  const res = await fetch(oembedUrl);
  if (!res.ok) {
    throw new Error('Failed to load oEmbed metadata');
  }

  const data = await res.json();
  const title = String(data?.title || '').trim();
  const author = String(data?.author_name || '').trim();

  return [
    title ? `Title: ${title}` : '',
    author ? `Channel: ${author}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 120000);
}

async function resolveFolderByName(client: any, userId: string, folderNameRaw: string): Promise<string | null> {
  const folderName = sanitizeFolderName(folderNameRaw);

  const { data: folders, error } = await client
    .from('folders')
    .select('id, name')
    .eq('user_id', userId);

  if (error) throw error;

  const normalizedTarget = normalizeTextForFolder(folderName);
  const existing = (folders || []).find((folder: any) => normalizeTextForFolder(String(folder.name || '')) === normalizedTarget);
  if (existing) {
    return existing.id;
  }

  const color = pickFolderColor(folderName);
  const { data: createdFolder, error: createError } = await client
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

function normalizeTextForFolder(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeFolderName(input: string): string {
  const cleaned = String(input || '')
    .replace(/[^a-zA-Z0-9\s&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return 'Inbox';
  }

  const words = cleaned.split(' ').slice(0, 4);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
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

async function generateFolderNameFromDescription(
  videoTitle: string | null,
  videoDescription: string | null,
  groqApiKey: string
): Promise<string> {
  const prompt = `You are a content categorization expert. Analyze the video title and description to determine the SPECIFIC learning topic.

VIDEO TITLE: ${videoTitle || 'Unknown'}
VIDEO DESCRIPTION: ${videoDescription || 'No description available'}

RULE: Return ONLY a valid JSON object (no markdown, no code blocks, no extra text).
Return a SPECIFIC, narrow topic name that reflects the actual content (not generic categories).

Examples of GOOD topic names:
- "Message Queue Patterns" (not just "Backend")
- "RAG Systems Architecture" (not "AI" or "Machine Learning")
- "React Hooks Deep Dive" (not "React" or "Frontend")
- "JWT Token Validation" (not "Security")

OUTPUT FORMAT (must be valid JSON):
{
  "folder_name": "specific, narrow topic (2-4 words max)"
}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are an expert at categorizing educational content. Return ONLY valid JSON with no markdown formatting.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn('[process-video] Folder naming failed:', response.status, normalizeGroqError(response.status, body, 'llama-3.1-8b-instant'));
      return '';
    }

    const data = await response.json();
    const generatedText = data?.choices?.[0]?.message?.content || '';

    if (!generatedText) {
      console.warn('[process-video] Folder name generation returned empty response');
      return '';
    }

    const parsed = JSON.parse(
      generatedText.replace(/```json/gi, '').replace(/```/g, '').trim()
    );
    const folderName = String(parsed?.folder_name || '').trim();

    if (folderName && folderName.length > 2) {
      console.log('[process-video] Generated folder name:', folderName);
      return folderName;
    }

    return '';
  } catch (error) {
    console.warn('[process-video] Exception during folder naming:', error);
    return '';
  }
}

async function generateContent(sourceText: string, videoTitle: string | null): Promise<GeneratedContent> {
  const googleAiKey = Deno.env.get('GOOGLE_AI_KEY');
  const groqApiKey = Deno.env.get('GROQ_API_KEY');

  if (!googleAiKey && !groqApiKey) {
    throw new Error('Missing AI provider key. Set GOOGLE_AI_KEY and/or GROQ_API_KEY in Supabase Edge Function secrets.');
  }

  const modelCandidates = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-002',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ];

  const prompt = `You are an expert technical tutor.

Your task is to analyze the transcript/content and generate HIGH-QUALITY study material strictly based on the ACTUAL TOPIC of the video.

INPUT:
- Video title (may be noisy or clickbait): ${videoTitle || 'Unknown title'}
- Transcript/content source text

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "folder_name": "short, specific topic label (2-4 words max)",
  "refined_title": "professional title that reflects the true topic",
  "summary": "4-5 concise lines capturing only the core concept",
  "notes": [
    {
      "heading": "topic-relevant section heading",
      "content": "detailed multi-line study notes in markdown style; may include bullet lists, numbered steps, markdown tables, and fenced code blocks when applicable"
    }
  ],
  "flashcards": [
    {
      "question": "direct technical concept-check / interview-style question",
      "answer": "precise technical answer"
    }
  ]
}

HARD RULES:
1. Focus ONLY on concept mastery, technical understanding, and exam/interview preparation.
2. Do NOT generate opinion/reflection questions. Forbidden patterns include: "What do you think?", "How did you feel?", "What assumptions are made?".
3. Notes must be tightly topic-specific and avoid generic learning advice.
4. Notes must feel like complete review notes written by someone who fully watched the video.
5. Cover what was taught, what was built, and how it was built step-by-step.
6. Include concrete implementation details from the video: setup, commands, files/components, logic flow, outputs, and caveats when present.
7. If the video includes code, include relevant code snippets in fenced code blocks.
8. If the video includes workflows/flow diagrams, represent them as clear step-by-step flow or markdown table.
9. Use markdown tables for definitions/comparisons/complexities/timelines when helpful.
10. Prefer concrete details from the video over abstract definitions.
11. Do not invent content that was not in the video.
12. Produce 8-14 high-value note sections (not tiny one-liners).
13. Flashcards must be 10-15 total, high quality, and directly based on the topic.
14. Flashcards should cover definitions, properties, algorithm flow, complexity, comparisons, edge cases, and practical usage when relevant.
15. Remove fluff, avoid vague wording, and prioritize precision.
16. If transcript is noisy, infer the most likely technical topic and still produce useful structured output.

IMPORTANT:
- Return ONLY valid JSON.
- No markdown.
- No extra keys.

TRANSCRIPT SOURCE:
${sourceText}`;

  let generatedText: string | null = null;
  const providerErrors: string[] = [];

  // Try Groq first (free-tier, no quota limits)
  if (groqApiKey) {
    const preferredGroqModel = Deno.env.get('GROQ_MODEL');
    const groqModels = preferredGroqModel
      ? [preferredGroqModel]
      : ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];

    const groqResult = await generateWithGroq(prompt, groqApiKey, groqModels);
    generatedText = groqResult.text;
    if (groqResult.error) {
      providerErrors.push(groqResult.error);
    }
  }

  // Fallback to Google AI if Groq fails
  if (!generatedText && googleAiKey) {
    const googleResult = await generateWithGoogle(prompt, googleAiKey, modelCandidates);
    generatedText = googleResult.text;
    if (googleResult.error) {
      providerErrors.push(googleResult.error);
    }
  }

  if (!generatedText) {
    throw new Error(
      `No content generated by AI. ${providerErrors.filter(Boolean).join(' | ') || 'All configured providers failed.'}`.trim()
    );
  }

  const content = parseModelJson(generatedText);

  if (!content.summary || !Array.isArray(content.notes) || !Array.isArray(content.flashcards)) {
    throw new Error('Invalid content structure from AI');
  }

  return ensureMinimumContent(content, sourceText);
}

async function generateWithGoogle(
  prompt: string,
  googleAiKey: string,
  modelCandidates: string[]
): Promise<{ text: string | null; error: string | null }> {
  let generatedText: string | null = null;
  let lastError: string | null = null;

  for (const model of modelCandidates) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleAiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const normalizedError = normalizeProviderError(response.status, body, model);
      lastError = normalizedError;

      // Try the next model if this one fails; caller can fallback to another provider.
      continue;
    }

    const data = await response.json();
    generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;

    if (generatedText) {
      break;
    }

    lastError = `Model ${model}: empty content`;
  }

  return { text: generatedText, error: lastError };
}

async function generateWithGroq(
  prompt: string,
  groqApiKey: string,
  models: string[]
): Promise<{ text: string | null; error: string | null }> {
  let generatedText: string | null = null;
  let lastError: string | null = null;

  for (const model of models) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are an expert technical note-taker. Return only strict JSON matching the requested schema.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      lastError = normalizeGroqError(response.status, body, model);
      continue;
    }

    const data = await response.json();
    generatedText = data?.choices?.[0]?.message?.content || null;

    if (generatedText) {
      break;
    }

    lastError = `Groq model ${model}: empty content`;
  }

  return { text: generatedText, error: lastError };
}

function extractImplementationNotesFromSource(sourceText: string, topic: string): string[] {
  const cleanedSource = sourceText
    .replace(/SOURCE_TYPE:\s*[^\n]+/gi, '')
    .replace(/\r/g, '\n');

  const rawLines = cleanedSource
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 24)
    .filter((line) => !/^https?:\/\//i.test(line))
    .filter((line) => !/^video (url|id):/i.test(line));

  const stepKeywords = /\b(build|built|create|created|setup|set up|install|configure|implement|code|step|first|next|then|finally|deploy|run|test|add|integrat|connect|initialize)\b/i;

  const prioritized = rawLines.filter((line) => stepKeywords.test(line));
  const fallbackPool = prioritized.length > 0 ? prioritized : rawLines;

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const line of fallbackPool) {
    const normalized = line.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(line);
    if (unique.length >= 10) {
      break;
    }
  }

  if (unique.length === 0) {
    return [
      `${topic}: The transcript did not expose enough implementation detail; regenerate content with a richer transcript if possible.`,
    ];
  }

  return unique.map((line, index) => `Step ${index + 1}: ${line.slice(0, 220)}`);
}

function normalizeNoteForCompare(note: string): string {
  return note
    .toLowerCase()
    .replace(/step\s*\d+\s*:/g, 'step:')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLowSignalNote(note: string): boolean {
  const cleaned = note.trim();
  const normalized = normalizeNoteForCompare(cleaned);

  if (!normalized || normalized.length < 24) {
    return true;
  }

  if (/^step\s*\d+\s*:\s*title\s*:/i.test(cleaned)) {
    return true;
  }

  if (/^(title|heading)\s*:/i.test(cleaned)) {
    return true;
  }

  if (/\b(what do you think|how did you feel|assumptions are made)\b/i.test(normalized)) {
    return true;
  }

  // Reject notes that are mostly just repeated title/fundamentals boilerplate.
  if (/\bvibe coding fundamentals in\b/i.test(normalized) && normalized.split(' ').length <= 8) {
    return true;
  }

  return false;
}

function uniqueTechnicalNotes(notes: Array<{ heading: string; content: string }>): Array<{ heading: string; content: string }> {
  const unique: Array<{ heading: string; content: string }> = [];
  const normalizedSeen: string[] = [];

  for (const note of notes) {
    const heading = String(note.heading || '').trim();
    const content = String(note.content || '').trim();
    const combined = `${heading}\n${content}`.trim();

    if (isLowSignalNote(combined)) {
      continue;
    }

    const normalized = normalizeNoteForCompare(combined);
    const isDuplicate = normalizedSeen.some((existing) =>
      existing === normalized || existing.includes(normalized) || normalized.includes(existing)
    );

    if (isDuplicate) {
      continue;
    }

    normalizedSeen.push(normalized);
    unique.push({ heading, content });
  }

  return unique;
}

function ensureMinimumContent(content: GeneratedContent, sourceText: string): GeneratedContent {
  const MIN_NOTES = 8;
  const MAX_NOTES = 16;
  const MIN_FLASHCARDS = 10;
  const MAX_FLASHCARDS = 15;

  const notes = uniqueTechnicalNotes(content.notes.filter((note) => Boolean(note?.heading || note?.content)));
  const flashcards = [...content.flashcards].filter((fc) => fc?.question && fc?.answer);

  const topic = String(content.refinedTitle || content.folderName || 'the topic').trim();

  const fallbackNotes = uniqueTechnicalNotes(
    extractImplementationNotesFromSource(sourceText, topic).map((line, index) => ({
      heading: `Step ${index + 1}`,
      content: line,
    }))
  );

  for (const fallbackNote of fallbackNotes) {
    if (notes.length >= MIN_NOTES) {
      break;
    }

    const merged = uniqueTechnicalNotes([...notes, fallbackNote]);
    if (merged.length > notes.length) {
      notes.push(fallbackNote);
    }
  }

  if (notes.length === 0) {
    notes.push({
      heading: 'No detailed notes recovered',
      content: `${topic}: Could not extract enough implementation details from the transcript. Try a clearer transcript or a longer source.`,
    });
  }

  const fallbackFlashcards = [
    {
      question: `What is the formal definition of ${topic}?`,
      answer: `${topic} is the core concept addressed in the video; define it by objective, inputs, process, and expected output.`,
    },
    {
      question: `What problem does ${topic} solve, and what are its prerequisites?`,
      answer: `It solves a specific technical problem in this domain and requires understanding foundational terms, data flow, and constraints.`,
    },
    {
      question: `What is the algorithm or workflow sequence for ${topic}?`,
      answer: `Break the process into ordered steps: setup, execution, validation, and output handling.`,
    },
    {
      question: `What are the key properties or invariants associated with ${topic}?`,
      answer: `Identify conditions that remain true during execution and guarantees provided by the method.`,
    },
    {
      question: `What are the time and space complexity characteristics of ${topic} (if applicable)?`,
      answer: `State average/worst-case performance and memory usage, including what factors influence them.`,
    },
    {
      question: `How does ${topic} compare with alternative approaches?`,
      answer: `Compare by correctness, complexity, scalability, and implementation trade-offs.`,
    },
    {
      question: `What edge cases must be handled when implementing ${topic}?`,
      answer: `Handle empty inputs, null/invalid states, boundary values, and pathological data distributions.`,
    },
    {
      question: `What are common implementation mistakes in ${topic}?`,
      answer: `Typical mistakes include violating assumptions, incorrect state updates, and missing boundary checks.`,
    },
    {
      question: `How can you validate correctness for ${topic}?`,
      answer: `Use representative test cases, edge-case tests, and expected-output assertions for each step.`,
    },
    {
      question: `Where is ${topic} used in real-world systems?`,
      answer: `It is used where the same core problem appears in production workflows requiring reliability and performance.`,
    },
  ];

  while (flashcards.length < MIN_FLASHCARDS) {
    const fallback = fallbackFlashcards[flashcards.length % fallbackFlashcards.length];
    flashcards.push(fallback);
  }

  const safeSummary = content.summary?.trim()
    ? content.summary.trim()
    : 'This video covers the core topic, key concepts, and practical steps needed to apply the material effectively.';

  const safeFolderName = sanitizeFolderName(content.folderName || 'Inbox');
  const safeRefinedTitle = String(content.refinedTitle || '').trim() || 'Learning Notes from Video';

  return {
    folderName: safeFolderName,
    refinedTitle: safeRefinedTitle,
    summary: safeSummary,
    notes: notes.slice(0, MAX_NOTES),
    flashcards: flashcards.slice(0, MAX_FLASHCARDS),
  };
}

function formatNoteForStorage(note: { heading: string; content: string }): string {
  const heading = String(note.heading || '').trim();
  const content = String(note.content || '').trim();

  if (!heading && !content) {
    return '';
  }

  if (!heading) {
    return content;
  }

  if (!content) {
    return `### ${heading}`;
  }

  return `### ${heading}\n${content}`;
}

function parseModelJson(rawText: string): GeneratedContent {
  const cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Model returned non-JSON response');
  }

  const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));

  const parsedSummary = parsed.summary;
  const summaryAsString = Array.isArray(parsedSummary)
    ? parsedSummary
        .map((line: unknown) => String(line || '').trim())
        .filter(Boolean)
        .map((line: string) => (line.startsWith('-') ? line : `- ${line}`))
        .slice(0, 5)
        .join('\n')
    : String(parsedSummary || '').trim();

  const parsedNotes = Array.isArray(parsed.notes)
    ? parsed.notes
        .map((item: any, index: number) => {
          if (typeof item === 'string') {
            const text = String(item || '').trim();
            if (!text) return null;
            return {
              heading: `Note ${index + 1}`,
              content: text,
            };
          }

          const heading = String(item?.heading || '').trim();
          const content = String(item?.content || '').trim();
          if (!heading && !content) return null;
          return {
            heading: heading || `Note ${index + 1}`,
            content,
          };
        })
        .filter(Boolean)
    : [];

  return {
    folderName: String(parsed.folder_name || '').trim() || 'Inbox',
    refinedTitle: String(parsed.refined_title || '').trim() || 'Learning Notes from Video',
    summary: summaryAsString,
    notes: parsedNotes,
    flashcards: Array.isArray(parsed.flashcards)
      ? parsed.flashcards
          .map((fc: any) => ({
            question: String(fc?.question || '').trim(),
            answer: String(fc?.answer || '').trim(),
          }))
          .filter((fc: { question: string; answer: string }) => fc.question && fc.answer)
      : [],
  };
}

function decodeYouTubeEscapes(value: string): string {
  return value.replace(/\\u0026/g, '&').replace(/\\u003d/g, '=').replace(/\\\//g, '/');
}

function extractJsonObjectAfterMarker(source: string, marker: string): any {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error('YouTube player metadata not found');
  }

  const jsonStart = source.indexOf('{', markerIndex);
  if (jsonStart === -1) {
    throw new Error('YouTube player response JSON start not found');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = jsonStart; i < source.length; i++) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return JSON.parse(source.slice(jsonStart, i + 1));
      }
    }
  }

  throw new Error('YouTube player response JSON parse failed');
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
