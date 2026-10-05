import type { Mode } from './modes';

export interface SeenState {
  welcome: boolean;
  tour: boolean;
  rules: Record<Mode, boolean>;
}

/** Link visits stay unobstructed for this page load, including mode changes. */
export function nextOnboarding(
  seen: SeenState, mode: Mode, linkVisit: boolean,
  event: 'visit' | 'play' | 'tour-end' | 'choose-tour' | 'choose-play' = 'visit',
): 'welcome' | 'tour' | 'rules' | null {
  // Explicit choices are allowed even when automatic onboarding is suppressed.
  if (event === 'choose-tour') return 'tour';
  if (event === 'choose-play') return null;
  if (linkVisit) return null;
  if (event === 'visit' && mode === 'sandbox') return seen.welcome ? null : 'welcome';
  return seen.rules[mode] ? null : 'rules';
}

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The provider also guards access to localStorage itself, which can throw. */
export class OnboardingSeen {
  readonly state: SeenState;

  constructor(private storage: () => Storage = () => localStorage) {
    this.state = {
      welcome: this.read('cute-life:welcome-seen'),
      tour: this.read('cute-life:tour-seen'),
      rules: {
        sandbox: this.read('cute-life:rules-seen:sandbox'),
        battle: this.read('cute-life:rules-seen:battle'),
        siege: this.read('cute-life:rules-seen:siege'),
      },
    };
  }

  welcomeSeen() {
    this.state.welcome = true;
    this.write('cute-life:welcome-seen');
  }

  tourSeen() {
    this.state.tour = true;
    this.write('cute-life:tour-seen');
  }

  rulesSeen(mode: Mode) {
    this.state.rules[mode] = true;
    this.write(`cute-life:rules-seen:${mode}`);
  }

  private read(key: string): boolean {
    try { return this.storage().getItem(key) === '1'; }
    catch { return false; }
  }

  private write(key: string) {
    try { this.storage().setItem(key, '1'); }
    catch { /* The in-memory flags still prevent repeat automatic prompts. */ }
  }
}
