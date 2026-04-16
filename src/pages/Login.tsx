import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Mail, Lock, LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, requestPasswordReset } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      const message = error.message.toLowerCase();

      if (message.includes('invalid login credentials')) {
        toast.error('Invalid email or password. If you have not confirmed your account yet, verify your email first.');
      } else if (message.includes('email not confirmed')) {
        toast.error('Please confirm your email before signing in. Check your inbox/spam folder.');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Welcome back!');
      navigate('/');
    }

    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Enter your email first, then click Forgot password.');
      return;
    }

    setLoading(true);
    const { error } = await requestPasswordReset(email);

    if (error) {
      const message = error.message.toLowerCase();

      if (message.includes('error sending recovery email')) {
        toast.error('Unable to send reset email. In Supabase, configure SMTP in Authentication > Settings > SMTP Settings, then try again.');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Password reset email sent. Check your inbox/spam folder.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <a
        href="https://recall-ai-landing-page.vercel.app/"
        className="fixed top-6 left-6 inline-flex items-center text-amber-500 hover:text-amber-400 z-20"
        aria-label="Back to landing page"
        title="Back to landing page"
      >
        <ArrowLeft className="w-5 h-5" />
      </a>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/recall-logo.svg" alt="Recall" className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-bold mb-2">
            Welcome to <span className="text-gradient">Recall</span>
          </h1>
          <p className="text-gray-400">Sign in to continue your learning journey</p>
        </div>

        <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email" className="flex items-center space-x-2 mb-2">
                <Mail className="w-4 h-4" />
                <span>Email</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="glass border-white/20"
              />
            </div>

            <div>
              <Label htmlFor="password" className="flex items-center space-x-2 mb-2">
                <Lock className="w-4 h-4" />
                <span>Password</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="glass border-white/20"
              />
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs text-amber-500 hover:text-amber-400 disabled:opacity-50"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
            >
              <LogIn className="w-4 h-4 mr-2" />
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-amber-500 hover:text-amber-400 font-semibold">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
