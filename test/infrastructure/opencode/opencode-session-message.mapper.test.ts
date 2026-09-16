import { describe, expect, it } from "vitest";
import { MessageId } from "../../../src/domain/message/message-id.value-object.js";
import { OpenCodeSessionMessageMapper } from "../../../src/infrastructure/opencode/opencode-session-message.mapper.js";
import { OpenCodeValueReader } from "../../../src/infrastructure/opencode/opencode-value-reader.js";

const mapper = new OpenCodeSessionMessageMapper(new OpenCodeValueReader());

describe("OpenCodeSessionMessageMapper", () => {
  it("normalizes OpenCode message entries", () => {
    const createdAt = Date.UTC(2026, 5, 7, 10, 0);
    const userMessages = mapper.toSessionMessages({
      info: { id: "u1", role: "user", time: { created: createdAt } },
      parts: [{ type: "text", text: "hello" }, { type: "file", text: "ignored" }],
    });
    const agentMessages = mapper.toSessionMessages({
      info: { id: "a1", role: "assistant", createdAt: "2026-06-07T10:01:00.000Z" },
      parts: [{ type: "text", text: "hi" }],
    });

    expect(userMessages).toHaveLength(1);
    expect(userMessages[0].id).toBe("u1");
    expect(userMessages[0].role).toBe("user");
    expect(userMessages[0].content).toBe("hello");
    expect(userMessages[0].createdAt).toBe(new Date(createdAt).toISOString());
    expect(agentMessages).toHaveLength(1);
    expect(agentMessages[0].id).toBe("a1");
    expect(agentMessages[0].role).toBe("agent");
    expect(agentMessages[0].content).toBe("hi");
    expect(agentMessages[0].createdAt).toBe("2026-06-07T10:01:00.000Z");
  });

  it("excludes the command message", () => {
    expect(mapper.toSessionMessages({ info: { id: "cmd", role: "user" }, parts: ["/copy-last user"] }, MessageId.fromString("cmd"))).toEqual([]);
  });

  it("returns an empty list for unsupported entries", () => {
    expect(mapper.toSessionMessages(undefined)).toEqual([]);
    expect(mapper.toSessionMessages({ info: { id: "tool", role: "tool" }, parts: [{ type: "text", text: "skip" }] })).toEqual([]);
    expect(mapper.toSessionMessages({ info: { id: "empty", role: "assistant" }, parts: [] })).toEqual([]);
  });

  it("reads direct and info content fallbacks", () => {
    expect(mapper.toSessionMessages({ id: "direct", role: "user", text: "direct text" })[0].content).toBe("direct text");
    expect(mapper.toSessionMessages({ info: { id: "info", role: "assistant", content: "info text" } })[0].content).toBe("info text");
  });

  it("keeps visible Unicode text and excludes non-output parts", () => {
    const messages = mapper.toSessionMessages({
      info: { id: "a1", role: "assistant" },
      parts: [
        { type: "reasoning", text: "private reasoning" },
        { type: "tool", text: "tool output" },
        { type: "text", text: "generated summary", synthetic: true },
        { type: "text", text: "discarded draft", ignored: true },
        { type: "text", text: "Última respuesta: pingüino 🐧 — 日本語" },
      ],
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Última respuesta: pingüino 🐧 — 日本語");
  });

  it("falls back to the SDK timestamp when a legacy timestamp is invalid", () => {
    const createdAt = Date.UTC(2026, 5, 7, 10, 0);

    const messages = mapper.toSessionMessages({
      info: { id: "a1", role: "assistant", createdAt: Number.POSITIVE_INFINITY, time: { created: createdAt } },
      parts: [{ type: "text", text: "answer" }],
    });

    expect(messages[0].createdAt).toBe(new Date(createdAt).toISOString());
  });
});
