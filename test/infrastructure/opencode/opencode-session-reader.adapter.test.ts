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

  it("sorts dated messages chronologically without moving undated messages", async () => {
    const entries = ["late", "undated", "equal-first", "early", "equal-second"];
    const mappedMessages = new Map([
      ["late", SessionMessage.agent("late", { createdAt: "2026-06-07T10:03:00.000Z" })],
      ["undated", SessionMessage.agent("undated")],
      ["equal-first", SessionMessage.user("equal first", { createdAt: "2026-06-07T10:02:00.000Z" })],
      ["early", SessionMessage.user("early", { createdAt: "2026-06-07T10:01:00.000Z" })],
      ["equal-second", SessionMessage.agent("equal second", { createdAt: "2026-06-07T10:02:00.000Z" })],
    ]);
    const client: SessionMessagesClient = {
      session: { messages: vi.fn(async () => entries) },
    };
    const mapper: OpenCodeSessionMessageMapperContract = {
      toSessionMessages: vi.fn((entry) => [mappedMessages.get(entry as string)!]),
    };

    const messages = await new OpenCodeSessionReader(client, mapper).read("session-1");

    expect(messages.map((message) => message.content)).toEqual([
      "early",
      "undated",
      "equal first",
      "equal second",
      "late",
    ]);
  });
});
