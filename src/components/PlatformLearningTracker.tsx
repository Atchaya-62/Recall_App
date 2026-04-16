import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { recordChallengeEvent } from '@/lib/challenges';

const MS_PER_MINUTE = 60 * 1000;

function getIsWindowActive(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  return document.visibilityState === 'visible' && document.hasFocus();
}

export default function PlatformLearningTracker() {
  const { user, loading } = useAuth();
  const [isWindowActive, setIsWindowActive] = useState(getIsWindowActive);
  const bufferedMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    const updateWindowActivity = () => {
      setIsWindowActive(getIsWindowActive());
    };

    window.addEventListener('focus', updateWindowActivity);
    window.addEventListener('blur', updateWindowActivity);
    document.addEventListener('visibilitychange', updateWindowActivity);

    return () => {
      window.removeEventListener('focus', updateWindowActivity);
      window.removeEventListener('blur', updateWindowActivity);
      document.removeEventListener('visibilitychange', updateWindowActivity);
    };
  }, []);

  useEffect(() => {
    const flushWholeMinutes = () => {
      const wholeMinutes = Math.floor(bufferedMsRef.current / MS_PER_MINUTE);
      if (wholeMinutes > 0) {
        recordChallengeEvent('learning_minutes', wholeMinutes);
        bufferedMsRef.current -= wholeMinutes * MS_PER_MINUTE;
      }
    };

    const tick = () => {
      const now = Date.now();

      if (lastTickRef.current === null) {
        lastTickRef.current = now;
        return;
      }

      const elapsed = now - lastTickRef.current;
      lastTickRef.current = now;

      if (loading || !user || !isWindowActive) {
        return;
      }

      bufferedMsRef.current += Math.max(0, elapsed);
      flushWholeMinutes();
    };

    const intervalId = window.setInterval(tick, 15000);
    tick();

    return () => {
      window.clearInterval(intervalId);
      flushWholeMinutes();
      lastTickRef.current = null;
    };
  }, [loading, user, isWindowActive]);

  return null;
}