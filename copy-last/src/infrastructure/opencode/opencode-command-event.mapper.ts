import type { CopyLastCommandEvent } from "./opencode-command-event-parser.adapter.js";
import type { OpenCodeValueReader } from "./opencode-value-reader.js";

const COMMAND_NAME = "copy-last";

export interface OpenCodeCommandEventMapperContract {
  toCopyLastCommandEvent(input: unknown): CopyLastCommandEvent | undefined
}

export class OpenCodeCommandEventMapper implements OpenCodeCommandEventMapperContract {
  constructor(private readonly valueReader: OpenCodeValueReader) { }

  toCopyLastCommandEvent(input: unknown): CopyLastCommandEvent | undefined {
    if (!this.valueReader.isRecord(input)) {
      return undefined;
    }

    const commandName = this.valueReader.string(input.command);
    if (commandName !== COMMAND_NAME) {
      return undefined;
    }

    const sessionID = this.valueReader.string(input.sessionID);
    if (!sessionID) {
      return undefined;
    }

    return {
      sessionID,
      arguments: this.valueReader.string(input.arguments) ?? "",
      messageID: this.valueReader.string(input.messageID),
    };
  }
}
