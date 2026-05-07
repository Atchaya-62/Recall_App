import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookMarked, FolderOpen, LayoutDashboard, User, LogOut, Target, Flame, Zap, TrendingUp, LibraryBig } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { getDailyQuizSnapshot } from '@/lib/dailyQuiz';
import { getChallengeSnapshot } from '@/lib/challenges';

export default function Navbar() {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const [quizSnapshot, setQuizSnapshot] = useState(() => getDailyQuizSnapshot());
  const [challengeSnapshot, setChallengeSnapshot] = useState(() => getChallengeSnapshot());

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch (error: any) {
      toast.error('Failed to sign out');
    }
  };

  const handleNavClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  useEffect(() => {
    const refresh = () => setQuizSnapshot(getDailyQuizSnapshot());
    const refreshChallenges = () => setChallengeSnapshot(getChallengeSnapshot());
    refresh();
    refreshChallenges();

    window.addEventListener('storage', refresh);
    window.addEventListener('storage', refreshChallenges);
    const timer = window.setInterval(() => {
      refresh();
      refreshChallenges();
    }, 10000);

    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('storage', refreshChallenges);
      window.clearInterval(timer);
    };
  }, [location.pathname]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <img
                src="/recall-logo.svg"
                alt="Recall"
                className="w-8 h-8 rounded-md group-hover:rotate-6 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-amber-500/10 blur-xl group-hover:bg-amber-500/20 transition-all duration-300" />
            </div>
            <span className="hidden sm:inline text-2xl font-bold text-gradient">Recall</span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-3 bg-white/5 rounded-full p-1 backdrop-blur-xl border border-white/10">
            <Link
              to="/"
              onClick={handleNavClick}
              className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all duration-200 ${
                isActive('/')
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              title={t('nav.dashboard')}
              aria-label={t('nav.dashboard')}
            >
              <LayoutDashboard className="w-4 h-4" />
            </Link>

            <Link
              to="/folders"
              onClick={handleNavClick}
              className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all duration-200 ${
                isActive('/folders') || location.pathname.startsWith('/folder/')
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              title={t('nav.folders')}
              aria-label={t('nav.folders')}
            >
              <FolderOpen className="w-4 h-4" />
            </Link>

            <Link
              to="/flashcards"
              onClick={handleNavClick}
              className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all duration-200 ${
                isActive('/flashcards')
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              title="Quiz"
              aria-label="Quiz"
            >
              <BookMarked className="w-4 h-4" />
            </Link>

            <Link
              to="/courses"
              onClick={handleNavClick}
              className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all duration-200 ${
                isActive('/courses')
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              title="Courses"
              aria-label="Courses"
            >
              <LibraryBig className="w-4 h-4" />
            </Link>

            <Link
              to="/challenges"
              onClick={handleNavClick}
              className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-all duration-200 ${
                isActive('/challenges')
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
              title="Challenges"
              aria-label="Challenges"
            >
              <Target className="w-4 h-4" />
            </Link>

          </div>

          <div className="flex items-center gap-1 sm:gap-5 ml-1 sm:ml-4 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1 whitespace-nowrap text-xs sm:text-sm font-semibold text-orange-200 tabular-nums">
              <Flame className="w-3.5 h-3.5 text-orange-300" />
              {quizSnapshot.streak}
            </span>

            <span className="hidden md:inline-flex items-center gap-1 whitespace-nowrap text-xs sm:text-sm font-semibold text-amber-200 tabular-nums">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              {challengeSnapshot.totalXp}
            </span>

            <span className="hidden md:inline-flex items-center gap-1 whitespace-nowrap text-xs sm:text-sm font-semibold text-amber-200 tabular-nums">
              <TrendingUp className="w-3.5 h-3.5 text-amber-300" />
              {challengeSnapshot.level}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="glass px-1.5 py-1.5 sm:px-2 sm:py-2 rounded-full hover:bg-white/10 border border-white/10"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-black font-semibold text-sm">
                    {getUserInitials(displayName)}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 glass border-white/20 backdrop-blur-xl"
                align="end"
              >
                <div className="px-3 py-2">
                  <div className="text-sm font-medium text-white">{displayName}</div>
                  <div className="text-xs text-gray-400">{user?.email}</div>
                </div>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  className="text-gray-300 focus:text-white focus:bg-white/10 cursor-pointer"
                  asChild
                >
                  <Link to="/profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    {t('nav.profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  className="text-gray-300 focus:text-white focus:bg-white/10 cursor-pointer"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
