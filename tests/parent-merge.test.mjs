// The mechanical half of a merge from the parent repository (tools/parent-merge.mjs).
import { describe, expect, test } from "bun:test";

import { nextVersion, resolveChanges } from "../tools/parent-merge.mjs";

describe("nextVersion", () => {
  test("a new parent release restarts N at 1", () => {
    expect(nextVersion("0.9.84-projects.3\n", "0.9.90", false)).toBe("0.9.90-projects.1");
  });
  test("a plugin change under the same parent release moves N on", () => {
    expect(nextVersion("0.9.90-projects.1", "0.9.90", true)).toBe("0.9.90-projects.2");
  });
  test("a merge that ships nothing keeps VERSION", () => {
    expect(nextVersion("0.9.90-projects.1", "0.9.90", false)).toBe("0.9.90-projects.1");
  });
});

describe("resolveChanges", () => {
  test("the parent's entries go above the fork's in a conflict hunk", () => {
    const text = [
      "# CHANGES",
      "",
      "<<<<<<< HEAD",
      "## 0.9.84-projects.1 - fork",
      "",
      "f",
      "",
      "=======",
      "## 0.9.85 - parent",
      "",
      "p",
      "",
      ">>>>>>> parent/main",
      "## 0.9.84 - base",
      "",
    ].join("\n");
    expect(resolveChanges(text)).toBe("# CHANGES\n\n## 0.9.85 - parent\n\np\n\n## 0.9.84-projects.1 - fork\n\nf\n\n## 0.9.84 - base\n");
  });
});
