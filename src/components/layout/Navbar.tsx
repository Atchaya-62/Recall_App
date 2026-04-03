import { Link, useLocation } from 'react-router-dom';
import { BookMarked, FolderOpen, LayoutDashboard, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function Navbar() {
  const location = useLocation();
  const { user, signOut } = useAuth();

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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <img
                src="/recall-logo.svg"
                alt="Recall"
                className="w-8 h-8 rounded-md group-hover:rotate-6 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-amber-500/10 blur-xl group-hover:bg-amber-500/20 transition-all duration-300" />
            </div>
            <span className="text-2xl font-bold text-gradient">Recall</span>
          </Link>

          <div className="flex items-center space-x-1 bg-white/5 rounded-full p-1 backdrop-blur-xl border border-white/10">
            <Link
              to="/"
              onClick={handleNavClick}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-200 ${
                isActive('/')
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-sm">Dashboard</span>
            </Link>

            <Link
              to="/folders"
              onClick={handleNavClick}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-200 ${
                isActive('/folders') || location.pathname.startsWith('/folder/')
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span className="text-sm">Folders</span>
            </Link>

            <Link
              to="/flashcards"
              onClick={handleNavClick}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-200 ${
                isActive('/flashcards')
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <BookMarked className="w-4 h-4" />
              <span className="text-sm">Review</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="glass px-4 py-2 rounded-full hover:bg-white/10 border border-white/10"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-black font-semibold text-sm">
                      {getUserInitials(displayName)}
                    </div>
                    <div className="hidden sm:block">
                      <span className="text-sm text-gray-300">
                        Welcome, <span className="text-amber-500 font-semibold">{displayName}</span>
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
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
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem
                  className="text-gray-300 focus:text-white focus:bg-white/10 cursor-pointer"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}
