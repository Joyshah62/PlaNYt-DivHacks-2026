import { describe, expect, it } from "vitest";
import { chooseEngine, isLite, parseEngine, visibleTimeout, type EngineEnv } from "./cityMap";

/** A stand-in for `document` whose visibility the test controls. */
function fakeDoc(hidden: boolean) {
  const doc = Object.assign(new EventTarget(), { visibilityState: (hidden ? "hidden" : "visible") as DocumentVisibilityState });
  const show = () => {
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
  };
  return { doc, show };
}

describe("visibleTimeout", () => {
  it("fires after `ms` when the page is visible", async () => {
    let fired = false;
    visibleTimeout(fakeDoc(false).doc, 10, () => (fired = true));
    await new Promise((r) => setTimeout(r, 30));
    expect(fired).toBe(true);
  });
  it("doesn't start counting while the page is hidden", async () => {
    let fired = false;
    const { doc, show } = fakeDoc(true);
    visibleTimeout(doc, 10, () => (fired = true));
    await new Promise((r) => setTimeout(r, 30));
    expect(fired).toBe(false);
    show();
    await new Promise((r) => setTimeout(r, 30));
    expect(fired).toBe(true);
  });
  it("can be cancelled before it fires", async () => {
    let fired = false;
    const cancel = visibleTimeout(fakeDoc(false).doc, 10, () => (fired = true));
    cancel();
    await new Promise((r) => setTimeout(r, 30));
    expect(fired).toBe(false);
  });
});

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
  it("uses MapLibre everywhere when NEXT_PUBLIC_MAP_ENGINE=maplibre (local development)", () => {
    const dev = { ...good, forced: "maplibre" as const };
    expect(chooseEngine(dev, "hero")).toBe("maplibre");
    expect(chooseEngine(dev, "secondary")).toBe("maplibre");
  });
  it("uses Google everywhere when NEXT_PUBLIC_MAP_ENGINE=google, even for lite devices", () => {
    const demo = { ...good, saveData: true, forced: "google" as const };
    expect(chooseEngine(demo, "hero")).toBe("google");
    expect(chooseEngine(demo, "secondary")).toBe("google");
  });
  it("can't use Google without a key, even when asked to", () => {
    expect(chooseEngine({ ...good, hasKey: false, forced: "google" }, "hero")).toBe("maplibre");
  });
  it("still renders nothing without WebGL, even when forced", () => {
    expect(chooseEngine({ ...good, webgl: false, forced: "maplibre" }, "hero")).toBe("none");
  });
  it("keeps Google for the hero but not secondary maps on lite devices", () => {
    const saver = { ...good, saveData: true };
    expect(chooseEngine(saver, "hero")).toBe("google");
    expect(chooseEngine(saver, "secondary")).toBe("maplibre");
    expect(chooseEngine({ ...good, deviceMemory: 2 }, "secondary")).toBe("maplibre");
  });
});

describe("parseEngine", () => {
  it("reads maplibre / google, ignoring case and spaces", () => {
    expect(parseEngine("maplibre")).toBe("maplibre");
    expect(parseEngine(" Google ")).toBe("google");
  });
  it("treats empty or unknown values as automatic", () => {
    expect(parseEngine(undefined)).toBeUndefined();
    expect(parseEngine("")).toBeUndefined();
    expect(parseEngine("mapbox")).toBeUndefined();
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
