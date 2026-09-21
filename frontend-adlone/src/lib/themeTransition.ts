// Animación de cambio de tema con la View Transitions API nativa: revela el
// nuevo tema con un rectángulo que crece de arriba hacia abajo.
// Adaptado de "Skiper 26" (skiper-ui.com, variante rectangle/top-down) a
// CSS/JS puro, sin framer-motion ni next-themes (no usados en este proyecto).
const STYLE_ID = 'theme-transition-styles';

function getStyleElement() {
    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = STYLE_ID;
        document.head.appendChild(styleEl);
    }
    return styleEl;
}

export function playThemeTransition(toggle: () => void) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!document.startViewTransition || prefersReducedMotion) {
        toggle();
        return;
    }

    getStyleElement().textContent = `
        ::view-transition-group(root) {
            animation-duration: 600ms;
            animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1);
        }
        ::view-transition-new(root) {
            animation-name: theme-reveal;
        }
        ::view-transition-old(root),
        html[data-theme="dark"]::view-transition-old(root) {
            animation: none;
            z-index: -1;
        }
        @keyframes theme-reveal {
            from {
                clip-path: polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%);
            }
            to {
                clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%);
            }
        }
    `;

    document.startViewTransition(toggle);
}
