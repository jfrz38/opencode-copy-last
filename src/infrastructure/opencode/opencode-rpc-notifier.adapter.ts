import type { CopyLastCommand } from "../../domain/command/copy-last-command.js";
import type { Notifier } from "../../domain/ports/notifier.port.js";
import type { CopyLastStatus } from "../../rpc.js";

export interface StatusEventPublisher {
  emit(name: "status", data: CopyLastStatus): Promise<void>
}

const ERROR = "error";
const SUCCESS = "success";

/**
 * OpenCode 2 servers cannot show toasts, so the plugin publishes the outcome as an RPC
 * event and the TUI entrypoint renders it. The session is part of the payload because RPC
 * events are broadcast to every connected location.
 */
export class OpenCodeRpcNotifier implements Notifier {
  constructor(
    private readonly publisher: StatusEventPublisher,
    private readonly sessionID: string,
  ) { }

  async success(command: CopyLastCommand): Promise<void> {
    const noun = "message";
    const plural = command.countValue === 1 ? noun : `${noun}s`;
    const count = command.isAllCount() ? "all" : command.countValue;
    await this.publish(`Copied ${count} ${command.targetValue} ${plural} to clipboard`, SUCCESS);
  }

  async error(message: string): Promise<void> {
    await this.publish(message, ERROR);
  }

  private async publish(message: string, variant: CopyLastStatus["variant"]): Promise<void> {
    await this.publisher.emit("status", { message, variant, sessionID: this.sessionID });
  }
}
