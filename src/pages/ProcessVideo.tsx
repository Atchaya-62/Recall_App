import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, Sparkles, FileText, BookMarked, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreateVideo } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { videosApi } from '@/services/api';

interface ProcessingStatus {
  id: string;
  videoId: string;
  stage: 'idle' | 'extracting' | 'generating' | 'complete' | 'error';
  message: string | null;
  progress: number;
  error: string | null;
}

interface ExistingVideoInfo {
  id: string;
  title: string;
}

const normalizeProcessingError = (input: string): string => {
  const text = input.trim();
  const lower = text.toLowerCase();

  if (
    lower.includes('resource_exhausted') ||
    lower.includes('exceeded your current quota') ||
    lower.includes('quota') ||
    lower.includes('429')
  ) {
    return 'AI usage limit reached for processing right now. Please try again later, or update Google AI billing/quota settings.';
  }

  if (lower.includes('edge function returned an invalid response')) {
    return 'The processing service returned an invalid response. Please try again in a moment.';
  }

  if (lower.includes('jwt') || lower.includes('token') || lower.includes('unauthorized') || lower.includes('401')) {
    return 'Session issue detected while starting processing. Please retry once; if it still fails, sign in again.';
  }

  return text;
};

const extractInvokeErrorMessage = async (invokeError: unknown): Promise<string> => {
  if (invokeError instanceof FunctionsHttpError) {
    try {
      const body = await invokeError.context.json();
      return body?.error || body?.message || 'Edge function returned an invalid response';
    } catch {
      try {
        const rawText = await invokeError.context.text();
        return rawText || 'Edge function returned an invalid response';
      } catch {
        return 'Edge function returned an invalid response';
      }
    }
  }

  if (invokeError instanceof Error) {
    return invokeError.message;
  }

  return 'Unexpected error while invoking processing function';
};

const isAuthInvokeError = (message: string): boolean => {
  const lower = message.toLowerCase();
  return lower.includes('jwt') || lower.includes('token') || lower.includes('unauthorized') || lower.includes('401');
};

const ensureActiveSession = async (): Promise<boolean> => {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.access_token) {
    return true;
  }

  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    console.error('[ProcessVideo] Session refresh failed:', refreshError.message);
    return false;
  }

  return !!refreshedData.session?.access_token;
};

export default function ProcessVideo() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get('url');
  const folderId = searchParams.get('folderId');

  const [processing, setProcessing] = useState<ProcessingStatus | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [existingVideo, setExistingVideo] = useState<ExistingVideoInfo | null>(null);
  const [isDeletingExisting, setIsDeletingExisting] = useState(false);
  const startedRef = useRef(false);
  const queryClient = useQueryClient();

  const createVideo = useCreateVideo();

  const extractVideoId = (input: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const getVideoInfo = async (ytVideoId: string) => {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytVideoId}&format=json`);
      if (!response.ok) throw new Error('Failed to fetch video info');

      const data = await response.json();
      return {
        title: data.title,
        thumbnail: data.thumbnail_url,
        duration: null,
      };
    } catch (error) {
      console.error('Error fetching video info:', error);
      return {
        title: 'YouTube Video',
        thumbnail: `https://img.youtube.com/vi/${ytVideoId}/maxresdefault.jpg`,
        duration: null,
      };
    }
  };

  useEffect(() => {
    if (!url) {
      navigate('/');
      return;
    }

    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    const processVideo = async () => {
      try {
        console.log('[ProcessVideo] Processing started');

        const hasSession = await ensureActiveSession();
        if (!hasSession) {
          toast.error('Please sign in again to continue.');
          navigate('/login');
          return;
        }
        
        const { data: userData } = await supabase.auth.getUser();
        console.log('[ProcessVideo] User check:', !!userData.user);
        if (!userData.user) {
          toast.error('Please sign in again to upload videos.');
          navigate('/login');
          return;
        }

        const ytVideoId = extractVideoId(url);
        if (!ytVideoId) {
          toast.error('Invalid YouTube URL');
          navigate('/');
          return;
        }

        const videoInfo = await getVideoInfo(ytVideoId);

        const videoPayload = {
          youtubeUrl: url,
          videoId: ytVideoId,
          title: videoInfo.title,
          thumbnail: videoInfo.thumbnail,
          duration: videoInfo.duration,
          folderId,
          summary: null,
          notes: [],
          watched: false,
        };

        let newVideo;
        try {
          newVideo = await createVideo.mutateAsync(videoPayload);
        } catch (createError) {
          const createMessage = createError instanceof Error ? createError.message : String(createError || '');
          if (isAuthInvokeError(createMessage)) {
            const refreshed = await ensureActiveSession();
            if (!refreshed) {
              throw createError;
            }
            newVideo = await createVideo.mutateAsync(videoPayload);
          } else {
            throw createError;
          }
        }

        if (newVideo.isExisting) {
          setExistingVideo({
            id: newVideo.id,
            title: newVideo.title || videoInfo.title || 'This video',
          });
          setProcessing({
            id: '',
            videoId: newVideo.id,
            stage: 'idle',
            message: 'Video already exists. Processing paused.',
            progress: 0,
            error: null,
          });
          return;
        }

        setVideoId(newVideo.id);
        setProcessing({
          id: '',
          videoId: newVideo.id,
          stage: 'extracting',
          message: 'Starting video processing...',
          progress: 10,
          error: null,
        });

        const invokeProcessVideo = async (allowRetry: boolean): Promise<any> => {
          console.log('[ProcessVideo] Invoking process-video...');
          const { data, error } = await supabase.functions.invoke('process-video', {
            body: { videoId: newVideo.id, youtubeUrl: url },
          });

          if (!error) {
            return data;
          }

          const message = await extractInvokeErrorMessage(error);
          console.error('[ProcessVideo] Function invoke failed:', message);

          if (allowRetry && isAuthInvokeError(message)) {
            console.log('[ProcessVideo] Auth-related invoke error detected, refreshing session and retrying once');
            const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
            const refreshedToken = refreshedData.session?.access_token;

            if (!refreshError && refreshedToken) {
              return invokeProcessVideo(false);
            }

            console.error('[ProcessVideo] Session refresh failed:', refreshError?.message || 'No session token after refresh');
          }

          throw new Error(message);
        };

        const data = await invokeProcessVideo(true);

        console.log('[ProcessVideo] Processing complete:', data?.message);
        setProcessing({
          id: '',
          videoId: newVideo.id,
          stage: 'complete',
          message: data?.message || 'Processing complete!',
          progress: 100,
          error: null,
        });

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['videos'] }),
          queryClient.invalidateQueries({ queryKey: ['videos', newVideo.id] }),
          queryClient.invalidateQueries({ queryKey: ['flashcards', newVideo.id] }),
          queryClient.invalidateQueries({ queryKey: ['flashcards', 'all'] }),
          queryClient.invalidateQueries({ queryKey: ['folders'] }),
        ]);
      } catch (error) {
        console.error('Error processing video:', error);
        const rawErrorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorMessage = normalizeProcessingError(rawErrorMessage);
        setHasError(true);
        setProcessing({
          id: '',
          videoId: '',
          stage: 'error',
          message: 'Failed to process video',
          progress: 0,
          error: errorMessage,
        });
        toast.error(errorMessage);
      }
    };

    processVideo();
  }, [url, folderId, navigate, queryClient]);

  useEffect(() => {
    if (!videoId) return;

    const channel = supabase
      .channel(`processing:${videoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'video_processing',
          filter: `video_id=eq.${videoId}`,
        },
        (payload) => {
          const newStatus = payload.new as any;
          setProcessing({
            id: newStatus.id,
            videoId: newStatus.video_id,
            stage: newStatus.stage,
            message: newStatus.message,
            progress: newStatus.progress,
            error: newStatus.error,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_processing',
          filter: `video_id=eq.${videoId}`,
        },
        (payload) => {
          const newStatus = payload.new as any;
          setProcessing({
            id: newStatus.id,
            videoId: newStatus.video_id,
            stage: newStatus.stage,
            message: newStatus.message,
            progress: newStatus.progress,
            error: typeof newStatus.error === 'string' ? normalizeProcessingError(newStatus.error) : newStatus.error,
          });

          if (newStatus.stage === 'error') {
            setHasError(true);
            const normalizedRealtimeError =
              typeof newStatus.error === 'string' ? normalizeProcessingError(newStatus.error) : 'Video processing failed';
            toast.error(normalizedRealtimeError);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [videoId]);

  const getMessage = () => {
    if (!processing) return 'Initializing...';
    if (processing.message) return processing.message;

    switch (processing.stage) {
      case 'extracting':
        return 'Extracting video transcript...';
      case 'generating':
        return 'Generating notes and flashcards with AI...';
      case 'complete':
        return 'All done! Your notes are ready.';
      case 'error':
        return processing.error || 'An error occurred during processing';
      default:
        return 'Processing video...';
    }
  };

  const handleDeleteExistingVideo = async () => {
    if (!existingVideo) return;

    setIsDeletingExisting(true);
    try {
      await videosApi.delete(existingVideo.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['videos'] }),
        queryClient.invalidateQueries({ queryKey: ['folders'] }),
      ]);

      toast.success('Existing video deleted. You can upload again now.');
      setExistingVideo(null);
      navigate('/');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete existing video.');
    } finally {
      setIsDeletingExisting(false);
    }
  };

  if (hasError || processing?.stage === 'error') {
    return (
      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
        <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass-strong rounded-3xl p-12 text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-12 h-12 text-white" />
            </div>

            <h1 className="text-4xl font-bold mb-4">Processing Failed</h1>
            <p className="text-xl text-gray-400 mb-8">
              {processing?.error || 'An error occurred while processing your video.'}
            </p>

            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => navigate('/')}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
              >
                Back to Dashboard
              </Button>

              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="glass border-white/20"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AlertDialog open={!!existingVideo}>
        <AlertDialogContent className="glass-strong border-white/20 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-2xl">Video Already Uploaded</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              <span className="font-semibold text-white">{existingVideo?.title || 'This video'}</span> already exists in your library.
              Processing has been stopped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              className="glass border-white/20"
              onClick={() => navigate('/')}
              disabled={isDeletingExisting}
            >
              Back to Dashboard
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDeleteExistingVideo}
              disabled={isDeletingExisting}
            >
              {isDeletingExisting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Existing Video'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
        <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass-strong rounded-3xl p-12 text-center">
          {processing?.stage === 'complete' ? (
            <>
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>

              <h1 className="text-4xl font-bold mb-4">Processing Complete!</h1>
              <p className="text-xl text-gray-400 mb-8">Your notes and flashcards have been generated successfully.</p>

              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="glass rounded-2xl p-6">
                  <FileText className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold mb-1">1</p>
                  <p className="text-sm text-gray-400">Summary</p>
                </div>

                <div className="glass rounded-2xl p-6">
                  <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold mb-1">10+</p>
                  <p className="text-sm text-gray-400">Key Notes</p>
                </div>

                <div className="glass rounded-2xl p-6">
                  <BookMarked className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold mb-1">12+</p>
                  <p className="text-sm text-gray-400">Flashcards</p>
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <Button
                  onClick={() => (videoId ? navigate(`/video/${videoId}`) : navigate('/'))}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
                >
                  View Notes
                </Button>

                <Button variant="outline" onClick={() => navigate('/')} className="glass border-white/20">
                  Back to Dashboard
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full animate-pulse opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
                </div>
              </div>

              <h1 className="text-4xl font-bold mb-4">Processing Video</h1>
              <p className="text-xl text-gray-400 mb-8">{getMessage()}</p>

              <div className="max-w-md mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-400">Progress</span>
                  <span className="text-sm font-semibold">{processing?.progress || 0}%</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500 ease-out"
                    style={{ width: `${processing?.progress || 0}%` }}
                  />
                </div>
              </div>

              <p className="text-sm text-gray-500 mt-8">This usually takes 10-30 seconds</p>
            </>
          )}
          </div>
        </div>
      </div>
    </>
  );
}
