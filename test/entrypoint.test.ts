import { describe, expect, it, vi } from "vitest";

vi.mock("@opencode/plugin", () => {
  throw new Error("The shared entrypoint loaded the OpenCode 2 runtime eagerly");
});
vi.mock("@opencode/plugin/rpc", () => {
  throw new Error("The shared entrypoint loaded the OpenCode 2 RPC runtime eagerly");
});

const { default: plugin } = await import("../src/index.js");

describe("shared package entrypoint", () => {
  it("exposes both plugin APIs without loading the OpenCode 2 runtime", () => {
    expect(plugin.id).toBe("copy-last");
    expect(plugin.setup).toBeTypeOf("function");
    expect(plugin.server).toBeTypeOf("function");
  });
});
