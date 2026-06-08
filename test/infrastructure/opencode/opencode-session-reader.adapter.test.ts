import { describe, expect, it, vi } from "vitest";
import { MessageId } from "../../../src/domain/message/message-id.value-object.js";
import { SessionMessage } from "../../../src/domain/message/session-message.js";
import type { OpenCodeSessionMessageMapperContract } from "../../../src/infrastructure/opencode/opencode-session-message.mapper.js";
import { OpenCodeSessionReader } from "../../../src/infrastructure/opencode/opencode-session-reader.adapter.js";
import type { SessionMessagesClient } from "../../../src/infrastructure/opencode/opencode-session-reader.adapter.js";

describe("OpenCodeSessionReader", () => {
  it("reads OpenCode message entries and maps them", async () => {
    const entries = [{ id: "u1" }, { id: "a1" }];
    const firstMessage = SessionMessage.user("hello", { id: "u1" });
    const secondMessage = SessionMessage.agent("hi", { id: "a1" });
    const client: SessionMessagesClient = {
      session: {
        messages: vi.fn(async () => entries),
      },
    };
    const mapper: OpenCodeSessionMessageMapperContract = {
      toSessionMessages: vi.fn((entry) => entry === entries[0] ? [firstMessage] : [secondMessage]),
    };

    const commandMessageID = MessageId.fromString("cmd");
    const messages = await new OpenCodeSessionReader(client, mapper).read("session-1", commandMessageID);

    expect(client.session.messages).toHaveBeenCalledWith({ path: { id: "session-1" }, responseStyle: "data" });
    expect(mapper.toSessionMessages).toHaveBeenNthCalledWith(1, entries[0], commandMessageID);
    expect(mapper.toSessionMessages).toHaveBeenNthCalledWith(2, entries[1], commandMessageID);
    expect(messages).toEqual([firstMessage, secondMessage]);
  });

  it("returns an empty list when OpenCode response is not an array", async () => {
    const client: SessionMessagesClient = {
      session: {
        messages: vi.fn(async () => undefined),
      },
    };
    const mapper: OpenCodeSessionMessageMapperContract = {
      toSessionMessages: vi.fn(),
    };

    await expect(new OpenCodeSessionReader(client, mapper).read("session-1")).resolves.toEqual([]);
    expect(mapper.toSessionMessages).not.toHaveBeenCalled();
  });
});
