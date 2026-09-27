import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { MongoClient } from "mongodb";
import { nextCookies } from "better-auth/next-js";

const mongoUrl =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/roam-nyc";
const mongoClient = new MongoClient(mongoUrl);
const mongoDb = mongoClient.db();

export const auth = betterAuth({
  database: mongodbAdapter(mongoDb, {
    usePlural: false,
    transaction: false,
  }),
  secret: process.env.BETTER_AUTH_SECRET || "dev-secret-change-me",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  plugins: [nextCookies()],
});
