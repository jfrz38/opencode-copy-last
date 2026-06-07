const HANDLED_ERROR = "OPENCODE_COPY_LAST_HANDLED";

export class HandledCopyLastCommand extends Error {
  constructor() {
    super(HANDLED_ERROR);
    this.name = "HandledCopyLastCommand";
  }
}

export function isHandledCopyLastCommand(error: unknown): error is HandledCopyLastCommand {
  return error instanceof HandledCopyLastCommand;
}

export function abortHandledCopyLastCommand(): never {
  throw new HandledCopyLastCommand();
}
