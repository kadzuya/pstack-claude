// A change to the shipped plugin must ship under a new version, or installed
// copies keep the cached one (tools/fork-version.mjs).
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { pluginHash, readRecord, RECORD } from "../tools/fork-version.mjs";

const version = readFileSync(new URL("../VERSION", import.meta.url), "utf8").trim();

describe("fork version", () => {
  test("VERSION carries the fork's -projects.N suffix", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+-projects\.\d+$/);
  });

  test(`${RECORD} records the current VERSION`, () => {
    expect(readRecord().version, "bump VERSION, then run bun tools/fork-version.mjs").toBe(version);
  });

  test("plugins/pstack matches the hash recorded for VERSION", () => {
    expect(
      pluginHash(),
      `plugins/pstack changed since ${readRecord().version} was recorded. Bump VERSION to the next -projects.N, add its CHANGES.md entry, run bun tools/generate.mjs, then bun tools/fork-version.mjs.`,
    ).toBe(readRecord().sha256);
  });
});
