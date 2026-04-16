import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foldersApi, videosApi, flashcardsApi } from '@/services/api';
import { Folder, Video, Flashcard } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

// ========== Folders Hooks ==========

export function useFolders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['folders', user?.id],
    queryFn: foldersApi.getAll,
    enabled: !!user,
  });
}

export function useFolder(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['folders', user?.id, id],
    queryFn: () => foldersApi.getById(id),
    enabled: !!id && !!user,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      foldersApi.create(name, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Folder> }) =>
      foldersApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => foldersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

// ========== Videos Hooks ==========

export function useVideos() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['videos', user?.id],
    queryFn: videosApi.getAll,
    enabled: !!user,
  });
}

export function useVideosByFolder(folderId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['videos', user?.id, 'folder', folderId],
    queryFn: () => videosApi.getByFolder(folderId),
    enabled: !!folderId && !!user,
  });
}

export function useVideo(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['videos', user?.id, id],
    queryFn: () => videosApi.getById(id),
    enabled: !!id && !!user,
  });
}

export function useCreateVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (video: Partial<Video>) => videosApi.create(video),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useUpdateVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Video> }) =>
      videosApi.update(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['videos', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useDeleteVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => videosApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

// ========== Flashcards Hooks ==========

export function useFlashcards(videoId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['flashcards', user?.id, videoId],
    queryFn: () => flashcardsApi.getByVideo(videoId),
    enabled: !!videoId && !!user,
  });
}

export function useAllFlashcards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['flashcards', user?.id, 'all'],
    queryFn: flashcardsApi.getAll,
    enabled: !!user,
  });
}

export function useUpdateFlashcard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Flashcard> }) =>
      flashcardsApi.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['flashcards', data.videoId] });
      queryClient.invalidateQueries({ queryKey: ['flashcards', 'all'] });
    },
  });
}

export function useBulkCreateFlashcards() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (flashcards: Array<Omit<Flashcard, 'id' | 'createdAt' | 'updatedAt'>>) =>
      flashcardsApi.bulkCreate(flashcards),
    onSuccess: (data) => {
      if (data.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['flashcards', data[0].videoId] });
        queryClient.invalidateQueries({ queryKey: ['flashcards', 'all'] });
      }
    },
  });
}
