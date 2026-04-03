import { useParams, Link } from 'react-router-dom';
import { ExternalLink, FolderOpen, Clock, CheckCircle2, Edit3, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useVideo, useFlashcards, useUpdateVideo, useUpdateFlashcard, useFolders } from '@/hooks/useData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { toast } from 'sonner';

type EditableNote = {
  heading: string;
  content: string;
};

export default function VideoDetail() {
  const { id } = useParams();
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [flashcardsExpanded, setFlashcardsExpanded] = useState(true);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editingNotes, setEditingNotes] = useState<EditableNote[]>([]);

  // Fetch real data using React Query
  const { data: video, isLoading: videoLoading, error: videoError } = useVideo(id || '');
  const { data: flashcards = [], isLoading: flashcardsLoading, error: flashcardsError } = useFlashcards(id || '');
  const { data: folders = [] } = useFolders();

  const updateVideoMutation = useUpdateVideo();
  const updateFlashcardMutation = useUpdateFlashcard();

  const folder = video && video.folderId ? folders.find(f => f.id === video.folderId) : null;

  const isLoading = videoLoading || flashcardsLoading;

  const renderNoteContent = (note: string) => {
    const normalized = note
      .replace(/^###\s*.+\n/, '')
      .replace(/^#+\s*.+\n/, '');
    const segments = normalized.split(/```/g);

    return segments.map((segment, segmentIndex) => {
      if (segmentIndex % 2 === 1) {
        return (
          <pre
            key={`code-${segmentIndex}`}
            className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 text-sm font-mono text-amber-100 whitespace-pre-wrap"
          >
            <code>{segment.trim()}</code>
          </pre>
        );
      }

      return (
        <div key={`text-${segmentIndex}`} className="whitespace-pre-wrap text-gray-300 leading-relaxed">
          {segment.trim()}
        </div>
      );
    });
  };

  const parseNoteTitle = (note: string) => {
    const trimmed = note.trim();
    const headingMatch = trimmed.match(/^###\s*(.+)$/m);

    if (headingMatch) {
      return headingMatch[1].trim();
    }

    const firstLine = trimmed.split('\n')[0]?.trim();
    if (!firstLine) {
      return 'Note';
    }

    if (firstLine.length > 80) {
      return `${firstLine.slice(0, 77)}...`;
    }

    return firstLine.replace(/\s+/g, ' ');
  };

  const parseNoteForEdit = (note: string): EditableNote => {
    const trimmed = note.trim();
    const headingMatch = trimmed.match(/^###\s*(.+)$/m);
    const heading = headingMatch?.[1]?.trim() || parseNoteTitle(note);
    const content = trimmed
      .replace(/^###\s*.+\n/, '')
      .replace(/^#+\s*.+\n/, '')
      .trim();

    return { heading, content };
  };

  const formatNoteForSave = (note: EditableNote): string => {
    const heading = note.heading.trim();
    const content = note.content.trim();

    if (!heading && !content) return '';
    if (!heading) return content;
    if (!content) return `### ${heading}`;
    return `### ${heading}\n${content}`;
  };

  if (videoError || (!videoLoading && !video)) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass rounded-2xl p-12 text-center">
            <h2 className="text-2xl font-bold mb-2 text-red-400">Video not found</h2>
            <p className="text-gray-400 mb-6">The video you're looking for doesn't exist or there was an error loading it</p>
            <Link to="/">
              <Button>Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-spin" />
              <p className="text-gray-400">Loading video details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!video) return null;

  const currentCard = flashcards[currentCardIndex];

  const handleMarkAsWatched = async () => {
    try {
      await updateVideoMutation.mutateAsync({
        id: video.id,
        updates: { watched: !video.watched }
      });
      toast.success(video.watched ? 'Marked as unwatched' : 'Marked as watched!');
    } catch (error) {
      toast.error('Failed to update watch status');
    }
  };

  const handleFlashcardMastery = async (mastered: boolean) => {
    if (!currentCard) return;

    try {
      await updateFlashcardMutation.mutateAsync({
        id: currentCard.id,
        updates: {
          mastered,
          lastReviewed: new Date().toISOString()
        }
      });

      toast.success(mastered ? 'Card marked as mastered!' : 'Card marked for review');

      // Auto advance to next card after a short delay
      setTimeout(() => {
        nextCard();
      }, 1000);
    } catch (error) {
      toast.error('Failed to update flashcard');
    }
  };

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  };

  const openNotesEditor = () => {
    const notesForEdit = (video.notes || [])
      .map(parseNoteForEdit)
      .filter((note) => note.heading || note.content);

    setEditingNotes(notesForEdit.length > 0 ? notesForEdit : [{ heading: '', content: '' }]);
    setIsEditingNotes(true);
  };

  const handleSaveNotes = async () => {
    if (!video) return;

    const savedNotes = editingNotes
      .map((note) => ({
        heading: note.heading.trim(),
        content: note.content.trim(),
      }))
      .filter((note) => note.heading || note.content)
      .map(formatNoteForSave)
      .filter(Boolean);

    try {
      await updateVideoMutation.mutateAsync({
        id: video.id,
        updates: { notes: savedNotes },
      });
      toast.success('Notes updated successfully.');
      setIsEditingNotes(false);
    } catch (error) {
      toast.error('Failed to update notes');
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <Dialog open={isEditingNotes} onOpenChange={setIsEditingNotes}>
        <DialogContent className="glass-strong border-white/20 backdrop-blur-xl max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Notes</DialogTitle>
            <DialogDescription className="text-gray-300">
              Edit the notes exactly as you want them to appear later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {editingNotes.map((note, index) => (
              <div key={index} className="glass rounded-2xl border border-white/10 p-4 space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Heading</label>
                  <Input
                    value={note.heading}
                    onChange={(event) =>
                      setEditingNotes((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, heading: event.target.value } : item
                        )
                      )
                    }
                    placeholder="Note title"
                    className="glass border-white/20"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Content</label>
                  <Textarea
                    value={note.content}
                    onChange={(event) =>
                      setEditingNotes((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, content: event.target.value } : item
                        )
                      )
                    }
                    placeholder="Write the note content here, including steps, code, workflows, or bullet points"
                    className="min-h-[180px] glass border-white/20 font-mono text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="glass border-white/20"
              onClick={() => setIsEditingNotes(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNotes}
              disabled={updateVideoMutation.isPending}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
            >
              {updateVideoMutation.isPending ? 'Saving...' : 'Save Notes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-gray-400 mb-6">
          <Link to="/" className="hover:text-white transition-colors">Dashboard</Link>
          <span>/</span>
          {folder && (
            <>
              <Link to="/folders" className="hover:text-white transition-colors">{folder.name}</Link>
              <span>/</span>
            </>
          )}
          <span className="text-white">{video.title}</span>
        </div>

        {/* Video Header */}
        <div className="glass-strong rounded-3xl overflow-hidden mb-8">
          <div className="relative h-80">
            <img
              src={video.thumbnail || 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&h=225&fit=crop'}
              alt={video.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="flex items-center space-x-3 mb-4">
                {folder && (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-semibold border border-amber-500/30">
                    <FolderOpen className="w-3 h-3 inline mr-1" />
                    {folder.name}
                  </span>
                )}
                <button
                  onClick={handleMarkAsWatched}
                  disabled={updateVideoMutation.isPending}
                  className={`px-3 py-1 rounded-full text-sm font-semibold border transition-colors ${
                    video.watched
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 inline mr-1" />
                  {video.watched ? 'Watched' : 'Mark as Watched'}
                </button>
              </div>

              <h1 className="text-4xl font-bold mb-3">{video.title}</h1>

              <div className="flex items-center space-x-4 text-sm text-gray-300">
                {video.duration && (
                  <>
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {video.duration}
                    </span>
                    <span>•</span>
                  </>
                )}
                <span>{new Date(video.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-white/10">
            <a
              href={video.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-amber-400 hover:text-amber-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="font-semibold">Watch on YouTube</span>
            </a>
          </div>
        </div>

        {/* Summary Section */}
        {video.summary && (
          <div className="glass rounded-2xl mb-6 overflow-hidden">
            <button
              onClick={() => setSummaryExpanded(!summaryExpanded)}
              className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <h2 className="text-2xl font-bold">Summary</h2>
              {summaryExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {summaryExpanded && (
              <div className="px-6 pb-6">
                <p className="text-gray-300 leading-relaxed">{video.summary}</p>
              </div>
            )}
          </div>
        )}

        {/* Notes Section */}
        {video.notes && video.notes.length > 0 && (
          <div className="glass rounded-2xl mb-6 overflow-hidden">
            <div className="p-6 flex items-center justify-between border-b border-white/10">
              <button
                onClick={() => setNotesExpanded(!notesExpanded)}
                className="flex items-center space-x-2 flex-1"
              >
                <h2 className="text-2xl font-bold">Key Notes</h2>
                {notesExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              <Button variant="outline" size="sm" className="glass border-white/20" onClick={openNotesEditor}>
                <Edit3 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>

            {notesExpanded && (
              <div className="p-6">
                <ul className="space-y-3">
                  {video.notes.map((note, index) => (
                    <li key={index} className="glass rounded-2xl border border-white/10 p-5 space-y-3">
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                        <h3 className="text-lg font-semibold text-white">{parseNoteTitle(note)}</h3>
                      </div>
                      <div className="pl-5 space-y-3">
                        {renderNoteContent(note)}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Flashcards Section */}
        <div className="glass rounded-2xl overflow-hidden">
          <button
            onClick={() => setFlashcardsExpanded(!flashcardsExpanded)}
            className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/10"
          >
            <h2 className="text-2xl font-bold">Flashcards ({flashcards.length})</h2>
            {flashcardsExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {flashcardsExpanded && (
            <div className="p-6">
              {flashcardsError ? (
                <div className="text-center py-8">
                  <p className="text-red-400 mb-2">Error loading flashcards</p>
                  <p className="text-gray-400">Please try refreshing the page</p>
                </div>
              ) : flashcards.length > 0 && currentCard ? (
                <>
                  <div
                    className="glass-strong rounded-2xl p-8 min-h-[300px] flex flex-col justify-between cursor-pointer card-hover"
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-sm text-amber-400 font-semibold mb-4">
                          {isFlipped ? 'ANSWER' : 'QUESTION'}
                        </p>
                        <p className="text-xl font-medium leading-relaxed">
                          {isFlipped ? currentCard.answer : currentCard.question}
                        </p>
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-sm text-gray-500">Click to flip</p>
                      {currentCard.mastered && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Mastered
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-6">
                    <Button
                      variant="outline"
                      onClick={prevCard}
                      disabled={flashcards.length <= 1}
                      className="glass border-white/20"
                    >
                      Previous
                    </Button>

                    <span className="text-sm text-gray-400">
                      Card {currentCardIndex + 1} of {flashcards.length}
                    </span>

                    <Button
                      variant="outline"
                      onClick={nextCard}
                      disabled={flashcards.length <= 1}
                      className="glass border-white/20"
                    >
                      Next
                    </Button>
                  </div>

                  {isFlipped && (
                    <div className="flex gap-3 mt-6">
                      <Button
                        onClick={() => handleFlashcardMastery(true)}
                        disabled={updateFlashcardMutation.isPending}
                        className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        {updateFlashcardMutation.isPending ? 'Updating...' : 'Know It'}
                      </Button>
                      <Button
                        onClick={() => handleFlashcardMastery(false)}
                        disabled={updateFlashcardMutation.isPending}
                        className="flex-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30"
                      >
                        Need Review
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-2">No flashcards available</p>
                  <p className="text-sm text-gray-500">Flashcards will be generated when the video is processed</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
