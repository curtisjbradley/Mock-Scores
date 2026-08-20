// Manual mock for db module - prevents real DB connections during tests
const mockQuery = jest.fn();

const db = {
  query: mockQuery,
  connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
};

export default db;

export const dbQuery = jest.fn();

// Transaction control statements bypass the mocked query fn so they don't
// consume queued responses or shift mockDbQuery.mock.calls indexing that tests
// rely on. Any other statement is routed through dbQuery, so tests can queue
// ballot/nomination insert results (and rejections) exactly as before.
const TX_CONTROL = new Set(['BEGIN', 'COMMIT', 'ROLLBACK']);

export const withTransaction = jest.fn(async (work: (client: unknown) => unknown) => {
  const client = {
    query: (sql: string, params?: unknown[]) => {
      if (typeof sql === 'string' && TX_CONTROL.has(sql.trim().toUpperCase())) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return (dbQuery as jest.Mock)(sql, params);
    },
    release: jest.fn(),
  };
  return work(client);
});
