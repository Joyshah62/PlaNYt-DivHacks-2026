/**
 * npm run db:check — can the app reach its MongoDB (Atlas or local), and what's in it?
 * Prints the cluster and database it reached, never the credentials.
 */
import { databaseName, db, mongoClient } from "@/lib/db";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/roam-nyc";
const where = uri.replace(/\/\/[^@/]*@/, "//***@").replace(/\?.*$/, "");

try {
  await db.command({ ping: 1 });
  console.log(`Connected to ${where} (database "${databaseName(uri)}").`);
  const collections = (await db.listCollections().toArray()).map((c) => c.name).sort();
  if (!collections.length) console.log("No collections yet: Better Auth creates user, session and account on the first sign-up.");
  for (const name of collections) console.log(`  ${name}: ${await db.collection(name).estimatedDocumentCount()} documents`);
} catch (error) {
  console.error(`Couldn't reach ${where}: ${error instanceof Error ? error.message : error}`);
  if (uri.startsWith("mongodb+srv://")) {
    console.error("On Atlas, check: this machine's IP is allowed under Network Access, the database user and password are right (URL-encode special characters), and the cluster isn't paused.");
  }
  process.exitCode = 1;
} finally {
  await mongoClient.close();
}
