import { PropsWithChildren, useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

type Props = PropsWithChildren<{
  to?: string;           // where to send the user
  clicks?: number;       // how many rapid clicks
  windowMs?: number;     // click window
}>;

/** Wrap any element. Triggers when:
 *  - Rapid n-clicks (default 3) OR
 *  - Alt+Click OR
 *  - Key sequence: L O G I N (within 1.5s)
 */
export default function SecretLogin({
  children,
  to = "/login?tab=signin&src=secret",
  clicks = 3,
  windowMs = 1200
}: Props) {
  const nav = useNavigate();
  const [seq, setSeq] = useState<string>("");
  const timer = useRef<number | null>(null);
  const clickTimes = useRef<number[]>([]);

  const go = useCallback(() => nav(to), [nav, to]);

  const onClick = (e: React.MouseEvent) => {
    if (e.altKey) return go();
    const now = Date.now();
    clickTimes.current.push(now);
    // keep only clicks within window
    clickTimes.current = clickTimes.current.filter(t => now - t <= windowMs);
    if (clickTimes.current.length >= clicks) go();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const next = (seq + k).slice(-5);
      setSeq(next);
      if (timer.current) globalThis.clearTimeout(timer.current);
      timer.current = globalThis.setTimeout(() => setSeq(""), 1500);
      if (next === "login") go();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => {
      globalThis.removeEventListener("keydown", onKey);
      if (timer.current) globalThis.clearTimeout(timer.current);
    };
  }, [seq, go]);

  // Non-intrusive wrapper: no styles, no tab stop.
  return <span onClick={onClick} style={{ display: "contents" }}>{children}</span>;
}
