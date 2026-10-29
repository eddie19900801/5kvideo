import { useEffect, useState } from "react";

type Props = { ready: boolean; onDone: () => void };

export default function StartupLoading({ ready, onDone }: Props) {
  const [progress, setProgress] = useState(1);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (ready) return;
    const timer = window.setInterval(() => {
      setProgress(value => {
        if (value >= 96) return value;
        const step = value < 35 ? 5 : value < 70 ? 3 : value < 90 ? 2 : 1;
        return Math.min(96, value + step);
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    setProgress(100);
    const fadeTimer = window.setTimeout(() => setLeaving(true), 40);
    const doneTimer = window.setTimeout(onDone, 260);
    return () => { window.clearTimeout(fadeTimer); window.clearTimeout(doneTimer); };
  }, [ready, onDone]);

  return (
    <div className={`startup-loading${leaving ? " is-leaving" : ""}`} role="status" aria-live="polite">
      <div className="startup-loading-card">
        <div className="startup-loading-orbit"><i /><i /><i /></div>
        <strong>寻找最优线路中</strong>
        <div className="startup-loading-track"><span style={{ width: `${progress}%` }} /></div>
        <b>{progress}%</b>
      </div>
    </div>
  );
}
