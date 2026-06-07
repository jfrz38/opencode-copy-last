import type { Plugin } from "@opencode-ai/plugin";
import { CopyLastRequest } from "./application/copy-last/copy-last.request.js";
import { CopyLastUseCase } from "./application/copy-last/copy-last.use-case.js";
import { CopyLastCommandParser } from "./domain/command/copy-last-command-parser.service.js";
import { isCopyLastError } from "./domain/errors/copy-last.error.js";
import { MarkdownMessageFormatter } from "./domain/message/markdown-message-formatter.service.js";
import { MessageSelector } from "./domain/message/message-selector.service.js";
import { ClipboardyClipboardWriter } from "./infrastructure/clipboard/clipboardy-clipboard-writer.adapter.js";
import { abortHandledCopyLastCommand } from "./infrastructure/opencode/opencode-command-flow-control.js";
import { OpenCodeNotifier } from "./infrastructure/opencode/opencode-notifier.adapter.js";
import { OpenCodeSessionMessageMapper } from "./infrastructure/opencode/opencode-session-message.mapper.js";
import { OpenCodeSessionReader } from "./infrastructure/opencode/opencode-session-reader.adapter.js";
import { OpenCodeValueReader } from "./infrastructure/opencode/opencode-value-reader.js";

const COMMAND_NAME = "copy-last";

export default (async ({ client }) => {
  const sessionMessageMapper = new OpenCodeSessionMessageMapper(new OpenCodeValueReader());
  const notifier = new OpenCodeNotifier(client);
  const useCase = new CopyLastUseCase(
    new OpenCodeSessionReader(client, sessionMessageMapper),
    new ClipboardyClipboardWriter(),
    new CopyLastCommandParser(),
    new MessageSelector(),
    new MarkdownMessageFormatter(),
  );

  return {
    "command.execute.before": async (input) => {
      if (input.command !== COMMAND_NAME) {
        return;
      }

      try {
        const result = await useCase.execute(
          new CopyLastRequest(input.arguments, input.sessionID),
        );
        await notifier.success(result.command);
      } catch (error) {
        await notifier.error(
          isCopyLastError(error) ? error.message : "Failed to copy messages",
        );
      }

      abortHandledCopyLastCommand();
    },
  };
}) satisfies Plugin;
