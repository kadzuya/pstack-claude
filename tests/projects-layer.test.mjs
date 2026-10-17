// A Projects-layer change must ship under a new version, or installed copies
// keep the cached one (tools/projects-layer.mjs).
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { projectsLayerHash, readRecord, RECORD } from "../tools/projects-layer.mjs";

const version = readFileSync(new URL("../VERSION", import.meta.url), "utf8").trim();

describe("Projects layer version", () => {
  test("VERSION carries the fork's -projects.N suffix", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+-projects\.\d+$/);
  });

  test(`${RECORD} records the current VERSION`, () => {
    expect(readRecord().version, "bump VERSION, then run bun tools/projects-layer.mjs").toBe(version);
  });

  test("the Projects-layer files match the hash recorded for VERSION", () => {
    expect(
      projectsLayerHash(),
      `The Projects layer changed since ${readRecord().version} was recorded. Bump VERSION to the next -projects.N, add its CHANGES.md entry, run bun tools/generate.mjs, then bun tools/projects-layer.mjs.`,
    ).toBe(readRecord().sha256);
  });
});
