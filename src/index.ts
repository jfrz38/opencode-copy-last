import type { Plugin as PluginV1 } from "@opencode-ai/plugin";
import { Plugin } from "@opencode/plugin";
import { CopyLastRequest } from "./application/copy-last/copy-last.request.js";
import { CopyLastUseCase } from "./application/copy-last/copy-last.use-case.js";
import { CopyLastCommandParser } from "./domain/command/copy-last-command-parser.service.js";
import { isCopyLastError } from "./domain/errors/copy-last.error.js";
import { MarkdownMessageFormatter } from "./domain/message/markdown-message-formatter.service.js";
import { MessageSelector } from "./domain/message/message-selector.service.js";
import { ClipboardyClipboardWriter } from "./infrastructure/clipboard/clipboardy-clipboard-writer.adapter.js";
import { OpenCodeRpcNotifier } from "./infrastructure/opencode/opencode-rpc-notifier.adapter.js";
import { OpenCodeSessionContextReader } from "./infrastructure/opencode/opencode-session-context-reader.adapter.js";
import { OpenCodeSessionMessageMapper } from "./infrastructure/opencode/opencode-session-message.mapper.js";
import { OpenCodeValueReader } from "./infrastructure/opencode/opencode-value-reader.js";
import { OpenCodeV1Plugin } from "./infrastructure/opencode/opencode-v1.entry.js";
import { CopyLastRpc } from "./rpc.js";

const COMMAND_NAME = "copy-last";
const USAGE = "/copy-last [agent|user|pair] [count|all]";
const DESCRIPTION = "Copy recent session messages to the clipboard";

const plugin = Plugin.define({
  id: "copy-last",
  async setup(ctx) {
    const valueReader = new OpenCodeValueReader();
    const sessionMessageMapper = new OpenCodeSessionMessageMapper(valueReader);
    const registration = await ctx.rpc.register(CopyLastRpc, {});
    const useCase = new CopyLastUseCase(
      new OpenCodeSessionContextReader(ctx, sessionMessageMapper),
      new ClipboardyClipboardWriter(),
      new CopyLastCommandParser(),
      new MessageSelector(),
      new MarkdownMessageFormatter(),
    );

    await ctx.command.transform((editor) => {
      editor.add({
        name: COMMAND_NAME,
        description: `${USAGE} - ${DESCRIPTION}`,
        execute: async ({ sessionID, prompt }) => {
          const notifier = new OpenCodeRpcNotifier(registration.events, sessionID);
          try {
            const result = await useCase.execute(new CopyLastRequest(prompt.text, sessionID));
            await notifier.success(result.command);
          } catch (error) {
            await notifier.error(
              isCopyLastError(error) ? error.message : "Failed to copy messages",
            );
          }
        },
      });
    });

    return () => registration.dispose();
  },
});

/**
 * OpenCode 2 loads the plugin definition, while OpenCode 1.18.29 and newer call `server`.
 */
export default {
  ...plugin,
  server: OpenCodeV1Plugin,
} satisfies typeof plugin & { server: PluginV1 };
