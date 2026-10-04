import { describe, expect, it } from 'vitest';
import { nextOnboarding, OnboardingSeen, type SeenState } from '../src/ui/onboardingState';

function unseen(): SeenState {
  return { welcome: false, tour: false, rules: { sandbox: false, battle: false, siege: false } };
}

describe('onboarding decisions', () => {
  it('welcomes once, never automatically tours, and waits for sandbox play', () => {
    const seen = unseen();
    expect(nextOnboarding(seen, 'sandbox', false)).toBe('welcome');
    seen.welcome = true;
    expect(nextOnboarding(seen, 'sandbox', false, 'choose-play')).toBeNull();
    expect(nextOnboarding(seen, 'sandbox', false)).toBeNull();
    expect(seen.tour).toBe(false); // Let me play leaves the optional tour unseen.
    expect(nextOnboarding(seen, 'sandbox', false, 'play')).toBe('rules');
    seen.rules.sandbox = true;
    expect(nextOnboarding(seen, 'sandbox', false, 'play')).toBeNull();
  });

  it('offers rules after the chosen tour, then leaves the first play unobstructed', () => {
    const seen = unseen();
    seen.welcome = true;
    expect(nextOnboarding(seen, 'sandbox', false, 'choose-tour')).toBe('tour');
    expect(seen.tour).toBe(false); // Set only when the tour actually mounts.
    seen.tour = true;
    expect(nextOnboarding(seen, 'sandbox', false, 'tour-end')).toBe('rules');
    seen.rules.sandbox = true;
    expect(nextOnboarding(seen, 'sandbox', false, 'tour-end')).toBeNull();
    expect(nextOnboarding(seen, 'sandbox', false, 'play')).toBeNull();
  });

  it('keeps battle and siege first-visit cards independent of welcome and tour', () => {
    const seen = unseen();
    expect(nextOnboarding(seen, 'battle', false)).toBe('rules');
    seen.rules.battle = true;
    expect(nextOnboarding(seen, 'battle', false)).toBeNull();
    expect(nextOnboarding(seen, 'siege', false)).toBe('rules');
    expect(nextOnboarding(seen, 'sandbox', false)).toBe('welcome');
    seen.welcome = true;
    expect(nextOnboarding(seen, 'sandbox', false)).toBeNull();
  });

  it('suppresses automatic welcome and cards throughout all link visits without marking seen', () => {
    const seen = unseen();
    for (const mode of ['sandbox', 'battle', 'siege'] as const) {
      for (const event of ['visit', 'play', 'tour-end'] as const) {
        expect(nextOnboarding(seen, mode, true, event)).toBeNull();
      }
    }
    expect(seen).toEqual(unseen());
  });

  it('still welcomes returning users with only the old tour flag', () => {
    const seen = unseen();
    seen.tour = true;
    seen.rules.sandbox = true;
    expect(nextOnboarding(seen, 'sandbox', false)).toBe('welcome');
    seen.welcome = true;
    expect(nextOnboarding(seen, 'sandbox', false)).toBeNull();
  });
});

describe('onboarding seen state', () => {
  it('persists welcome at start independently of the optional tour and mode rules', () => {
    const values = new Map<string, string>();
    const storage = () => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    });
    const first = new OnboardingSeen(storage);
    first.welcomeSeen();
    const reload = new OnboardingSeen(storage);
    expect(reload.state.tour).toBe(false);
    expect(nextOnboarding(reload.state, 'sandbox', false)).toBeNull();
    expect(nextOnboarding(reload.state, 'sandbox', false, 'play')).toBe('rules');
    reload.tourSeen();
    reload.rulesSeen('sandbox');
    expect(nextOnboarding(new OnboardingSeen(storage).state, 'sandbox', false, 'play')).toBeNull();
    expect(nextOnboarding(reload.state, 'battle', false)).toBe('rules');
    expect([...values.keys()]).toEqual([
      'cute-life:welcome-seen', 'cute-life:tour-seen', 'cute-life:rules-seen:sandbox',
    ]);
  });

  it('uses page-local welcome and rules flags when storage access itself throws', () => {
    const seen = new OnboardingSeen(() => { throw new Error('blocked storage'); });
    expect(nextOnboarding(seen.state, 'sandbox', false)).toBe('welcome');
    seen.welcomeSeen();
    expect(nextOnboarding(seen.state, 'sandbox', false)).toBeNull();
    expect(seen.state.tour).toBe(false);
    expect(nextOnboarding(seen.state, 'sandbox', false, 'play')).toBe('rules');
    seen.rulesSeen('sandbox');
    expect(nextOnboarding(seen.state, 'sandbox', false, 'play')).toBeNull();
    expect(nextOnboarding(seen.state, 'battle', false)).toBe('rules');
  });

  it('handles read and write failures independently', () => {
    const seen = new OnboardingSeen(() => ({
      getItem() { throw new Error('read failed'); },
      setItem() { throw new Error('quota exceeded'); },
    }));
    seen.welcomeSeen();
    seen.tourSeen();
    seen.rulesSeen('battle');
    expect(nextOnboarding(seen.state, 'battle', false)).toBeNull();
    expect(nextOnboarding(seen.state, 'sandbox', false)).toBeNull();
    expect(nextOnboarding(seen.state, 'sandbox', false, 'play')).toBe('rules');
  });
});
