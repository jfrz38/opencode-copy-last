import { describe, expect, it } from "vitest";
import { CopyLastRequest } from "../../../src/application/copy-last/copy-last.request.js";
import { CopyLastUseCase } from "../../../src/application/copy-last/copy-last.use-case.js";
import { CopyLastCommandParser } from "../../../src/domain/command/copy-last-command-parser.service.js";
import { MessageId } from "../../../src/domain/message/message-id.value-object.js";
import { MarkdownMessageFormatter } from "../../../src/domain/message/markdown-message-formatter.service.js";
import { MessageSelector } from "../../../src/domain/message/message-selector.service.js";
import { SessionMessage } from "../../../src/domain/message/session-message.js";
import type { ClipboardWriter } from "../../../src/domain/ports/clipboard-writer.port.js";
import type { SessionReader } from "../../../src/domain/ports/session-reader.port.js";
import { OpenCodeSessionMessageMapper } from "../../../src/infrastructure/opencode/opencode-session-message.mapper.js";
import { OpenCodeSessionReader, type SessionMessagesClient } from "../../../src/infrastructure/opencode/opencode-session-reader.adapter.js";
import { OpenCodeValueReader } from "../../../src/infrastructure/opencode/opencode-value-reader.js";

describe("CopyLastUseCase", () => {
  it("orchestrates parsing, selection, formatting and clipboard writing", async () => {
    const messages = [
      SessionMessage.user("question", { id: "u1" }),
      SessionMessage.agent("answer", { id: "a1" }),
    ];
    const writes: string[] = [];
    const sessionReader: SessionReader = {
      read: async (sessionID, excludeMessageID) => {
        expect(sessionID).toBe("session-1");
        expect(excludeMessageID?.equals("cmd")).toBe(true);
        return messages;
      },
    };
    const clipboardWriter: ClipboardWriter = {
      write: async (text) => {
        writes.push(text);
      },
    };

    const result = await new CopyLastUseCase(
      sessionReader,
      clipboardWriter,
      new CopyLastCommandParser(),
      new MessageSelector(),
      new MarkdownMessageFormatter(),
    ).execute(new CopyLastRequest("pair", "session-1", MessageId.fromString("cmd")));

    expect(result.command.targetValue).toBe("pair");
    expect(result.command.countValue).toBe(1);
    expect(result.copiedText).toBe("## User\n\nquestion\n\n## Agent\n\nanswer");
    expect(writes).toEqual(["## User\n\nquestion\n\n## Agent\n\nanswer"]);
  });

  it("copies the final visible Unicode response from an OpenCode payload", async () => {
    const client: SessionMessagesClient = {
      session: {
        messages: async () => [
          {
            info: { id: "a2", role: "assistant", time: { created: 3 } },
            parts: [{ type: "text", text: "Respuesta final: pingüino 🐧 — 日本語" }],
          },
          {
            info: { id: "u1", role: "user", time: { created: 1 } },
            parts: [{ type: "text", text: "¿Cuál es la última respuesta?" }],
          },
          {
            info: { id: "cmd", role: "user", time: { created: 4 } },
            parts: [{ type: "text", text: "/copy-last pair" }],
          },
          {
            info: { id: "a1", role: "assistant", time: { created: 2 } },
            parts: [
              { type: "reasoning", text: "private reasoning" },
              { type: "text", text: "Preparando respuesta…" },
            ],
          },
        ],
      },
    };
    const writes: string[] = [];
    const clipboardWriter: ClipboardWriter = {
      write: async (text) => {
        writes.push(text);
      },
    };
    const sessionReader = new OpenCodeSessionReader(
      client,
      new OpenCodeSessionMessageMapper(new OpenCodeValueReader()),
    );

    const result = await new CopyLastUseCase(
      sessionReader,
      clipboardWriter,
      new CopyLastCommandParser(),
      new MessageSelector(),
      new MarkdownMessageFormatter(),
    ).execute(new CopyLastRequest("pair", "session-1", MessageId.fromString("cmd")));

    const expected = "## User\n\n¿Cuál es la última respuesta?\n\n## Agent\n\nRespuesta final: pingüino 🐧 — 日本語";
    expect(result.copiedText).toBe(expected);
    expect(writes).toEqual([expected]);
  });
});
