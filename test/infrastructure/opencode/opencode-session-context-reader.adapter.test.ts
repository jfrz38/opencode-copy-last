import { describe, expect, it, vi } from "vitest";
import type { MessageId } from "../../../src/domain/message/message-id.value-object.js";
import type { SessionMessage } from "../../../src/domain/message/session-message.js";
import type { OpenCodeSessionMessageMapperContract } from "../../../src/infrastructure/opencode/opencode-session-message.mapper.js";
import { OpenCodeSessionContextReader } from "../../../src/infrastructure/opencode/opencode-session-context-reader.adapter.js";
import type { SessionContextClient } from "../../../src/infrastructure/opencode/opencode-session-context-reader.adapter.js";

describe("OpenCodeSessionContextReader", () => {
  it("reads the session context and maps its entries", async () => {
    const entries = [{ id: "u1" }, { id: "a1" }];
    const firstMessage = { id: "u1" } as SessionMessage;
    const secondMessage = { id: "a1" } as SessionMessage;
    const client: SessionContextClient = {
      session: {
        context: vi.fn(async () => entries),
      },
    };
    const mapper: OpenCodeSessionMessageMapperContract = {
      toSessionMessages: vi.fn((entry) => entry === entries[0] ? [firstMessage] : [secondMessage]),
    };

    const commandMessageID = { equals: vi.fn() } as unknown as MessageId;
    const messages = await new OpenCodeSessionContextReader(client, mapper).read("session-1", commandMessageID);

    expect(client.session.context).toHaveBeenCalledWith({ sessionID: "session-1" });
    expect(mapper.toSessionMessages).toHaveBeenNthCalledWith(1, entries[0], commandMessageID);
    expect(mapper.toSessionMessages).toHaveBeenNthCalledWith(2, entries[1], commandMessageID);
    expect(messages).toEqual([firstMessage, secondMessage]);
  });

  it("returns an empty list when the session context is not an array", async () => {
    const client: SessionContextClient = {
      session: {
        context: vi.fn(async () => undefined),
      },
    };
    const mapper: OpenCodeSessionMessageMapperContract = {
      toSessionMessages: vi.fn(),
    };

    await expect(new OpenCodeSessionContextReader(client, mapper).read("session-1")).resolves.toEqual([]);
    expect(mapper.toSessionMessages).not.toHaveBeenCalled();
  });

  it("keeps the order returned by the session context", async () => {
    const entries = ["u1", "a1", "u2"];
    const mapper: OpenCodeSessionMessageMapperContract = {
      toSessionMessages: vi.fn((entry) => [{ id: entry as string } as SessionMessage]),
    };
    const client: SessionContextClient = {
      session: { context: vi.fn(async () => entries) },
    };

    const messages = await new OpenCodeSessionContextReader(client, mapper).read("session-1");

    expect(messages.map((message) => message.id)).toEqual(["u1", "a1", "u2"]);
  });
});
