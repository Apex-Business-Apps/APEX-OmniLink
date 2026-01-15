import { useState, useEffect, useCallback, useMemo } from 'react';

function getInitialRefMode(): 'light' | 'night' | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref === 'light' || ref === 'night') {
    return ref;
  }
  return null;
}

/**
 * Development-only overlay component for pixel-perfect alignment
 * Usage: Add ?ref=light or ?ref=night to URL
 */
export function ReferenceOverlay() {
  const initialRefMode = useMemo(() => getInitialRefMode(), []);
  const [opacity, setOpacity] = useState(0.35);
  const [visible, setVisible] = useState(initialRefMode !== null);
  const [refMode] = useState<'light' | 'night' | null>(initialRefMode);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!refMode) return;
      if (e.key === 'o' && e.ctrlKey) {
        e.preventDefault();
        setVisible((v) => !v);
      }
      if (e.key === 'ArrowUp' && e.shiftKey) {
        e.preventDefault();
        setOpacity((o) => Math.min(1, o + 0.05));
      }
      if (e.key === 'ArrowDown' && e.shiftKey) {
        e.preventDefault();
        setOpacity((o) => Math.max(0, o - 0.05));
      }
    },
    [refMode]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!refMode) return null;

  const imageSrc =
    refMode === 'light'
      ? '/reference/home-light.png'
      : '/reference/home-night.png';

  return (
    <>
      {visible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 9999,
            opacity,
          }}
        >
          <img
            src={imageSrc}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      )}
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          padding: '8px 12px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          fontSize: '12px',
          fontFamily: 'monospace',
          borderRadius: '4px',
          zIndex: 10000,
          pointerEvents: 'auto',
        }}
      >
        <div style={{ marginBottom: 4 }}>
          <strong>Ref: {refMode}</strong> | Opacity: {Math.round(opacity * 100)}
          %
        </div>
        <div style={{ fontSize: 10, color: '#aaa' }}>
          Ctrl+O: toggle | Shift+Up/Down: opacity
        </div>
        <button
          onClick={() => setVisible((v) => !v)}
          style={{
            marginTop: 6,
            padding: '4px 8px',
            fontSize: 11,
            cursor: 'pointer',
            backgroundColor: visible ? '#ef4444' : '#22c55e',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
          }}
        >
          {visible ? 'Hide Overlay' : 'Show Overlay'}
        </button>
      </div>
    </>
  );
}
