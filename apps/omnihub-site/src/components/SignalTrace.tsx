/**
 * SignalTrace - Signature motion element
 * A subtle animated line that traces across the hero section
 * Respects prefers-reduced-motion via CSS
 */
export function SignalTrace() {
  return (
    <div className="signal-trace" aria-hidden="true">
      <svg viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
        <path
          className="signal-trace-line"
          d="M0,200 Q150,180 300,200 T600,200 T900,200 T1200,200"
        />
        <path
          className="signal-trace-line"
          d="M0,180 Q200,160 400,180 T800,180 T1200,180"
          style={{ animationDelay: '2s' }}
        />
      </svg>
    </div>
  );
}
