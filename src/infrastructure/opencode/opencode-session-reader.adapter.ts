import type { MessageId } from "../../domain/message/message-id.value-object.js";
import type { SessionMessage } from "../../domain/message/session-message.js";
import type { SessionReader } from "../../domain/ports/session-reader.port.js";
import type { OpenCodeSessionMessageMapperContract } from "./opencode-session-message.mapper.js";

export interface SessionMessagesClient {
  session: {
    messages(input: { path: { id: string }, responseStyle: "data" }): Promise<unknown>
  }
}

export class OpenCodeSessionReader implements SessionReader {
  constructor(
    private readonly client: SessionMessagesClient,
    private readonly mapper: OpenCodeSessionMessageMapperContract,
  ) { }

  async read(sessionID: string, excludeMessageID?: MessageId): Promise<SessionMessage[]> {
    const response = await this.client.session.messages({ path: { id: sessionID }, responseStyle: "data" });
    if (!Array.isArray(response)) {
      return [];
    }

    return response.flatMap((entry) => this.mapper.toSessionMessages(entry, excludeMessageID));
  }
}
