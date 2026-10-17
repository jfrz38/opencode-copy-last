import type { MessageId } from "../../domain/message/message-id.value-object.js";
import type { SessionMessage } from "../../domain/message/session-message.js";
import type { SessionReader } from "../../domain/ports/session-reader.port.js";
import type { OpenCodeSessionMessageMapperContract } from "./opencode-session-message.mapper.js";

export interface SessionContextClient {
  session: {
    context(input: { sessionID: string }): Promise<unknown>
  }
}

/**
 * Reads the session context exposed by the OpenCode 2 plugin API.
 *
 * The context is the model-visible history, so messages replaced by a compaction summary are
 * not part of the result.
 */
export class OpenCodeSessionContextReader implements SessionReader {
  constructor(
    private readonly client: SessionContextClient,
    private readonly mapper: OpenCodeSessionMessageMapperContract,
  ) { }

  async read(sessionID: string, excludeMessageID?: MessageId): Promise<SessionMessage[]> {
    const response = await this.client.session.context({ sessionID });
    if (!Array.isArray(response)) {
      return [];
    }

    return response.flatMap((entry) => this.mapper.toSessionMessages(entry, excludeMessageID));
  }
}
