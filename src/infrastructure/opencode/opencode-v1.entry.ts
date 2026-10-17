import type { Plugin as PluginV1 } from "@opencode-ai/plugin";
import { CopyLastRequest } from "../../application/copy-last/copy-last.request.js";
import { CopyLastUseCase } from "../../application/copy-last/copy-last.use-case.js";
import { CopyLastCommandParser } from "../../domain/command/copy-last-command-parser.service.js";
import { isCopyLastError } from "../../domain/errors/copy-last.error.js";
import { MarkdownMessageFormatter } from "../../domain/message/markdown-message-formatter.service.js";
import { MessageSelector } from "../../domain/message/message-selector.service.js";
import { ClipboardyClipboardWriter } from "../clipboard/clipboardy-clipboard-writer.adapter.js";
import { abortHandledCopyLastCommand } from "./opencode-command-flow-control.js";
import { OpenCodeCommandEventMapper } from "./opencode-command-event.mapper.js";
import { OpenCodeCommandEventParser } from "./opencode-command-event-parser.adapter.js";
import { OpenCodeNotifier } from "./opencode-notifier.adapter.js";
import { OpenCodeSessionMessageMapper } from "./opencode-session-message.mapper.js";
import { OpenCodeSessionReader } from "./opencode-session-reader.adapter.js";
import { OpenCodeValueReader } from "./opencode-value-reader.js";

const COMMAND_NAME = "copy-last";
const DESCRIPTION = "Copy recent session messages to the clipboard";

/**
 * OpenCode 1 entrypoint. OpenCode 1.18.29 and newer call `server`; older 1.x releases load
 * the object entrypoint directly.
 */
export const OpenCodeV1Plugin: PluginV1 = async ({ client }) => {
  const valueReader = new OpenCodeValueReader();
  const commandEventParser = new OpenCodeCommandEventParser(new OpenCodeCommandEventMapper(valueReader));
  const sessionMessageMapper = new OpenCodeSessionMessageMapper(valueReader);
  const notifier = new OpenCodeNotifier(client);
  const useCase = new CopyLastUseCase(
    new OpenCodeSessionReader(client, sessionMessageMapper),
    new ClipboardyClipboardWriter(),
    new CopyLastCommandParser(),
    new MessageSelector(),
    new MarkdownMessageFormatter(),
  );

  return {
    config: async (input) => {
      input.command ??= {};
      input.command[COMMAND_NAME] = {
        template: `/${COMMAND_NAME} [agent|user|pair] [count|all]`,
        description: DESCRIPTION,
      };
    },
    "command.execute.before": async (input: unknown) => {
      const event = commandEventParser.parse(input);
      if (!event) {
        return;
      }

      try {
        const result = await useCase.execute(
          new CopyLastRequest(event.arguments, event.sessionID, event.messageID),
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
};
