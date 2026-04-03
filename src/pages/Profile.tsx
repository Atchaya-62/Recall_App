import { useMemo, useState } from 'react';
import { Check, Loader2, Mail, Save, Shield, UserCircle2, Video, FolderOpen, BookMarked } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAllFlashcards, useFolders, useVideos } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const formatDate = (value?: string): string => {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString();
};

const getInitials = (name: string): string =>
  name
    .split(' ')
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

export default function Profile() {
  const { user } = useAuth();
  const { data: folders = [], isLoading: foldersLoading } = useFolders();
  const { data: videos = [], isLoading: videosLoading } = useVideos();
  const { data: flashcards = [], isLoading: flashcardsLoading } = useAllFlashcards();

  const initialName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const [displayName, setDisplayName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);

  const stats = useMemo(() => {
    const masteredCount = flashcards.filter((card) => card.mastered).length;
    return {
      videos: videos.length,
      folders: folders.length,
      flashcards: flashcards.length,
      masteredCount,
      masteredRate: flashcards.length > 0 ? Math.round((masteredCount / flashcards.length) * 100) : 0,
    };
  }, [videos, folders, flashcards]);

  const isLoading = foldersLoading || videosLoading || flashcardsLoading;

  const handleSaveProfile = async () => {
    const nextName = displayName.trim();
    if (!nextName) {
      toast.error('Display name cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: nextName },
      });

      if (error) {
        throw error;
      }

      toast.success('Profile updated successfully.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <section className="glass-strong rounded-3xl p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/20 to-orange-500/10 blur-3xl" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-black text-2xl font-bold">
              {getInitials(displayName || initialName)}
            </div>
            <div className="flex-1">
              <p className="text-sm text-amber-400 font-semibold mb-2">Your Profile</p>
              <h1 className="text-3xl sm:text-4xl font-bold mb-1">{displayName || initialName}</h1>
              <p className="text-gray-300">Manage your account details and track learning progress.</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass rounded-2xl p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <UserCircle2 className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl font-semibold">Account Details</h2>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Display Name</label>
                <Input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your display name"
                  className="h-12 glass border-white/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Email Address</label>
                <div className="h-12 px-4 rounded-xl glass border border-white/20 flex items-center gap-2 text-gray-300">
                  <Mail className="w-4 h-4 text-amber-400" />
                  <span>{user?.email || 'Unavailable'}</span>
                </div>
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-semibold"
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xl font-semibold">Security</h2>
            </div>

            <div className="space-y-4 text-sm text-gray-300">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-gray-400 mb-1">Account Created</div>
                <div>{formatDate(user?.created_at)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-gray-400 mb-1">Last Sign In</div>
                <div>{formatDate(user?.last_sign_in_at)}</div>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Account status: Active</span>
              </div>
            </div>
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-6">Learning Snapshot</h2>

          {isLoading ? (
            <div className="py-10 flex items-center justify-center text-gray-400">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading your stats...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <Video className="w-4 h-4 text-amber-400" />
                  Videos
                </div>
                <div className="text-3xl font-bold">{stats.videos}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <FolderOpen className="w-4 h-4 text-orange-400" />
                  Folders
                </div>
                <div className="text-3xl font-bold">{stats.folders}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <BookMarked className="w-4 h-4 text-emerald-400" />
                  Flashcards
                </div>
                <div className="text-3xl font-bold">{stats.flashcards}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  Mastery
                </div>
                <div className="text-3xl font-bold">{stats.masteredRate}%</div>
                <div className="text-xs text-gray-500 mt-1">{stats.masteredCount} cards mastered</div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}