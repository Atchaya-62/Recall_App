import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Sparkles, Loader2, ArrowUpRight } from 'lucide-react';
import { useFolders, useVideos } from '@/hooks/useData';
import { Input } from '@/components/ui/input';
import { semanticSearchVideos } from '@/lib/semanticSearch';

const SOURCE_LABELS: Record<'title' | 'summary' | 'notes' | 'folder', string> = {
  title: 'Title match',
  summary: 'Summary match',
  notes: 'Notes match',
  folder: 'Folder match',
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedText(text: string, terms: string[]) {
  const sanitizedTerms = Array.from(
    new Set(
      terms
        .map((term) => term.trim())
        .filter((term) => term.length > 1)
    )
  );

  if (sanitizedTerms.length === 0) return text;

  const pattern = sanitizedTerms
    .sort((a, b) => b.length - a.length)
    .map((term) => escapeRegex(term))
    .join('|');

  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    const isMatch = sanitizedTerms.some(
      (term) => part.toLowerCase() === term.toLowerCase()
    );

    if (isMatch) {
      return (
        <mark
          key={`${part}-${index}`}
          className="bg-amber-400/20 text-amber-200 px-0.5 rounded"
        >
          {part}
        </mark>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

export default function SemanticSearch() {
  const [query, setQuery] = useState('');
  const { data: videos = [], isLoading: videosLoading } = useVideos();
  const { data: folders = [], isLoading: foldersLoading } = useFolders();

  const isLoading = videosLoading || foldersLoading;

  const results = useMemo(
    () => semanticSearchVideos(query, videos, folders, 25),
    [query, videos, folders]
  );
  const baseQueryTerms = useMemo(() => queryTerms(query), [query]);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-strong rounded-3xl p-8 sm:p-12 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-500/20 to-orange-500/20 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <p className="text-sm font-semibold text-amber-400">Semantic Search</p>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              Find Ideas by <span className="text-gradient">Meaning</span>
            </h1>
            <p className="text-gray-300 text-lg mb-6 max-w-2xl">
              Search through your video titles, summaries, and notes with intent-aware ranking.
            </p>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try: spaced repetition, react state, API auth, DSA graphs..."
                className="pl-12 h-14 glass border-white/20 text-base"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Building search index...</p>
          </div>
        ) : query.trim().length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-xl font-semibold mb-2">Start typing to search</p>
            <p className="text-gray-400">Results appear instantly as you type.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-xl font-semibold mb-2">No semantic matches found</p>
            <p className="text-gray-400">Try broader concepts or related terms.</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-300">{results.length} ranked results</p>
              <p className="text-xs text-gray-500">Sorted by semantic relevance</p>
            </div>

            <div className="space-y-4">
              {results.map((result) => (
                <Link
                  key={result.id}
                  to={`/video/${result.videoId}`}
                  className="block glass rounded-2xl p-5 border border-white/10 hover:border-amber-500/40 transition-all duration-200"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold mb-1 hover:text-amber-400 transition-colors">
                        {renderHighlightedText(result.title, [...baseQueryTerms, ...result.matchedTerms])}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {result.folderName ? (
                          <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full">
                            {result.folderName}
                          </span>
                        ) : null}
                        <span className="text-xs text-gray-400">{SOURCE_LABELS[result.matchSource]}</span>
                      </div>
                      <p className="text-gray-300 leading-relaxed">
                        {renderHighlightedText(result.snippet, [...baseQueryTerms, ...result.matchedTerms])}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span>{(result.score * 10).toFixed(1)} relevance</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
