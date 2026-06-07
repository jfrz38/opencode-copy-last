import type { SessionMessage } from "../message/session-message.js";

export interface SessionReader {
  read(sessionID: string, excludeMessageID?: string): Promise<SessionMessage[]>
}
