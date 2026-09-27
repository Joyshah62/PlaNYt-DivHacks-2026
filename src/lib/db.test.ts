import { describe, expect, it, vi } from "vitest";

vi.mock("mongodb", () => ({ MongoClient: class { db() { return {}; } } }));
const { databaseName } = await import("./db");

describe("which database the app uses", () => {
  it("uses the one in the connection string", () => {
    expect(databaseName("mongodb+srv://u:p@cluster0.abc.mongodb.net/roam-nyc?retryWrites=true", "")).toBe("roam-nyc");
    expect(databaseName("mongodb://127.0.0.1:27017/dev-db", "")).toBe("dev-db");
  });
  it("defaults to roam-nyc, not the driver's \"test\", when Atlas's string names none", () => {
    expect(databaseName("mongodb+srv://u:p@cluster0.abc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", "")).toBe("roam-nyc");
    expect(databaseName("mongodb+srv://u:p@cluster0.abc.mongodb.net", "")).toBe("roam-nyc");
  });
  it("lets MONGODB_DB choose", () => {
    expect(databaseName("mongodb+srv://u:p@cluster0.abc.mongodb.net/roam-nyc", "roam-staging")).toBe("roam-staging");
  });
});
