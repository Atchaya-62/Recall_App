import { useEffect, useMemo, useState } from 'react';
import { Trophy, Zap, Target } from 'lucide-react';
import { getChallengeSnapshot } from '../lib/challenges';

export default function Challenges() {
  const [snapshot, setSnapshot] = useState(() => getChallengeSnapshot());

  useEffect(() => {
    const refresh = () => setSnapshot(getChallengeSnapshot());
    refresh();

    const timer = window.setInterval(refresh, 10000);
    window.addEventListener('storage', refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const levelProgress = useMemo(() => {
    if (snapshot.xpForNextLevel <= 0) return 0;
    return (snapshot.xpIntoLevel / snapshot.xpForNextLevel) * 100;
  }, [snapshot.xpForNextLevel, snapshot.xpIntoLevel]);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-strong rounded-3xl p-8 mb-8 border border-white/10 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-56 h-56 bg-amber-500/20 blur-3xl rounded-full" />
          <div className="absolute -left-20 -bottom-20 w-56 h-56 bg-orange-500/20 blur-3xl rounded-full" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <h1 className="text-4xl font-bold">Daily Challenges</h1>
              <div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-amber-200 text-sm font-semibold">
                3 rotating quests daily
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="glass rounded-2xl p-4 border border-white/10">
                <p className="text-sm text-gray-400 mb-1">Total XP</p>
                <p className="text-3xl font-bold text-amber-300">{snapshot.totalXp}</p>
              </div>
              <div className="glass rounded-2xl p-4 border border-white/10">
                <p className="text-sm text-gray-400 mb-1">Level</p>
                <p className="text-3xl font-bold text-amber-300">Lv {snapshot.level}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
                <span>Level Progress</span>
                <span>{snapshot.xpIntoLevel}/{snapshot.xpForNextLevel} XP</span>
              </div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400" style={{ width: `${Math.min(100, levelProgress)}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {snapshot.challenges.map((challenge) => (
            <div key={challenge.id} className="glass rounded-2xl p-5 border border-white/10">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-xl font-semibold">{challenge.title}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {challenge.progress}/{challenge.target} completed
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm text-amber-300 font-semibold inline-flex items-center gap-1">
                    <Zap className="w-4 h-4" /> +{challenge.xp} XP
                  </p>
                  <p className={`text-xs mt-1 ${challenge.completed ? 'text-emerald-300' : 'text-gray-400'}`}>
                    {challenge.completed ? (challenge.claimed ? 'Completed • XP credited' : 'Completed') : 'In progress'}
                  </p>
                </div>
              </div>

              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full ${challenge.completed ? 'bg-gradient-to-r from-emerald-400 to-lime-300' : 'bg-gradient-to-r from-amber-400 to-orange-400'}`}
                  style={{ width: `${Math.min(100, (challenge.progress / challenge.target) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl p-5 border border-white/10 mt-8">
          <p className="text-sm text-gray-300 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-300" />
            Complete all 3 challenges daily to keep your progression moving and unlock more XP.
          </p>
        </div>
      </div>
    </div>
  );
}
