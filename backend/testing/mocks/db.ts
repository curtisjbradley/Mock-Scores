// Manual mock for db module - prevents real DB connections during tests
const mockQuery = jest.fn();

const db = {
  query: mockQuery,
  connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
};

export default db;

export const dbQuery = jest.fn();
