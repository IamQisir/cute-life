import { describe, expect, it } from 'vitest';
import { nextOnboarding, OnboardingSeen, type SeenState } from '../src/ui/onboardingState';

function unseen(): SeenState {
  return { tour: false, rules: { sandbox: false, battle: false, siege: false } };
}

describe('onboarding decisions', () => {
  it('shows the tour, then sandbox rules, then nothing', () => {
    const seen = unseen();
    expect(nextOnboarding(seen, 'sandbox', false)).toBe('tour');
    seen.tour = true;
    expect(nextOnboarding(seen, 'sandbox', false)).toBe('rules');
    seen.rules.sandbox = true;
    expect(nextOnboarding(seen, 'sandbox', false)).toBeNull();
  });

  it('remembers each mode independently, including the future siege card', () => {
    const seen = unseen();
    seen.tour = true;
    seen.rules.sandbox = true;
    expect(nextOnboarding(seen, 'battle', false)).toBe('rules');
    seen.rules.battle = true;
    expect(nextOnboarding(seen, 'battle', false)).toBeNull();
    expect(nextOnboarding(seen, 'sandbox', false)).toBeNull();
    expect(nextOnboarding(seen, 'siege', false)).toBe('rules');
  });

  it('suppresses automatic tours and cards throughout a link visit without marking them seen', () => {
    const seen = unseen();
    expect(nextOnboarding(seen, 'sandbox', true)).toBeNull();
    expect(nextOnboarding(seen, 'battle', true)).toBeNull();
    expect(seen).toEqual(unseen());
    seen.tour = true;
    expect(nextOnboarding(seen, 'battle', true)).toBeNull();
    expect(nextOnboarding(seen, 'battle', false)).toBe('rules');
  });
});

describe('onboarding seen state', () => {
  it('persists shown prompts across reloads, leaving other modes unseen', () => {
    const values = new Map<string, string>();
    const storage = () => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    });
    const first = new OnboardingSeen(storage);
    first.tourSeen();
    first.rulesSeen('sandbox');
    const reload = new OnboardingSeen(storage);
    expect(nextOnboarding(reload.state, 'sandbox', false)).toBeNull();
    expect(nextOnboarding(reload.state, 'battle', false)).toBe('rules');
    reload.rulesSeen('battle');
    expect(nextOnboarding(new OnboardingSeen(storage).state, 'battle', false)).toBeNull();
    expect([...values.keys()]).toEqual([
      'cute-life:tour-seen', 'cute-life:rules-seen:sandbox', 'cute-life:rules-seen:battle',
    ]);
  });

  it('uses page-local flags when storage access itself throws', () => {
    const seen = new OnboardingSeen(() => { throw new Error('blocked storage'); });
    expect(nextOnboarding(seen.state, 'sandbox', false)).toBe('tour');
    seen.tourSeen(); // Closing or skipping never allows another automatic tour.
    expect(nextOnboarding(seen.state, 'sandbox', false)).toBe('rules');
    seen.rulesSeen('sandbox');
    expect(nextOnboarding(seen.state, 'sandbox', false)).toBeNull();
    expect(nextOnboarding(seen.state, 'battle', false)).toBe('rules');
  });

  it('handles read and write failures independently', () => {
    const seen = new OnboardingSeen(() => ({
      getItem() { throw new Error('read failed'); },
      setItem() { throw new Error('quota exceeded'); },
    }));
    seen.tourSeen();
    seen.rulesSeen('battle');
    expect(nextOnboarding(seen.state, 'battle', false)).toBeNull();
    expect(nextOnboarding(seen.state, 'sandbox', false)).toBe('rules');
  });
});
