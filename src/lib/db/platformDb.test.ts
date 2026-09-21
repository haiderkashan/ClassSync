import {
  isWeb,
  getDatabase,
  execSql,
  runSql,
  queryAll,
  queryFirst,
  transaction,
  generateClientUuid,
} from './platformDb';

describe('platformDb Platform-Safe Abstraction', () => {
  it('should generate valid RFC4122 v4 UUIDs offline', () => {
    const uuid1 = generateClientUuid();
    const uuid2 = generateClientUuid();

    expect(typeof uuid1).toBe('string');
    expect(typeof uuid2).toBe('string');
    expect(uuid1).not.toBe(uuid2);

    // Standard UUID v4 regex: 8-4-4-4-12 hex characters
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid1).toMatch(uuidRegex);
    expect(uuid2).toMatch(uuidRegex);
  });

  it('should safely execute transactions and return results even when database is null', () => {
    const result = transaction(() => {
      return { status: 'success', count: 42 };
    });

    expect(result).toEqual({ status: 'success', count: 42 });
  });

  it('should safely execute no-op queries when database handle is null or web', () => {
    // These calls must never throw errors
    expect(() => execSql('CREATE TABLE dummy (id TEXT);')).not.toThrow();
    expect(runSql('INSERT INTO dummy VALUES (?)', '1')).toEqual({
      changes: 0,
      lastInsertRowId: 0,
    });
    expect(queryAll('SELECT * FROM dummy')).toEqual([]);
    expect(queryFirst('SELECT * FROM dummy')).toBeNull();
  });
});
