import { MongoClient, type Db } from "mongodb";

/**
 * The app's MongoDB (Atlas in production). One client per server process:
 * dev hot reloads and serverless warm starts reuse it, rather than opening a
 * new pool each time and running into Atlas's connection limit.
 */

const LOCAL = "mongodb://127.0.0.1:27017/roam-nyc";
const DEFAULT_DB = "roam-nyc";

/**
 * The database to use: MONGODB_DB, else the one named in the connection
 * string, else "roam-nyc". Atlas's "Connect" string names none, and the driver
 * would otherwise quietly use "test".
 */
export function databaseName(uri: string, override = process.env.MONGODB_DB): string {
  if (override) return override;
  const path = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri)?.[1];
  return path ? decodeURIComponent(path) : DEFAULT_DB;
}

const uri = process.env.MONGODB_URI || LOCAL;
const cache = globalThis as typeof globalThis & { roamMongo?: MongoClient };
// Atlas: fail fast when the cluster can't be reached (IP not allowed, paused), not after 30 s.
export const mongoClient = (cache.roamMongo ??= new MongoClient(uri, { appName: "roam-nyc", serverSelectionTimeoutMS: 8_000 }));

export const db: Db = mongoClient.db(databaseName(uri));
