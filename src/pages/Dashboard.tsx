import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Youtube, Sparkles, ArrowRight, Loader2, Target, Brain } from 'lucide-react';
import VideoCard from '@/components/features/VideoCard';
import { useFolders, useVideos, useAllFlashcards } from '@/hooks/useData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getDailyQuizSnapshot } from '@/lib/dailyQuiz';

export default function Dashboard() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showAllRecentVideos, setShowAllRecentVideos] = useState(false);
  const navigate = useNavigate();

  // Fetch real data using React Query
  const { data: folders = [], isLoading: foldersLoading } = useFolders();
  const { data: videos = [], isLoading: videosLoading } = useVideos();
  const { data: allFlashcards = [], isLoading: flashcardsLoading } = useAllFlashcards();

  const isLoading = foldersLoading || videosLoading || flashcardsLoading;

  const quizSnapshot = useMemo(() => getDailyQuizSnapshot(), []);
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
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="glass-strong rounded-3xl p-5 sm:p-8 lg:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/20 to-orange-500/20 blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center space-x-2 mb-4">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
                <span className="text-sm sm:text-base font-semibold text-amber-400">Transform YouTube Into Knowledge</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl leading-tight font-bold mb-4">
                Learn Smarter,<br />
                <span className="text-gradient">Remember Better</span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-300 mb-6 sm:mb-8 max-w-2xl">
                Paste any YouTube link. Get AI-generated notes and flashcards in seconds.
                Organize everything. Never forget what you learned.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-2xl">
                <div className="flex-1 min-w-0 relative">
                  <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="url"
                    placeholder="Paste YouTube URL here..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="pl-12 h-12 sm:h-14 glass-strong border-white/20 text-base sm:text-lg"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold text-base sm:text-lg group"
                >
                  Generate Notes
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </form>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/course-generator')}
                className="mt-3 glass border-white/20 hover:bg-white/10"
              >
                <Brain className="w-4 h-4 mr-2 text-amber-400" />
                Build AI Course Roadmap
              </Button>
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
            <div className="mb-12">
              <div className="glass rounded-2xl p-6 border border-white/10">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-sm text-amber-400 font-semibold mb-2">Daily Quiz</p>
                    <h3 className="text-2xl font-bold mb-2">Attend your daily quiz</h3>
                    <p className="text-gray-400">
                      {allFlashcards.length > 0
                        ? 'Generate random quizzes from your flashcard decks, track weak areas, and keep your streak alive.'
                        : 'Create flashcards first, then start your quiz mode.'}
                    </p>
                  </div>
                  <Target className="w-10 h-10 text-amber-400" />
                </div>

                <p className="text-sm text-gray-300 mb-4">
                  Streak: <span className="text-amber-400 font-semibold">{quizSnapshot.streak} 🔥</span>
                  {quizSnapshot.todayCompleted && quizSnapshot.todayScore !== null ? (
                    <span className="ml-3">Today's best: {quizSnapshot.todayScore}/{quizSnapshot.todayTotal}</span>
                  ) : null}
                </p>

                <Button
                  onClick={() => navigate('/flashcards')}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
                >
                  Start Daily Quiz
                </Button>
              </div>
            </div>

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
