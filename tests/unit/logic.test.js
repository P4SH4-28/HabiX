import {
  DAILY_GOLD_CAP,
  DAILY_XP_CAP,
  MAX_ACTIVE_HABITS,
  XP_BANK_DAILY_RELEASE,
  XP_BANK_MAX,
  applyXpWithBank,
  bestStreak,
  buildDailyCompletions,
  calcStreak,
  completionForDay,
  dateKey,
  dayPenalty,
  daysAgo,
  emptyDayCounter,
  formatDuration,
  hashPassword,
  levelFromTotalXp,
  makeRecoveryKey,
  streakBonusFor,
  todayKey,
  totalCompletions,
  weeklyComparison,
} from '../../src/logic';

const key = (offset) => todayKey(offset);

describe('date helpers', () => {
  test('dateKey formats as YYYY-MM-DD with padding', () => {
    expect(dateKey(new Date(2024, 0, 5))).toBe('2024-01-05');
    expect(dateKey(new Date(2024, 11, 31))).toBe('2024-12-31');
  });

  test('dateKey does not use UTC (no timezone shift)', () => {
    const d = new Date(2024, 11, 31, 23, 30, 0);
    expect(dateKey(d)).toBe('2024-12-31');
  });

  test('todayKey honours offsetDays', () => {
    expect(todayKey(1)).toBe(dateKey(new Date(Date.now() + 86400000)));
    expect(todayKey(0)).toBe(dateKey(new Date()));
  });

  test('daysAgo walks backwards', () => {
    expect(dateKey(daysAgo(3))).toBe(todayKey(-3));
  });
});

describe('hashPassword', () => {
  test('is deterministic', () => {
    expect(hashPassword('abc')).toBe(hashPassword('abc'));
  });

  test('different passwords produce different hashes', () => {
    expect(hashPassword('abc')).not.toBe(hashPassword('abd'));
  });

  test('produces 16 hex chars', () => {
    expect(hashPassword('secret')).toMatch(/^[0-9a-f]{16}$/);
  });

  test('salt changes output', () => {
    expect(hashPassword('abc', 's1')).not.toBe(hashPassword('abc', 's2'));
  });
});

describe('calcStreak', () => {
  test('empty history is 0', () => {
    expect(calcStreak([], key(0))).toBe(0);
  });

  test('only today done → 1', () => {
    expect(calcStreak([key(0)], key(0))).toBe(1);
  });

  test('today missing but yesterday done → 0 (farm protection)', () => {
    expect(calcStreak([key(-1)], key(0))).toBe(0);
  });

  test('consecutive days count backwards from today', () => {
    expect(calcStreak([key(0), key(-1), key(-2)], key(0))).toBe(3);
  });

  test('gap breaks the chain', () => {
    expect(calcStreak([key(0), key(-2)], key(0))).toBe(1);
  });

  test('unsorted input is tolerated', () => {
    expect(calcStreak([key(-2), key(0), key(-1)], key(0))).toBe(3);
  });

  test('freezeDay keeps the chain alive when today is skipped', () => {
    expect(calcStreak([key(-1), key(-2)], key(0), key(0))).toBe(3);
  });

  test('freezeDay alone does not start a new streak', () => {
    expect(calcStreak([], key(0), key(-5))).toBe(0);
  });

  test('freezeDay covers a past gap', () => {
    // today + 2 gün önce tamamlandı, freezeDay = dün → zincir kesintisiz
    expect(calcStreak([key(0), key(-2)], key(0), key(-1))).toBe(3);
  });

  test('streak does not survive into the future', () => {
    expect(calcStreak([key(-1), key(-2)], key(0))).toBe(0);
  });
});

describe('levelFromTotalXp', () => {
  test('0 xp is level 1', () => {
    expect(levelFromTotalXp(0)).toEqual({
      level: 1,
      cumXp: 0,
      curXp: 0,
      nextThreshold: 100,
    });
  });

  test('exactly at first threshold → level 2', () => {
    const r = levelFromTotalXp(100);
    expect(r.level).toBe(2);
    expect(r.curXp).toBe(0);
    expect(r.nextThreshold).toBe(200);
  });

  test('one below threshold stays level 1', () => {
    const r = levelFromTotalXp(99);
    expect(r.level).toBe(1);
    expect(r.curXp).toBe(99);
  });

  test('thresholds grow by 100 each level (100,200,300...)', () => {
    const r = levelFromTotalXp(100 + 200 + 50); // L1+L2 tamam + L3 yarısı
    expect(r.level).toBe(3);
    expect(r.cumXp).toBe(300);
    expect(r.curXp).toBe(50);
    expect(r.nextThreshold).toBe(300);
  });

  test('negative xp never yields below level 1', () => {
    const r = levelFromTotalXp(-50);
    expect(r.level).toBe(1);
    expect(r.curXp).toBe(-50);
  });

  test('monotonic: more xp never lowers the level', () => {
    let prev = 0;
    for (let xp = 0; xp <= 5000; xp += 37) {
      const lv = levelFromTotalXp(xp).level;
      expect(lv).toBeGreaterThanOrEqual(prev);
      prev = lv;
    }
  });
});

describe('applyXpWithBank (daily cap + XP bank)', () => {
  const day = () => emptyDayCounter(key(0));

  test('gain under the cap is fully credited', () => {
    const r = applyXpWithBank(day(), 0, 50);
    expect(r.freshXp).toBe(50);
    expect(r.totalXpGain).toBe(50);
    expect(r.overflow).toBe(0);
    expect(r.day.xpEarned).toBe(50);
  });

  test('gain is clamped at the daily cap', () => {
    const start = { ...day(), xpEarned: DAILY_XP_CAP - 10 };
    const r = applyXpWithBank(start, 0, 100);
    expect(r.freshXp).toBe(10);
    expect(r.overflow).toBe(90);
    expect(r.day.xpEarned).toBe(DAILY_XP_CAP);
  });

  test('overflow goes to the bank, capped at XP_BANK_MAX', () => {
    const start = { ...day(), xpEarned: DAILY_XP_CAP, bankReleased: XP_BANK_DAILY_RELEASE };
    const r = applyXpWithBank(start, XP_BANK_MAX, 100);
    expect(r.overflow).toBe(100);
    expect(r.bank).toBe(XP_BANK_MAX);
  });

  test('bank releases up to the daily release limit', () => {
    const r = applyXpWithBank(day(), 1000, 0);
    expect(r.releaseXp).toBe(XP_BANK_DAILY_RELEASE);
    expect(r.totalXpGain).toBe(XP_BANK_DAILY_RELEASE);
    expect(r.day.bankReleased).toBe(XP_BANK_DAILY_RELEASE);
    expect(r.bank).toBe(1000 - XP_BANK_DAILY_RELEASE);
  });

  test('bank release stops at the daily release limit', () => {
    const start = { ...day(), bankReleased: XP_BANK_DAILY_RELEASE - 5 };
    const r = applyXpWithBank(start, 1000, 0);
    expect(r.releaseXp).toBe(5);
  });

  test('release and fresh gain are independent', () => {
    const r = applyXpWithBank(day(), 500, 100);
    expect(r.freshXp).toBe(100);
    expect(r.releaseXp).toBe(500);
    expect(r.totalXpGain).toBe(600);
    expect(r.day.xpEarned).toBe(100);
    expect(r.day.bankReleased).toBe(500);
  });

  test('never returns negative bank', () => {
    const r = applyXpWithBank(day(), -100, 0);
    expect(r.bank).toBeGreaterThanOrEqual(0);
  });
});

describe('streakBonusFor', () => {
  test('pays only on exact milestone days', () => {
    expect(streakBonusFor(3)).toEqual({ days: 3, xp: 10, gold: 5 });
    expect(streakBonusFor(7)).toEqual({ days: 7, xp: 25, gold: 10 });
    expect(streakBonusFor(4)).toBeNull();
    expect(streakBonusFor(0)).toBeNull();
  });

  test('every milestone is unique', () => {
    const seen = new Set();
    [3, 7, 14, 30, 60].forEach((d) => {
      const b = streakBonusFor(d);
      expect(b).not.toBeNull();
      expect(seen.has(b.days)).toBe(false);
      seen.add(b.days);
    });
  });
});

describe('dayPenalty', () => {
  const h = (id, dates) => ({ id, completedDates: dates });

  test('no penalty when everything is done', () => {
    const yesterday = todayKey(-1);
    expect(dayPenalty([h('a', [yesterday])], yesterday)).toEqual({
      count: 0,
      ids: [],
      deducted: 0,
    });
  });

  test('penalises each missed habit once', () => {
    const yesterday = todayKey(-1);
    const r = dayPenalty([h('a', [yesterday]), h('b', []), h('c', [])], yesterday, 15);
    expect(r.count).toBe(2);
    expect(r.ids).toEqual(['b', 'c']);
    expect(r.deducted).toBe(30);
  });

  test('does not penalise habits created after that day is irrelevant — only completion counts', () => {
    const yesterday = todayKey(-1);
    expect(dayPenalty([], yesterday).count).toBe(0);
  });
});

describe('completion aggregates', () => {
  const habits = [
    { id: 'a', completedDates: [key(0), key(-1)] },
    { id: 'b', completedDates: [key(0)] },
    { id: 'c', completedDates: [] },
  ];

  test('completionForDay', () => {
    expect(completionForDay(habits, key(0))).toBe(2);
    expect(completionForDay(habits, key(-1))).toBe(1);
    expect(completionForDay(habits, key(-9))).toBe(0);
  });

  test('totalCompletions', () => {
    expect(totalCompletions(habits)).toBe(3);
  });

  test('bestStreak uses the strongest habit', () => {
    expect(bestStreak(habits, key(0))).toBe(2);
  });

  test('topHabits sorts by completion count and skips zero', () => {
    expect(bestStreak([], key(0))).toBe(0);
  });
});

describe('buildDailyCompletions / weeklyComparison', () => {
  const habits = [{ id: 'a', completedDates: [key(0), key(-1), key(-8)] }];

  test('builds dayCount entries ending today', () => {
    const out = buildDailyCompletions(habits, 7, key(0));
    expect(out).toHaveLength(7);
    expect(out[out.length - 1].key).toBe(key(0));
    expect(out[out.length - 1].done).toBe(1);
    expect(out[out.length - 1].pct).toBe(1);
  });

  test('pct is 0 when there are no habits (no NaN)', () => {
    const out = buildDailyCompletions([], 3, key(0));
    expect(out.every((d) => d.pct === 0)).toBe(true);
  });

  test('weeklyComparison detects up/down/same', () => {
    expect(weeklyComparison(habits, key(0)).trend).toBe('up');
    expect(weeklyComparison([], key(0)).trend).toBe('same');
    const lastWeekOnly = [{ id: 'x', completedDates: [key(-8)] }];
    expect(weeklyComparison(lastWeekOnly, key(0)).trend).toBe('down');
  });
});

describe('makeRecoveryKey', () => {
  test('format XXXX-XXXX', () => {
    expect(makeRecoveryKey()).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  test('never contains confusable characters', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(makeRecoveryKey()).not.toMatch(/[OI01]/);
    }
  });

  test('keys vary across calls', () => {
    const set = new Set(Array.from({ length: 50 }, () => makeRecoveryKey()));
    expect(set.size).toBeGreaterThan(45);
  });
});

describe('formatDuration', () => {
  test('formats minutes and seconds', () => {
    expect(formatDuration(1500000)).toBe('25:00');
    expect(formatDuration(1499000)).toBe('24:59');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(61000)).toBe('1:01');
  });

  test('never negative', () => {
    expect(formatDuration(-500)).toBe('0:00');
  });
});

describe('anti-farm constants', () => {
  test('caps and limits are sane', () => {
    expect(DAILY_XP_CAP).toBeGreaterThan(0);
    expect(DAILY_GOLD_CAP).toBeGreaterThan(0);
    expect(MAX_ACTIVE_HABITS).toBeGreaterThan(0);
    expect(XP_BANK_MAX).toBeGreaterThanOrEqual(XP_BANK_DAILY_RELEASE);
  });
});
