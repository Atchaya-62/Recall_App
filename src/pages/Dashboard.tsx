import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Youtube, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import VideoCard from '@/components/features/VideoCard';
import { useFolders, useVideos, useAllFlashcards } from '@/hooks/useData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Dashboard() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showAllRecentVideos, setShowAllRecentVideos] = useState(false);
  const navigate = useNavigate();

  // Fetch real data using React Query
  const { data: folders = [], isLoading: foldersLoading } = useFolders();
  const { data: videos = [], isLoading: videosLoading } = useVideos();
  const { data: allFlashcards = [], isLoading: flashcardsLoading } = useAllFlashcards();

  const isLoading = foldersLoading || videosLoading || flashcardsLoading;

  const hasReviewData = useMemo(() => allFlashcards.length > 0, [allFlashcards.length]);
  const recentVideos = showAllRecentVideos ? videos : videos.slice(0, 6);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (youtubeUrl.trim()) {
      navigate(`/process?url=${encodeURIComponent(youtubeUrl)}`);
    }
  };

  const getFolderName = (folderId: string | null) => {
    if (!folderId) return undefined;
    return folders.find(f => f.id === folderId)?.name;
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="glass-strong rounded-3xl p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/20 to-orange-500/20 blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="w-6 h-6 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">Transform YouTube Into Knowledge</span>
              </div>

              <h1 className="text-5xl font-bold mb-4">
                Learn Smarter,<br />
                <span className="text-gradient">Remember Better</span>
              </h1>

              <p className="text-xl text-gray-300 mb-8 max-w-2xl">
                Paste any YouTube link. Get AI-generated notes and flashcards in seconds.
                Organize everything. Never forget what you learned.
              </p>

              <form onSubmit={handleSubmit} className="flex gap-3 max-w-2xl">
                <div className="flex-1 relative">
                  <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="url"
                    placeholder="Paste YouTube URL here..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="pl-12 h-14 glass-strong border-white/20 text-lg"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="h-14 px-8 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold text-lg group"
                >
                  Generate Notes
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-spin" />
              <p className="text-gray-400">Loading your data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Recent Videos */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Recent Videos</h2>
                  <p className="text-gray-400">
                    {showAllRecentVideos
                      ? `Showing all videos (${videos.length})`
                      : `Showing latest ${Math.min(6, videos.length)} videos`}
                  </p>
                </div>
              </div>

              {recentVideos.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recentVideos.map(video => (
                      <VideoCard
                        key={video.id}
                        video={video}
                        folderName={getFolderName(video.folderId)}
                      />
                    ))}
                  </div>

                  {videos.length > 6 && (
                    <div className="mt-8 flex justify-center">
                      <Button
                        variant="outline"
                        className="glass border-white/20 hover:bg-white/10"
                        onClick={() => setShowAllRecentVideos((prev) => !prev)}
                      >
                        {showAllRecentVideos ? 'Show Less' : 'Show More'}
                        <ArrowRight className={`ml-2 w-4 h-4 transition-transform ${showAllRecentVideos ? 'rotate-180' : ''}`} />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="glass rounded-2xl p-12 text-center">
                  <Youtube className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">No videos yet</h3>
                  <p className="text-gray-400 mb-6">
                    Start by adding your first YouTube video to get AI-generated notes and flashcards!
                  </p>
                  <Button
                    onClick={() => document.querySelector<HTMLInputElement>('input[type="url"]')?.focus()}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
                  >
                    <Youtube className="w-4 h-4 mr-2" />
                    Add Your First Video
                  </Button>
                </div>
              )}
            </div>

          </>
        )}
      </div>
    </div>
  );
}
