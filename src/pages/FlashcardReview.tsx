import { useState, useMemo } from 'react';
import { useAllFlashcards, useVideos, useFolders, useUpdateFlashcard } from '@/hooks/useData';
import { CheckCircle2, XCircle, RotateCcw, Trophy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Flashcard } from '@/types';
import { toast } from 'sonner';

export default function FlashcardReview() {
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [needReviewCount, setNeedReviewCount] = useState(0);
  const [reviewedCards, setReviewedCards] = useState<Set<number>>(new Set());

  // Fetch data
  const { data: allFlashcardsData = [], isLoading: flashcardsLoading } = useAllFlashcards();
  const { data: videos = [], isLoading: videosLoading } = useVideos();
  const { data: folders = [] } = useFolders();
  const updateFlashcard = useUpdateFlashcard();

  // Build enriched flashcards with video and folder info
  const allFlashcards = useMemo(() => {
    return allFlashcardsData.map(card => {
      const video = videos.find(v => v.id === card.videoId);
      const folder = video ? folders.find(f => f.id === video.folderId) : null;
      return {
        ...card,
        videoTitle: video?.title || 'Unknown Video',
        folderName: folder?.name || 'Uncategorized',
        folderId: folder?.id || null,
      };
    });
  }, [allFlashcardsData, videos, folders]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allFlashcards.forEach((card) => {
      if (card.folderId) {
        counts[card.folderId] = (counts[card.folderId] || 0) + 1;
      }
    });
    return counts;
  }, [allFlashcards]);

  const selectableFolders = useMemo(
    () => folders.filter((folder) => (folderCounts[folder.id] || 0) > 0),
    [folders, folderCounts]
  );

  // Filter flashcards based on selected folder
  const flashcards = selectedFolderId !== 'all'
    ? allFlashcards.filter(card => card.folderId === selectedFolderId)
    : allFlashcards;
    
  const currentCard = flashcards[currentCardIndex];
  const isComplete = reviewedCards.size === flashcards.length;
  const isLoading = flashcardsLoading || videosLoading;

  const handleKnowIt = async () => {
    if (!currentCard) return;

    try {
      // Update flashcard mastery in database
      await updateFlashcard.mutateAsync({
        id: currentCard.id,
        updates: {
          mastered: true,
          lastReviewed: new Date().toISOString()
        }
      });

      setMasteredCount(prev => prev + 1);
      setReviewedCards(prev => new Set(prev).add(currentCardIndex));
      nextCard();
    } catch (error) {
      toast.error('Failed to update flashcard');
    }
  };

  const handleNeedReview = async () => {
    if (!currentCard) return;

    try {
      // Update last reviewed time but don't mark as mastered
      await updateFlashcard.mutateAsync({
        id: currentCard.id,
        updates: {
          mastered: false,
          lastReviewed: new Date().toISOString()
        }
      });

      setNeedReviewCount(prev => prev + 1);
      setReviewedCards(prev => new Set(prev).add(currentCardIndex));
      nextCard();
    } catch (error) {
      toast.error('Failed to update flashcard');
    }
  };
  
  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentCardIndex < flashcards.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
      }
    }, 150);
  };
  
  const resetReview = () => {
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setMasteredCount(0);
    setNeedReviewCount(0);
    setReviewedCards(new Set());
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-xl text-gray-400">Loading your flashcards...</p>
        </div>
      </div>
    );
  }

  // No flashcards state
  if (allFlashcards.length === 0) {
    return (
      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-gray-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">No Flashcards Available</h1>
          <p className="text-xl text-gray-400 mb-8">
            Process some videos first to generate flashcards for review.
          </p>
          <Button
            onClick={() => window.location.href = '/process'}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
          >
            Process Videos
          </Button>
        </div>
      </div>
    );
  }
  
  if (isComplete) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass-strong rounded-3xl p-12 text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-12 h-12 text-black" />
            </div>
            
            <h1 className="text-4xl font-bold mb-4">Review Complete!</h1>
            <p className="text-xl text-gray-400 mb-8">Great job! You've reviewed all flashcards.</p>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="glass rounded-2xl p-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <p className="text-3xl font-bold mb-1">{masteredCount}</p>
                <p className="text-sm text-gray-400">Mastered</p>
              </div>
              
              <div className="glass rounded-2xl p-6">
                <XCircle className="w-8 h-8 text-orange-400 mx-auto mb-3" />
                <p className="text-3xl font-bold mb-1">{needReviewCount}</p>
                <p className="text-sm text-gray-400">Need Review</p>
              </div>
            </div>
            
            <div className="flex gap-4 justify-center">
              <Button 
                onClick={resetReview}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Review Again
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/'}
                className="glass border-white/20"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold mb-4">
            Flashcard <span className="text-gradient">Review</span>
          </h1>
          <p className="text-xl text-gray-400">
            Test your knowledge and track your progress
          </p>
        </div>
        
        {/* Filter */}
        <div className="glass rounded-2xl p-6 mb-8">
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Filter by folder</p>
            <Select
              value={selectedFolderId}
              onValueChange={(value) => {
                setSelectedFolderId(value);
                resetReview();
              }}
            >
              <SelectTrigger className="h-11 glass border-white/20">
                <SelectValue placeholder="Select folder" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-950 border-white/20 text-white">
                <SelectItem value="all">All Folders ({allFlashcards.length})</SelectItem>
                {selectableFolders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name} ({folderCounts[folder.id] || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Flashcard */}
        {currentCard && (
          <div className="mb-8">
            <div className="glass rounded-xl p-4 mb-4">
              <div className="text-sm text-gray-400">
                <span className="font-semibold text-amber-400">{currentCard.folderName}</span>
                {' / '}
                {currentCard.videoTitle}
              </div>
            </div>
            
            <div 
              className="glass-strong rounded-3xl p-12 min-h-[400px] flex flex-col justify-between cursor-pointer card-hover"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-2xl">
                  <p className="text-sm text-amber-400 font-bold mb-6 tracking-wide">
                    {isFlipped ? 'ANSWER' : 'QUESTION'}
                  </p>
                  <p className="text-2xl font-medium leading-relaxed">
                    {isFlipped ? currentCard.answer : currentCard.question}
                  </p>
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-500">Click anywhere to flip</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center mt-6">
              <span className="text-sm text-gray-400">
                Card {currentCardIndex + 1} of {flashcards.length}
              </span>
            </div>
          </div>
        )}
        
        {/* Actions */}
        {isFlipped && (
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={handleNeedReview}
              disabled={updateFlashcard.isPending}
              size="lg"
              className="h-16 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-2 border-orange-500/30 font-bold text-lg disabled:opacity-50"
            >
              {updateFlashcard.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-5 h-5 mr-2" />
              )}
              Need Review
            </Button>

            <Button
              onClick={handleKnowIt}
              disabled={updateFlashcard.isPending}
              size="lg"
              className="h-16 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/30 font-bold text-lg disabled:opacity-50"
            >
              {updateFlashcard.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5 mr-2" />
              )}
              Know It
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
