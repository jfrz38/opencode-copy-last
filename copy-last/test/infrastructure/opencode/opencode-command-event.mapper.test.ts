import { describe, expect, it } from "vitest";
import { OpenCodeCommandEventMapper } from "../../../src/infrastructure/opencode/opencode-command-event.mapper.js";
import { OpenCodeValueReader } from "../../../src/infrastructure/opencode/opencode-value-reader.js";

const mapper = new OpenCodeCommandEventMapper(new OpenCodeValueReader());

describe("OpenCodeCommandEventMapper", () => {
  it("parses command.execute.before events", () => {
    expect(mapper.toCopyLastCommandEvent({
      command: "copy-last",
      sessionID: "session-1",
      arguments: "user 2",
      messageID: "cmd",
    })).toEqual({
      sessionID: "session-1",
      arguments: "user 2",
      messageID: expect.objectContaining({ value: "cmd" }),
    });
  });

  it("parses events with empty arguments", () => {
    expect(mapper.toCopyLastCommandEvent({
      command: "copy-last",
      sessionID: "session-1",
      arguments: "",
    })).toEqual({
      sessionID: "session-1",
      arguments: "",
      messageID: undefined,
    });
  });

  it("ignores unsupported events", () => {
    expect(mapper.toCopyLastCommandEvent(undefined)).toBeUndefined();
    expect(mapper.toCopyLastCommandEvent({ command: "other", sessionID: "session-1" })).toBeUndefined();
    expect(mapper.toCopyLastCommandEvent({ command: "copy-last" })).toBeUndefined();
    expect(mapper.toCopyLastCommandEvent({ command: "copy-last", sessionID: "session-1" })).toEqual({
      sessionID: "session-1",
      arguments: "",
      messageID: undefined,
    });
  });
});
