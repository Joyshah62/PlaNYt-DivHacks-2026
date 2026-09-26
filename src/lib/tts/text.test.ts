import { describe, expect, it } from "vitest";
import { normalizeSpeech } from "./useTextToSpeech";

describe("normalizeSpeech", () => {
  it("removes markdown-only syntax and URLs while preserving response wording", () => {
    expect(normalizeSpeech("**Try this:** [the Met](https://example.com)\n- `Open early`\n```js\nignored()\n```"))
      .toBe("Try this: the Met Open early");
  });
});
