import { MongoClient, type Db } from "mongodb";

const g = globalThis as typeof globalThis & { __roamMongo?: Promise<MongoClient> };

export function hasMongo(): boolean {
  return !!process.env.MONGODB_URI;
}

/** One pooled client per server process; dev hot reloads and warm serverless calls reuse it. */
export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set.");
  g.__roamMongo ??= new MongoClient(uri, { appName: "roam-nyc", maxPoolSize: 5 }).connect().catch((error: unknown) => {
    g.__roamMongo = undefined;
    throw error;
  });
  return (await g.__roamMongo).db(process.env.MONGODB_DB || "roam");
}
