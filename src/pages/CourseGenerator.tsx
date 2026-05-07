import { useState } from 'react';
import { BookOpenText, Loader2, Sparkles, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateCoursePlan } from '@/lib/courseGenerator';
import { CourseGeneratorInput, GeneratedCoursePlan } from '@/types';
import { addStoredCourse } from '@/lib/courseStorage';

const LANGUAGES = ['Python', 'Java', 'C++', 'JavaScript', 'TypeScript', 'Go', 'None (General Topic)'];

export default function CourseGenerator() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [programmingLanguage, setProgrammingLanguage] = useState('None (General Topic)');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!topic.trim()) {
      toast.error('Enter a topic first, for example DSA.');
      return;
    }

    const input: CourseGeneratorInput = {
      topic: topic.trim(),
      ...(programmingLanguage !== 'None (General Topic)' && { programmingLanguage }),
    };

    setIsGenerating(true);
    try {
      const generatedPlan = await generateCoursePlan(input);
      const [savedCourse] = addStoredCourse(generatedPlan);
      toast.success('Personalized course generated and saved.');
      navigate('/courses', { state: { selectedCourseId: savedCourse?.id || null } });
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate course.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Back Button */}
        <div className="flex justify-start">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="glass border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <section className="glass-strong rounded-3xl p-6 sm:p-10 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/20 to-orange-500/10 blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4 text-amber-400">
              <Sparkles className="w-5 h-5" />
              <p className="text-sm font-semibold uppercase tracking-[0.12em]">AI Course Generator Dashboard</p>
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold mb-3">Build a personalized roadmap in seconds</h1>
            <p className="text-gray-300 max-w-3xl text-base sm:text-lg">
              Enter a topic and optionally select a programming language to generate a complete module roadmap with YouTube lessons,
              checkpoints, and progress tracking.
            </p>
          </div>
        </section>

        <section className="glass rounded-2xl p-6 border border-white/10">
          <h2 className="text-xl font-semibold mb-5">Course Setup</h2>

          <form onSubmit={handleGenerate} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm text-gray-300">Topic</label>
              <Input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="e.g. DSA"
                className="h-11 glass border-white/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300">Programming Language (Optional)</label>
              <select
                value={programmingLanguage}
                onChange={(event) => setProgrammingLanguage(event.target.value)}
                className="w-full h-11 rounded-xl bg-white/5 border border-white/20 px-3 text-sm"
              >
                {LANGUAGES.map((language) => (
                  <option key={language} value={language} className="bg-neutral-900">
                    {language}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="submit"
              disabled={isGenerating}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold"
            >
              {isGenerating ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : <BookOpenText className="mr-2 w-4 h-4" />}
              {isGenerating ? 'Generating Course...' : 'Generate Personalized Course'}
            </Button>
          </form>
        </section>

        <div className="glass rounded-2xl p-6 border border-white/10 text-sm text-gray-300">
          Your course will appear on the <span className="text-amber-400 font-semibold">Courses</span> page after generation.
        </div>
      </div>
    </div>
  );
}
