// Hand-drawn SVG artwork for the service cards, one per item, in the
// AEM Baltic palette (brick red #8a3324 → terracotta #d96844 → pale #ffb391).
// Indexed to match content.js hscroll.items order.

const GRAD = `
  <defs>
    <linearGradient id="aem-up" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#8a3324"/><stop offset="1" stop-color="#d96844"/>
    </linearGradient>
    <linearGradient id="aem-diag" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d96844"/><stop offset="1" stop-color="#8a3324"/>
    </linearGradient>
  </defs>`;

export const cardArt = [
  // 01 — Performance marketing: rising bars + growth arrow
  `<svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${GRAD}
    <rect x="32" y="92" width="26" height="40" rx="9" fill="url(#aem-up)" opacity="0.75"/>
    <rect x="68" y="70" width="26" height="62" rx="9" fill="url(#aem-up)" opacity="0.88"/>
    <rect x="104" y="46" width="26" height="86" rx="9" fill="url(#aem-up)"/>
    <path d="M34 80 C 74 64, 106 52, 146 32" stroke="#ffb391" stroke-width="7" stroke-linecap="round"/>
    <path d="M160 18 L132 26 L146 46 Z" fill="#ffb391"/>
    <circle cx="164" cy="66" r="5" fill="#ffb391" opacity="0.7"/>
    <circle cx="152" cy="86" r="3.5" fill="#ffb391" opacity="0.45"/>
  </svg>`,

  // 02 — Social & content: chat bubbles + like
  `<svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${GRAD}
    <path d="M30 50 q0 -20 20 -20 h52 q20 0 20 20 v24 q0 20 -20 20 h-40 l-22 18 4 -20 q-14 -3 -14 -18 z" fill="url(#aem-diag)"/>
    <circle cx="60" cy="62" r="6" fill="#ffb391"/>
    <circle cx="81" cy="62" r="6" fill="#ffb391"/>
    <circle cx="102" cy="62" r="6" fill="#ffb391"/>
    <rect x="102" y="66" width="72" height="52" rx="17" fill="rgba(12,8,7,0.35)" stroke="#ffb391" stroke-width="5"/>
    <path d="M138 106 c-11 -8 -17 -13 -17 -20 a8.5 8.5 0 0 1 17 -5 a8.5 8.5 0 0 1 17 5 c0 7 -6 12 -17 20 z" fill="#ffb391"/>
    <circle cx="170" cy="44" r="4" fill="#d96844" opacity="0.8"/>
  </svg>`,

  // 03 — SEO & data: magnifier over a chart
  `<svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${GRAD}
    <g fill="#ffb391" opacity="0.3">
      <circle cx="30" cy="30" r="3"/><circle cx="58" cy="26" r="3"/><circle cx="150" cy="30" r="3"/>
      <circle cx="172" cy="58" r="3"/><circle cx="30" cy="118" r="3"/><circle cx="166" cy="112" r="3"/>
    </g>
    <circle cx="88" cy="66" r="44" fill="rgba(217,104,68,0.14)" stroke="url(#aem-diag)" stroke-width="8"/>
    <path d="M62 82 L78 64 L92 74 L114 46" stroke="#ffb391" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M120 100 L150 128" stroke="url(#aem-up)" stroke-width="12" stroke-linecap="round"/>
  </svg>`,

  // 04 — Brand campaigns: megaphone + rays
  `<svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${GRAD}
    <path d="M44 66 q-6 1 -6 8 v8 q0 7 6 8 l56 18 q7 2 7 -5 V53 q0 -7 -7 -5 z" fill="url(#aem-diag)"/>
    <rect x="103" y="42" width="16" height="72" rx="8" fill="#d96844"/>
    <rect x="56" y="90" width="14" height="26" rx="6" fill="#8a3324"/>
    <path d="M130 52 L156 34" stroke="#ffb391" stroke-width="6" stroke-linecap="round"/>
    <path d="M136 78 L172 78" stroke="#ffb391" stroke-width="6" stroke-linecap="round"/>
    <path d="M130 104 L156 122" stroke="#ffb391" stroke-width="6" stroke-linecap="round"/>
    <path d="M170 40 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 z" fill="#ffb391"/>
  </svg>`,
];
