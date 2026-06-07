import type { MessageId } from "../../domain/message/message-id.value-object.js";
import type { OpenCodeCommandEventMapperContract } from "./opencode-command-event.mapper.js";

export interface CopyLastCommandEvent {
  sessionID: string
  arguments?: string | string[]
  messageID?: MessageId
}

export class OpenCodeCommandEventParser {
  constructor(private readonly mapper: OpenCodeCommandEventMapperContract) { }

  parse(input: unknown): CopyLastCommandEvent | undefined {
    return this.mapper.toCopyLastCommandEvent(input);
  }
}
