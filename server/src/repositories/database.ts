import type { Database } from "../types.js";

export interface DatabaseRepository {
  read(): Database;
  transaction<T>(operation: (database: Database) => T): T;
}
