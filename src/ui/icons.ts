/** Slightly uneven paths keep the tiny controls in the same sketchbook style. */
const speaker = 'M3 9.2 L7.1 9 L11.4 5.3 L11.1 18.8 L7 15 L3.2 15 Z';
export const ICONS = {
  sandbox: ['M5 7 Q12 4.8 18 7 L18.3 18 Q12 20 5.2 18 Z', 'M8 11 L8.2 11.2 M15 10.8 L15.2 11 M9 15 Q12 17 15 14.8'],
  battle: ['M3 8 Q7 6 10 8 L10.3 17 L3.2 17 Z M14 7 Q18 5.3 21 7 L20.8 16 L14.1 16 Z', 'M5 11 L5.2 11 M8 11 L8.2 11 M16 10 L16.2 10 M19 10 L19.2 10 M10 20 L14 19'],
  siege: ['M12 2.8 L19 9 L16.8 17 L11.8 21.2 L7 15.2 L5.2 8.6 Z', 'M12 2.8 L10.6 9.4 L11.8 21.2 M5.2 8.6 L10.6 9.4 L19 9'],
  record: ['M17 12 A5 5 0 1 1 7 12 A5 5 0 1 1 17 12 Z'],
  share: ['M5 11 L4.8 20 L19 19.8 L19 11', 'M12 15 L12.2 3 M7.5 7.5 L12.2 3 L16.5 7.4'],
  follow: ['M3 8 L7 8 L8.4 5 L15.5 5.2 L17 8 L21 8.2 L20.8 19 L3.2 18.8 Z', 'M15.8 13 A3.8 3.8 0 1 1 8.2 13 A3.8 3.8 0 1 1 15.8 13 M12 11 L12 15 M10 13 L14 13'],
  select: ['M8 4 L4 4.2 L4.2 8 M16 4 L20 4.1 L19.8 8 M20 16 L20 20 L16 19.8 M8 20 L4.1 20 L4 16', 'M4 11 L4 13 M20 11 L20 13 M11 4 L13 4 M11 20 L13 20'],
  move: ['M7 13 L7 6 Q8 3.5 9.5 6 L9.5 11 L9.8 3.8 Q11.2 1.8 12.5 4 L12.5 11 L13 5 Q14.5 3 15.5 5.2 L15.5 12 L16 8 Q17.5 6.5 18.7 8.5 L18.3 16 Q18 21 12 21 Q8 21 5.5 17 L3.5 13 Q3 10.5 5 11.5 L7 13 Z'],
  soundAll: [speaker, 'M15 8 Q19 12 15 16 M18 5 Q24 12 18 19'],
  soundMusic: [speaker, 'M17 14 L17 5 L21 4 L21 12 M17 14 Q13 12 14 16 Q17 18 17 14 M21 12 Q18 10 18 14 Q21 16 21 12'],
  soundOff: [speaker, 'M16 9 L21 15 M21 9 L16 15'],
  help: ['M8 7 Q8 3 12 3 Q17 3 17 7 Q17 10 12 12 L12 15', 'M12 19 L12.1 19.2'],
  settings: ['M9 3 L14 3.2 L15 6 L18 5.5 L21 9 L19 12 L21 15 L18 18.5 L15 18 L14 21 L9 20.8 L8 18 L5 18.5 L2.8 15 L5 12 L3 9 L5.5 5.5 L8 6 Z', 'M16 12 A4 4 0 1 1 8 12 A4 4 0 1 1 16 12 Z'],
  rotate: ['M18.8 8 Q16 3 10 4 Q3 5 4 12 Q4.5 20 12 20 Q17 20 20 15', 'M14 8 L19.5 8.3 L20 3'],
  flip: ['M12 3 L12.2 6 M12 9 L12 15 M12 18 L12 21', 'M3 8 L9 8.2 M3 8 L5.5 5.5 M3 8 L5.5 10.5 M21 16 L15 15.8 M21 16 L18.5 13.5 M21 16 L18.5 18.5'],
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('toolbar-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const d of ICONS[name]) {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
