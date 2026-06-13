import type { CopyLastCommand } from "../../domain/command/copy-last-command.js";
// import { COPY_TARGET } from "../../domain/command/copy-target-value.js";
import type { Notifier } from "../../domain/ports/notifier.port.js";

type ToastVariant = "info" | "success" | "warning" | "error";
type AlertVariant = Extract<ToastVariant, "success" | "error">;

const ERROR = "error";
const SUCCESS = "success";

export interface ToastClient {
  tui?: {
    showToast?(input: { body: { title?: string; message: string; variant: ToastVariant; duration?: number } }): Promise<unknown>
  }
}

export class OpenCodeNotifier implements Notifier {
  constructor(private readonly client: ToastClient) { }

  async success(command: CopyLastCommand): Promise<void> {
    const noun = "message";
    const plural = command.countValue === 1 ? noun : `${noun}s`;
    const count = command.isAllCount() ? "all" : command.countValue;
    await this.showToast(`Copied ${count} ${command.targetValue} ${plural} to clipboard`, SUCCESS);
  }

  async error(message: string): Promise<void> {
    await this.showToast(message, ERROR);
  }

  private async showToast(message: string, variant: AlertVariant): Promise<void> {
    await this.client.tui?.showToast?.({ body: { message, variant } });
  }
}
