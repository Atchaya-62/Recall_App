import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FolderPlus, Search, Loader2 } from 'lucide-react';
import FolderCard from '@/components/features/FolderCard';
import VideoCard from '@/components/features/VideoCard';
import { useFolders, useVideos, useVideosByFolder, useCreateFolder, useUpdateVideo, useDeleteVideo, useDeleteFolder } from '@/hooks/useData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { semanticSearchVideos } from '@/lib/semanticSearch';

export default function Folders() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [movingVideoId, setMovingVideoId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<{ id: string; name: string } | null>(null);
  const { id: urlFolderId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedFolder = urlFolderId || null;

  // Fetch real data using React Query
  const { data: folders = [], isLoading: foldersLoading, error: foldersError } = useFolders();
  const { data: allVideos = [], isLoading: allVideosLoading } = useVideos();
  const {
    data: folderVideos = [],
    isLoading: videosLoading,
    error: videosError
  } = useVideosByFolder(selectedFolder || '');

  const createFolderMutation = useCreateFolder();
  const updateVideoMutation = useUpdateVideo();
  const deleteVideoMutation = useDeleteVideo();
  const deleteFolderMutation = useDeleteFolder();

  const isLoading = foldersLoading || allVideosLoading || (selectedFolder && videosLoading);

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const semanticResults = useMemo(
    () => semanticSearchVideos(searchQuery, allVideos, folders, 60),
    [searchQuery, allVideos, folders]
  );

  const semanticVideos = useMemo(() => {
    if (!searchQuery.trim()) return [];

    return semanticResults
      .map((result) => allVideos.find((video) => video.id === result.videoId))
      .filter((video): video is NonNullable<typeof video> => !!video);
  }, [semanticResults, allVideos, searchQuery]);

  const selectedFolderData = folders.find(f => f.id === selectedFolder);

  const handleCreateFolder = async () => {
    const folderName = newFolderName.trim();
    if (!folderName) {
      toast.error('Please enter a folder name.');
      return;
    }

    const colors = ['amber', 'orange', 'emerald'] as const;
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    try {
      await createFolderMutation.mutateAsync({
        name: folderName,
        color: randomColor
      });
      toast.success('Folder created successfully!');
      setIsCreateFolderOpen(false);
      setNewFolderName('');
    } catch (error: any) {
      toast.error('Failed to create folder');
      console.error('Create folder error:', error);
    }
  };

  const handleMoveVideo = async (videoId: string) => {
    const targetFolderId = moveTargets[videoId];
    if (!targetFolderId || !selectedFolder || targetFolderId === selectedFolder) {
      toast.error('Select a different folder first.');
      return;
    }

    setMovingVideoId(videoId);
    try {
      await updateVideoMutation.mutateAsync({
        id: videoId,
        updates: { folderId: targetFolderId },
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['videos', 'folder', selectedFolder] }),
        queryClient.invalidateQueries({ queryKey: ['videos', 'folder', targetFolderId] }),
      ]);

      setMoveTargets((prev) => {
        const next = { ...prev };
        delete next[videoId];
        return next;
      });
      toast.success('Video moved successfully.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to move video.');
    } finally {
      setMovingVideoId(null);
    }
  };

  const handleConfirmDeleteVideo = async () => {
    if (!deleteTarget) return;

    try {
      await deleteVideoMutation.mutateAsync(deleteTarget.id);
      toast.success('Video deleted successfully.');
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete video.');
    }
  };

  const handleConfirmDeleteFolder = async () => {
    if (!deleteFolderTarget) return;

    if (folderVideos.length > 0) {
      toast.error('Move or delete all videos in this folder before deleting it.');
      return;
    }

    try {
      await deleteFolderMutation.mutateAsync(deleteFolderTarget.id);
      toast.success('Folder deleted successfully.');
      setDeleteFolderTarget(null);
      navigate('/folders');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete folder.');
    }
  };

  if (foldersError) {
    return (
      <div className="min-h-screen pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass rounded-2xl p-12 text-center">
            <h3 className="text-xl font-bold mb-2 text-red-400">Error loading folders</h3>
            <p className="text-gray-400">Please try refreshing the page</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="glass-strong border-white/20 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Video</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Are you sure you want to delete
              <span className="text-white font-semibold"> {deleteTarget?.title || 'this video'}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass border-white/20 text-gray-200 hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteVideo}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={deleteVideoMutation.isPending}
            >
              {deleteVideoMutation.isPending ? (
                <span className="inline-flex items-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </span>
              ) : (
                'Delete Video'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteFolderTarget} onOpenChange={(open) => !open && setDeleteFolderTarget(null)}>
        <AlertDialogContent className="glass-strong border-white/20 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Folder</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300">
              Are you sure you want to delete
              <span className="text-white font-semibold"> {deleteFolderTarget?.name || 'this folder'}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass border-white/20 text-gray-200 hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteFolder}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={deleteFolderMutation.isPending}
            >
              {deleteFolderMutation.isPending ? (
                <span className="inline-flex items-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </span>
              ) : (
                'Delete Folder'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent className="glass-strong border-white/20 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-white">Create Folder</DialogTitle>
            <DialogDescription className="text-gray-300">
              Enter a folder name to organize your videos.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="e.g. Backend Engineering"
            className="h-12 glass border-white/20"
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="glass border-white/20"
              onClick={() => setIsCreateFolderOpen(false)}
              disabled={createFolderMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={createFolderMutation.isPending}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
            >
              {createFolderMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Folder'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {!selectedFolder && (
          <>
            {/* Header */}
            <div className="mb-12">
              <h1 className="text-5xl font-bold mb-4">
                My <span className="text-gradient">Folders</span>
              </h1>
              <p className="text-xl text-gray-400">
                Organize your learning journey by topics and subjects
              </p>
            </div>

            {/* Search & Create */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Semantic search across your videos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 glass border-white/20"
                />
              </div>
              <Button
                onClick={() => setIsCreateFolderOpen(true)}
                disabled={createFolderMutation.isPending}
                className="h-12 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
              >
                {createFolderMutation.isPending ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <FolderPlus className="w-5 h-5 mr-2" />
                )}
                Create Folder
              </Button>
            </div>
          </>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-spin" />
              <p className="text-gray-400">
                {foldersLoading ? 'Loading folders...' : 'Loading videos...'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Folders Grid */}
            {!selectedFolder ? (
              <div>
                {searchQuery.trim() ? (
                  <>
                    <h2 className="text-2xl font-bold mb-6">Related Videos ({semanticVideos.length})</h2>
                    {semanticVideos.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                        {semanticVideos.map((video, index) => (
                          <div
                            key={video.id}
                            style={{ animationDelay: `${index * 50}ms` }}
                            className="animate-fade-in-up"
                          >
                            <VideoCard
                              video={video}
                              folderName={video.folderId ? folders.find((f) => f.id === video.folderId)?.name : undefined}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="glass rounded-2xl p-12 text-center">
                        <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold mb-2">No related videos found</h3>
                        <p className="text-gray-400">Try broader concepts or different terms.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold mb-6">All Folders ({filteredFolders.length})</h2>
                    {filteredFolders.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-fr">
                        {filteredFolders.map((folder, index) => (
                          <div
                            key={folder.id}
                            style={{ animationDelay: `${index * 50}ms` }}
                            className="animate-fade-in-up"
                          >
                            <FolderCard
                              folder={folder}
                              onClick={() => navigate(`/folder/${folder.id}`)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="glass rounded-2xl p-12 text-center">
                        <FolderPlus className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold mb-2">No folders found</h3>
                        <p className="text-gray-400 mb-6">Create your first folder to get started</p>
                        <Button
                          onClick={() => setIsCreateFolderOpen(true)}
                          disabled={createFolderMutation.isPending}
                          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
                        >
                          <FolderPlus className="w-5 h-5 mr-2" />
                          Create Your First Folder
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div>
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <Button
                      variant="ghost"
                      onClick={() => navigate('/folders')}
                      className="mb-4 text-gray-400 hover:text-white"
                    >
                      ← Back to All Folders
                    </Button>
                    <h2 className="text-3xl font-bold">{selectedFolderData?.name}</h2>
                    <p className="text-gray-400 mt-2">
                      {folderVideos.length} videos in this folder
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() =>
                      selectedFolderData &&
                      setDeleteFolderTarget({ id: selectedFolderData.id, name: selectedFolderData.name })
                    }
                    className="border-red-500/50 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                    disabled={deleteFolderMutation.isPending}
                  >
                    Delete Folder
                  </Button>
                </div>

                {videosError ? (
                  <div className="glass rounded-2xl p-12 text-center">
                    <h3 className="text-xl font-bold mb-2 text-red-400">Error loading videos</h3>
                    <p className="text-gray-400">Please try refreshing the page</p>
                  </div>
                ) : folderVideos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                    {folderVideos.map((video, index) => (
                      <div
                        key={video.id}
                        style={{ animationDelay: `${index * 50}ms` }}
                        className="animate-fade-in-up space-y-3 self-start"
                      >
                        <VideoCard video={video} />
                        <div className="glass rounded-xl p-3 border border-white/10">
                          <p className="text-xs text-gray-300 mb-2">Move video to another folder</p>
                          <div className="flex items-center gap-2">
                            <Select
                              value={moveTargets[video.id] || ''}
                              onValueChange={(value) =>
                                setMoveTargets((prev) => ({
                                  ...prev,
                                  [video.id]: value,
                                }))
                              }
                              disabled={folders.filter((folder) => folder.id !== selectedFolder).length === 0}
                            >
                              <SelectTrigger className="h-10 flex-1 border-white/25 bg-white/10 text-white">
                                <SelectValue placeholder="Move to folder..." />
                              </SelectTrigger>
                              <SelectContent className="bg-neutral-950 border-white/20 text-white">
                                {folders
                                  .filter((folder) => folder.id !== selectedFolder)
                                  .map((folder) => (
                                    <SelectItem key={folder.id} value={folder.id} className="text-white focus:bg-white/15">
                                      {folder.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <Button
                              onClick={() => handleMoveVideo(video.id)}
                              disabled={
                                !moveTargets[video.id] ||
                                movingVideoId === video.id ||
                                folders.filter((folder) => folder.id !== selectedFolder).length === 0
                              }
                              className="h-10 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-semibold"
                            >
                              {movingVideoId === video.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                'Move'
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setDeleteTarget({ id: video.id, title: video.title })}
                              className="h-10 border-red-500/50 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                              disabled={deleteVideoMutation.isPending}
                            >
                              Delete
                            </Button>
                          </div>
                          {folders.filter((folder) => folder.id !== selectedFolder).length === 0 && (
                            <p className="text-xs text-gray-500 mt-2">Create another folder first to move videos.</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-12 text-center">
                    <FolderPlus className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">No videos yet</h3>
                    <p className="text-gray-400 mb-6">
                      No videos in this folder yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </>
  );
}
