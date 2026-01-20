/**
 * Registers the Service Worker for offline capability.
 */
export function registerSW() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            const swUrl = '/sw.js';

            navigator.serviceWorker
                .register(swUrl)
                .then((registration) => {
                    // eslint-disable-next-line no-console
                    console.log('[MAESTRO] Service Worker registered: ', registration.scope);

                    registration.onupdatefound = () => {
                        const installingWorker = registration.installing;
                        if (installingWorker == null) {
                            return;
                        }
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    // New content is available; please refresh.
                                    // eslint-disable-next-line no-console
                                    console.log('[MAESTRO] New content is available; please refresh.');
                                } else {
                                    // Content is cached for offline use.
                                    // eslint-disable-next-line no-console
                                    console.log('[MAESTRO] Content is cached for offline use.');
                                }
                            }
                        };
                    };
                })
                .catch((error) => {
                    console.error('[MAESTRO] Service Worker registration failed:', error);
                });
        });
    }
}

export function unregister() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
            .then((registration) => {
                registration.unregister();
            })
            .catch((error) => {
                console.error(error.message);
            });
    }
}
