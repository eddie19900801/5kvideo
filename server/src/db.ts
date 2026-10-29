import path from "node:path";
import type { Database } from "./types.js";
import { JsonDatabaseRepository } from "./repositories/jsonDatabase.js";
import { JsonInteractionRepository, JsonVideoRepository } from "./repositories/jsonVideo.js";
import { JsonUserRepository } from "./repositories/jsonUser.js";
import { JsonMediaJobRepository } from "./repositories/jsonMediaJob.js";
import { PostgresDatabaseRepository } from "./repositories/postgresDatabase.js";

export const databaseRepository = process.env.DATABASE_URL?.trim()
  ? new PostgresDatabaseRepository()
  : new JsonDatabaseRepository(path.resolve(process.env.DATA_FILE || "./data/db.json"));
export const videoRepository = new JsonVideoRepository(databaseRepository);
export const interactionRepository = new JsonInteractionRepository(databaseRepository);
export const userRepository = new JsonUserRepository(databaseRepository);
export const mediaJobRepository = new JsonMediaJobRepository(databaseRepository);

export async function initializeDatabase() {
  if (databaseRepository instanceof PostgresDatabaseRepository) await databaseRepository.initialize();
}

export async function flushDatabase() {
  if (databaseRepository instanceof PostgresDatabaseRepository) await databaseRepository.flush();
}

// Compatibility facade while route modules migrate to DatabaseRepository.
export function readDb(): Database {
  return databaseRepository.read();
}

export function updateDb(operation: (database: Database) => void): Database {
  return databaseRepository.transaction((database) => {
    operation(database);
    return database;
  });
}

export function updateDbDeferred(operation: (database: Database) => void): Database {
  return databaseRepository.transactionDeferred((database) => {
    operation(database);
    return database;
  });
}
