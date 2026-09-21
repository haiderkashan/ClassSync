import {
  initLocalDatabase,
  resetLocalDatabase,
  getSyncCursor,
  setSyncCursor,
} from './localDatabase';

describe('localDatabase Schema & Cursors', () => {
  it('should safely initialize database tables and PRAGMAs without error', () => {
    expect(() => initLocalDatabase()).not.toThrow();
  });

  it('should safely reset local database tables without error', () => {
    expect(() => resetLocalDatabase()).not.toThrow();
  });

  it('should safely handle getSyncCursor and setSyncCursor calls', () => {
    // In Jest environment where SQLite native is bypassed, these should return null / no-op safely
    expect(getSyncCursor('schedule_overrides')).toBeNull();
    expect(() =>
      setSyncCursor('schedule_overrides', '2026-09-21T12:00:00.000Z')
    ).not.toThrow();
  });
});
