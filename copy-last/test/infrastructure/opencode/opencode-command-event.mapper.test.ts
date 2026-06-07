import { describe, expect, it } from "vitest";
import { OpenCodeCommandEventMapper } from "../../../src/infrastructure/opencode/opencode-command-event.mapper.js";
import { OpenCodeValueReader } from "../../../src/infrastructure/opencode/opencode-value-reader.js";

const mapper = new OpenCodeCommandEventMapper(new OpenCodeValueReader());

describe("OpenCodeCommandEventMapper", () => {
  it("parses command.executed events", () => {
    expect(mapper.toCopyLastCommandEvent({
      type: "command.executed",
      properties: {
        name: "copy-last",
        sessionID: "session-1",
        arguments: "user 2",
        messageID: "cmd",
      },
    })).toEqual({
      sessionID: "session-1",
      arguments: "user 2",
      messageID: "cmd",
    });
  });

  it("parses command.executed events with array arguments", () => {
    expect(mapper.toCopyLastCommandEvent({
      event: {
        name: "command.executed",
        properties: {
          command: "copy-last",
          sessionId: "session-1",
          arguments: ["user", "2"],
          messageId: "cmd",
        },
      },
    })).toEqual({
      sessionID: "session-1",
      arguments: ["user", "2"],
      messageID: "cmd",
    });
  });
  it("parses marker fallback events", () => {
    expect(mapper.toCopyLastCommandEvent({
      sessionID: "session-1",
      prompt: "OPENCODE_COPY_LAST_COMMAND pair 2",
      messageID: "cmd",
    })).toEqual({
      sessionID: "session-1",
      arguments: "pair 2",
      messageID: "cmd",
    });
  });

  it("ignores unsupported events", () => {
    expect(mapper.toCopyLastCommandEvent(undefined)).toBeUndefined();
    expect(mapper.toCopyLastCommandEvent({ type: "command.executed", properties: { name: "other", sessionID: "session-1" } })).toBeUndefined();
    expect(mapper.toCopyLastCommandEvent({ type: "command.executed", properties: { name: "copy-last" } })).toBeUndefined();
    expect(mapper.toCopyLastCommandEvent({ prompt: "other", sessionID: "session-1" })).toBeUndefined();
  });
});
