# HabitTracker Test Strategy

## Overview
This document outlines the testing strategy for the HabitTracker application, covering unit tests, integration tests, and end-to-end tests.

## Testing Goals
1. Verify business logic correctness
2. Ensure anti-farm/security mechanisms work
3. Test data synchronization reliability
4. Validate UI components and navigation
5. Confirm offline-first behavior
6. Check accessibility compliance

## Current Status (2026-09-27)

| Alan | Durum |
|---|---|
| Test altyapÄ±sÄ± | âœ… `jest.config.js` (node ortamÄ±, `babel-preset-expo`), `npm test` / `npm run test:watch` |
| Saf mantÄ±k | âœ… `tests/unit/logic.test.js` â€” 49 test |
| Senkron motoru | âœ… `tests/unit/syncQueue.test.js` â€” 16 test (kuyruk race, LWW birleÅŸim, drain, LWW Ã§atÄ±ÅŸmasÄ±) |
| Tip denetimi | âœ… `npm run typecheck` (`tsc --noEmit`, uygulama kodu) |
| CI | âœ… GitHub Actions: `npm ci` â†’ `jest --ci` â†’ `tsc --noEmit` â†’ APK derlemesi |
| Component/Context/E2E | â¬œ PlanlandÄ±ÄŸÄ± gibi deÄŸil (React Testing Library/Detox kurulmadÄ±) |
| Edge Functions | â¬œ Manuel; bkz.  `docs/guvenlik-ve-dagitim.md` doÄŸrulama listesi |

## Test Types

### 1. Unit Tests (Logic & Pure Functions)
**Location**: `src/__tests__/` or alongside source files
**Tools**: Jest or Vitest
**Scope**:
- `logic.js` functions: dateKey, todayKey, hashPassword, calcStreak, levelFromTotalXp, applyXpWithBank, streakBonusFor, etc.
- Pure helpers from data files: quest calculations, achievement conditions, league logic
- Utility functions: makeRecoveryKey, sanitizeName

### 2. Context & Hook Tests
**Location**: `src/context/__tests__/`
**Tools**: React Testing Library + Jest
**Scope**:
- AuthContext: registration, login, logout, password recovery
- DataContext: state mutations, streak calculations, achievement unlocking
- MenuContext: sidebar visibility

### 3. Service Tests
**Location**: `src/services/__tests__/`
**Tools**: Jest with mocked Supabase/fetch
**Scope**:
- profileService: server communication, delta updates
- friendService: friendship operations
- duelService: duel lifecycle
- syncService: mutation queue, delta sync, conflict resolution
- notifications: scheduling logic
- widgetService: snapshot generation

### 4. Component Tests
**Location**: `src/components/__tests__/` or alongside components
**Tools**: React Testing Library
**Scope**:
- Habit creation/editing
- Pomodoro timer
- Quest completion
- Shop/inventory interactions
- Achievement/Season Pass displays

### 5. Integration Tests
**Location**: `e2e/` or `tests/integration/`
**Tools**: Detox (for mobile) or Playwright (for web)
**Scope**:
- Full user flows: signup â†’ habit tracking â†’ quest completion â†’ rewards
- Offline â†’ online synchronization
- Multi-device conflict resolution
- Social features: friend requests, duels
- Admin panel functionality

### 6. Security/Anti-Farm Tests
**Location**: `tests/security/`
**Scope**:
- Time manipulation attempts
- Daily cap enforcement
- XP bank limits
- Streak freeze/penalty shield mechanics
- Server vs client time validation
- Edge Function input validation

## Test Implementation Plan

### Phase 1: Setup Testing Infrastructure
- [x] Add Jest/Vitest as devDependency
- [x] Configure Babel/Jest for React Native
- [x] Set up mock Supabase client (`jest.mock('src/config/supabase')` + AsyncStorage mock)
- [ ] Create test utilities and fixtures

### Phase 2: Implement Core Unit Tests
- [x] Test all pure functions in `logic.js`
- [ ] Test data calculation helpers
- [ ] Test utility functions (makeRecoveryKey, etc.)

### Phase 3: Context & Service Tests
- [x] Service layer: sync queue (mutation queue, drain, LWW merge) with mocking
- [ ] AuthContext authentication flows
- [ ] DataContext state mutations and persistence

### Phase 4: Component Tests
- [ ] Critical UI components (habit list, pomodoro, quests)
- [ ] Form validation and error handling
- [ ] Accessibility checks (color contrast, touch targets)

### Phase 5: Integration & E2E Tests
- [ ] User journey tests
- [ ] Offline/online sync scenarios
- [ ] Multi-user social interactions

## Anti-Farm Test Cases
1. **Time Travel Protection**: Attempt to set device clock forward/backward
2. **Daily Cap Enforcement**: Try to exceed 500 XP/150 gold in one day
3. **Streak Mechanics**: Validate streak breaks/freeze/shield work correctly
4. **Server Validation**: Confirm client-side only changes get rejected by server
5. **Mutation Queue**: Test retry logic and conflict resolution

## Continuous Integration
- [x] Add test scripts to package.json (`test`, `test:watch`, `typecheck`)
- [x] Configure GitHub Actions to run tests on main (`npx jest --ci` + `npx tsc --noEmit`, APK derlemesinden Ã¶nce)
- [ ] Generate coverage reports
- [x] Fail builds on test failures (test/typecheck adÄ±mÄ± derlemeyi durdurur)

## Coverage Goals
- Statements: 80%+
- Branches: 75%+
- Functions: 80%+
- Lines: 80%+

## Exclusions
- Edge Functions (supabase/functions/) - tested via integration tests
- Native modules - tested manually/QA
- Platform-specific code - tested on respective devices/emulators