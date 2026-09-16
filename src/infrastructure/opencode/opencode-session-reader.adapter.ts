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

    const messages = response.flatMap((entry) => this.mapper.toSessionMessages(entry, excludeMessageID));
    return this.sortChronologically(messages);
  }

  private sortChronologically(messages: SessionMessage[]): SessionMessage[] {
    const datedMessages = messages
      .map((message, index) => ({ message, index, timestamp: this.timestampOf(message) }))
      .filter((entry): entry is typeof entry & { timestamp: number } => entry.timestamp !== undefined)
      .sort((left, right) => left.timestamp - right.timestamp || left.index - right.index);

    let datedIndex = 0;
    return messages.map((message) => this.timestampOf(message) === undefined ? message : datedMessages[datedIndex++].message);
  }

  private timestampOf(message: SessionMessage): number | undefined {
    if (!message.createdAt) {
      return undefined;
    }
    const timestamp = Date.parse(message.createdAt);
    return Number.isNaN(timestamp) ? undefined : timestamp;
  }
}
