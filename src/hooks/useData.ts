import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foldersApi, videosApi, flashcardsApi } from '@/services/api';
import { Folder, Video, Flashcard } from '@/types';

// ========== Folders Hooks ==========

export function useFolders() {
  return useQuery({
    queryKey: ['folders'],
    queryFn: foldersApi.getAll,
  });
}

export function useFolder(id: string) {
  return useQuery({
    queryKey: ['folders', id],
    queryFn: () => foldersApi.getById(id),
    enabled: !!id,
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
  return useQuery({
    queryKey: ['videos'],
    queryFn: videosApi.getAll,
  });
}

export function useVideosByFolder(folderId: string) {
  return useQuery({
    queryKey: ['videos', 'folder', folderId],
    queryFn: () => videosApi.getByFolder(folderId),
    enabled: !!folderId,
  });
}

export function useVideo(id: string) {
  return useQuery({
    queryKey: ['videos', id],
    queryFn: () => videosApi.getById(id),
    enabled: !!id,
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
  return useQuery({
    queryKey: ['flashcards', videoId],
    queryFn: () => flashcardsApi.getByVideo(videoId),
    enabled: !!videoId,
  });
}

export function useAllFlashcards() {
  return useQuery({
    queryKey: ['flashcards', 'all'],
    queryFn: flashcardsApi.getAll,
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
