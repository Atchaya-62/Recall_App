import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="pt-28 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="glass-strong rounded-3xl p-10 md:p-14 relative overflow-hidden text-center">
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-amber-500/25 to-orange-500/10 blur-3xl" />

            <p className="text-amber-400 font-semibold mb-4 relative z-10">Recall Learning Platform</p>
            <h1 className="text-4xl md:text-6xl font-bold mb-5 relative z-10">
              Learn Faster,<br />
              <span className="text-gradient">Retain Longer</span>
            </h1>
            <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto mb-8 relative z-10">
              Turn YouTube videos into notes and flashcards, and keep your knowledge organized in one place.
            </p>

            <Button
              asChild
              size="lg"
              className="relative z-10 h-12 px-8 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
            >
              <a href="https://recall-cyan.vercel.app/login">
                Get Started
                <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="glass rounded-3xl p-10 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Start Learning with Recall?</h2>
            <p className="text-gray-300 mb-7 text-lg">Sign in to continue and manage all your notes and flashcards.</p>

            <Button
              asChild
              size="lg"
              className="h-12 px-8 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
            >
              <a href="https://recall-cyan.vercel.app/login">
                Get Started
                <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
