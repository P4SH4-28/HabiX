// HabitTracker test konfigürasyonu.
// Amaç: saf iş mantığını (logic.js, servisler, sync motoru) Node ortamında
// hızlıca test etmek. React Native bileşen testleri için ayrı bir preset
// gerekirse `tests/unit` altındaki yapı bozulmadan genişletilebilir.
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/src/**/__tests__/**/*.test.js',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // Deno çalışan edge fonksiyonları ve yerel test sunucusu test kapsamı dışı.
  testPathIgnorePatterns: ['/node_modules/', '/server/', '/supabase/', '/dist/'],
  clearMocks: true,
  collectCoverageFrom: [
    'src/logic.js',
    'src/services/syncService.ts',
    'src/services/profileService.js',
    'src/services/serverClock.js',
  ],
};
