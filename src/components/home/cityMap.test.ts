import { describe, expect, it } from "vitest";
import { chooseEngine, isLite, type EngineEnv } from "./cityMap";

const good: EngineEnv = { hasKey: true, webgl: true, saveData: false, deviceMemory: 8 };

describe("chooseEngine", () => {
  it("uses Google 3D when a key and WebGL are available", () => {
    expect(chooseEngine(good, "hero")).toBe("google");
    expect(chooseEngine(good, "secondary")).toBe("google");
  });
  it("falls back to MapLibre without a key", () => {
    expect(chooseEngine({ ...good, hasKey: false }, "hero")).toBe("maplibre");
  });
  it("renders no map at all without WebGL", () => {
    expect(chooseEngine({ ...good, webgl: false }, "hero")).toBe("none");
  });
  it("keeps Google for the hero but not secondary maps on lite devices", () => {
    const saver = { ...good, saveData: true };
    expect(chooseEngine(saver, "hero")).toBe("google");
    expect(chooseEngine(saver, "secondary")).toBe("maplibre");
    expect(chooseEngine({ ...good, deviceMemory: 2 }, "secondary")).toBe("maplibre");
  });
});

describe("isLite", () => {
  it("is true for data saver or ≤2 GB memory, false when memory is unknown", () => {
    expect(isLite({ ...good, saveData: true })).toBe(true);
    expect(isLite({ ...good, deviceMemory: 2 })).toBe(true);
    expect(isLite({ ...good, deviceMemory: undefined })).toBe(false);
    expect(isLite(good)).toBe(false);
  });
});
