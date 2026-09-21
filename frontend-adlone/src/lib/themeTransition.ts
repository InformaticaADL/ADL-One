// Animación de cambio de tema con la View Transitions API nativa: revela el
// nuevo tema con un círculo que crece desde el punto donde se hizo click.
// Adaptado de "Skiper 26" (skiper-ui.com, variante circle) a CSS/JS puro,
// sin framer-motion ni next-themes (no usados en este proyecto).
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

export function playThemeTransition(x: number, y: number, toggle: () => void) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!document.startViewTransition || prefersReducedMotion) {
        toggle();
        return;
    }

    const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
    );

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
                clip-path: circle(0px at ${x}px ${y}px);
            }
            to {
                clip-path: circle(${endRadius}px at ${x}px ${y}px);
            }
        }
    `;

    document.startViewTransition(toggle);
}
