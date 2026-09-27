import type { Db } from "mongodb";
import { db, mongoClient } from "@/lib/db";

/** Group trips are kept in MongoDB when it's configured; otherwise in the dev server's memory. */
export function hasMongo(): boolean {
  return !!process.env.MONGODB_URI;
}

/** The app's one database (see lib/db): accounts, saved trips and group trips side by side. */
export async function getDb(): Promise<Db> {
  if (!hasMongo()) throw new Error("MONGODB_URI is not set.");
  await mongoClient.connect();
  return db;
}
