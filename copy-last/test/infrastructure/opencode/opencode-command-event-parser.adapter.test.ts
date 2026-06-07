import { describe, expect, it, vi } from "vitest";
import type { OpenCodeCommandEventMapperContract } from "../../../src/infrastructure/opencode/opencode-command-event.mapper.js";
import { OpenCodeCommandEventParser } from "../../../src/infrastructure/opencode/opencode-command-event-parser.adapter.js";

describe("OpenCodeCommandEventParser", () => {
  it("maps command events", () => {
    const input = { command: "copy-last", sessionID: "session-1" };
    const commandEvent = {
      sessionID: "session-1",
      arguments: "user 2",
      messageID: "cmd",
    };
    const mapper: OpenCodeCommandEventMapperContract = {
      toCopyLastCommandEvent: vi.fn(() => commandEvent),
    };

    expect(new OpenCodeCommandEventParser(mapper).parse(input)).toEqual(commandEvent);
    expect(mapper.toCopyLastCommandEvent).toHaveBeenCalledWith(input);
  });
});
