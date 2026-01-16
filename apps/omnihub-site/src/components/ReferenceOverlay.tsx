import { useState, useEffect, useCallback, useMemo } from 'react';

/** Default overlay opacity (0-1 scale) */
const DEFAULT_OPACITY = 0.35;
/** Opacity adjustment step for keyboard controls */
const OPACITY_STEP = 0.05;
/** Maximum opacity value */
const MAX_OPACITY = 1;
/** Minimum opacity value */
const MIN_OPACITY = 0;
/** Percentage multiplier for display */
const PERCENTAGE_MULTIPLIER = 100;
/** Z-index for overlay image layer */
const OVERLAY_Z_INDEX = 9999;
/** Z-index for control panel (above overlay) */
const CONTROL_PANEL_Z_INDEX = 10000;

/** Reference image paths by theme */
const REFERENCE_IMAGES = {
  light: '/reference/home-light.png',
  night: '/reference/home-night.png',
} as const;

type RefMode = 'light' | 'night';

/**
 * Reads the reference mode from URL query parameters.
 * This is safe as it only reads a whitelisted parameter value
 * and is used exclusively for development alignment purposes.
 */
function getInitialRefMode(): RefMode | null {
  if (typeof globalThis.window === 'undefined') return null;
  // Safe: Only reads 'ref' param, validates against whitelist
  const params = new URLSearchParams(globalThis.window.location.search);
  const ref = params.get('ref');
  if (ref === 'light' || ref === 'night') {
    return ref;
  }
  return null;
}

/**
 * Development-only overlay component for pixel-perfect alignment.
 * Renders a semi-transparent reference image over the page.
 *
 * Usage: Add ?ref=light or ?ref=night to URL
 *
 * Keyboard Controls:
 * - Ctrl+O: Toggle overlay visibility
 * - Shift+Up: Increase opacity
 * - Shift+Down: Decrease opacity
 */
export function ReferenceOverlay() {
  const initialRefMode = useMemo(() => getInitialRefMode(), []);
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY);
  const [visible, setVisible] = useState(initialRefMode !== null);
  const [refMode] = useState<RefMode | null>(initialRefMode);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!refMode) return;

      if (e.key === 'o' && e.ctrlKey) {
        e.preventDefault();
        setVisible((v) => !v);
      }

      if (e.key === 'ArrowUp' && e.shiftKey) {
        e.preventDefault();
        setOpacity((o) => Math.min(MAX_OPACITY, o + OPACITY_STEP));
      }

      if (e.key === 'ArrowDown' && e.shiftKey) {
        e.preventDefault();
        setOpacity((o) => Math.max(MIN_OPACITY, o - OPACITY_STEP));
      }
    },
    [refMode]
  );

  useEffect(() => {
    const { window } = globalThis;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Early return if no reference mode is active
  if (!refMode) return null;

  const imageSrc = REFERENCE_IMAGES[refMode];
  const opacityPercent = Math.round(opacity * PERCENTAGE_MULTIPLIER);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    target.style.display = 'none';
  };

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
            zIndex: OVERLAY_Z_INDEX,
            opacity,
          }}
          aria-hidden="true"
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
            onError={handleImageError}
          />
        </div>
      )}
      <output
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
          zIndex: CONTROL_PANEL_Z_INDEX,
          pointerEvents: 'auto',
        }}
        aria-label="Reference overlay controls"
        aria-live="polite"
      >
        <div style={{ marginBottom: 4 }}>
          <strong>Ref: {refMode}</strong> | Opacity: {opacityPercent}%
        </div>
        <div style={{ fontSize: 10, color: '#aaa' }}>
          Ctrl+O: toggle | Shift+Up/Down: opacity
        </div>
        <button
          type="button"
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
      </output>
    </>
  );
}
