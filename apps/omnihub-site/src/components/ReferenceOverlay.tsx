import { useState, useEffect } from 'react';

/**
 * Reference Overlay for pixel-perfect alignment verification
 * Triggered by query param ?overlay=night OR ?overlay=light
 * Toggle visibility associated with 'o' key
 */
export function ReferenceOverlay() {
    const [opacity, setOpacity] = useState(0.35);
    const [isVisible, setIsVisible] = useState(true);
    const [overlayType, setOverlayType] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const overlay = params.get('overlay');
        if (overlay === 'light' || overlay === 'night') {
            setOverlayType(overlay);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'o') {
                setIsVisible((prev) => !prev);
            }
        };
        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, []);

    if (!overlayType || !isVisible) return null;

    const imagePath = overlayType === 'light'
        ? '/reference/home-light.png'
        : '/reference/home-night.png';

    return (
        <>
            <div
                className="reference-overlay"
                style={{
                    opacity,
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    pointerEvents: 'none',
                }}
            >
                <img
                    src={imagePath}
                    alt="Reference Overlay"
                    style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                    }}
                />
            </div>

            <div
                style={{
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    zIndex: 10000,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: '8px',
                    borderRadius: '4px',
                    color: 'white',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                }}
            >
                <div>Using: {overlayType}</div>
                <div>opacity: {Math.round(opacity * 100)}%</div>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    style={{ width: '100px' }}
                />
                <div style={{ color: '#aaa', fontSize: '10px' }}>Press 'o' to toggle</div>
            </div>
        </>
    );
}
