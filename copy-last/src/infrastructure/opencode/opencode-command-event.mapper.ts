import type { CopyLastCommandEvent } from "./opencode-command-event-parser.adapter.js";
import type { OpenCodeValueReader } from "./opencode-value-reader.js";

const COMMAND_NAME = "copy-last";
const MARKER = "OPENCODE_COPY_LAST_COMMAND";
const COMMAND_EXECUTED = "command.executed";

export interface OpenCodeCommandEventMapperContract {
  toCopyLastCommandEvent(input: unknown): CopyLastCommandEvent | undefined
}

export class OpenCodeCommandEventMapper implements OpenCodeCommandEventMapperContract {
  constructor(private readonly valueReader: OpenCodeValueReader) { }

  toCopyLastCommandEvent(input: unknown): CopyLastCommandEvent | undefined {
    if (!this.valueReader.isRecord(input)) {
      return undefined;
    }
    const event = this.valueReader.isRecord(input.event) ? input.event : input;
    const type = this.valueReader.string(event.type) ?? this.valueReader.string(event.name);
    const properties = this.valueReader.isRecord(event.properties) ? event.properties : event;

    const commandName = this.valueReader.string(properties.name) ?? this.valueReader.string(properties.command);
    if (type === COMMAND_EXECUTED && commandName === COMMAND_NAME) {
      return this.commandFromProperties(properties);
    }

    return this.markerCommandFromProperties(properties);
  }

  private commandFromProperties(properties: Record<string, unknown>): CopyLastCommandEvent | undefined {
    const sessionID = this.valueReader.string(properties.sessionID) ?? this.valueReader.string(properties.sessionId);
    if (!sessionID) {
      return undefined;
    }

    return {
      sessionID,
      arguments: this.valueReader.string(properties.arguments) ?? this.valueReader.stringArray(properties.arguments),
      messageID: this.valueReader.string(properties.messageID) ?? this.valueReader.string(properties.messageId),
    };
  }

  private markerCommandFromProperties(properties: Record<string, unknown>): CopyLastCommandEvent | undefined {
    const text = this.valueReader.string(properties.prompt) ?? this.valueReader.string(properties.message) ?? this.valueReader.string(properties.text);
    if (!text?.startsWith(MARKER)) {
      return undefined;
    }

    const sessionID = this.valueReader.string(properties.sessionID) ?? this.valueReader.string(properties.sessionId);
    if (!sessionID) {
      return undefined;
    }

    return {
      sessionID,
      arguments: text.slice(MARKER.length).trim(),
      messageID: this.valueReader.string(properties.messageID) ?? this.valueReader.string(properties.messageId),
    };
  }
}
