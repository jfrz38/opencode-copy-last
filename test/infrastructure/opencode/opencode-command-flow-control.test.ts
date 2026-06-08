import { describe, expect, it } from "vitest";
import { HandledCopyLastCommand, isHandledCopyLastCommand, abortHandledCopyLastCommand } from "../../../src/infrastructure/opencode/opencode-command-flow-control.js";

const SENTINEL_ERROR = "OPENCODE_COPY_LAST_HANDLED";

describe("abortHandledCopyLastCommand", () => {
  it("throws HandledCopyLastCommand", () => {
    expect(() => abortHandledCopyLastCommand()).toThrow(HandledCopyLastCommand);
    expect(() => abortHandledCopyLastCommand()).toThrow(SENTINEL_ERROR);
  });
});

describe("HandledCopyLastCommand", () => {
  it("sets name and message", () => {
    const error = new HandledCopyLastCommand();

    expect(error.name).toBe("HandledCopyLastCommand");
    expect(error.message).toBe(SENTINEL_ERROR);
  });
});

describe("isHandledCopyLastCommand", () => {
  it("identifies HandledCopyLastCommand instances", () => {
    expect(isHandledCopyLastCommand(new HandledCopyLastCommand())).toBe(true);
  });

  it("rejects other errors", () => {
    expect(isHandledCopyLastCommand(new Error())).toBe(false);
    expect(isHandledCopyLastCommand("string")).toBe(false);
    expect(isHandledCopyLastCommand(null)).toBe(false);
  });
});
