/** A mode can be listed but disabled ("coming soon") until it is ready to play. */
export const MODES = [
  { id: 'sandbox', name: 'sandbox', description: 'Draw cells and watch them grow.', disabled: false },
  { id: 'battle', name: 'garden battle', description: 'Red vs blue: grow your garden.', disabled: false },
  { id: 'siege', name: 'crystal siege', description: 'Red vs blue: crack the enemy crystal.', disabled: false },
] as const;

export type Mode = typeof MODES[number]['id'];
export type PlayableMode = Extract<typeof MODES[number], { disabled: false }>['id'];
