import type { MessageId } from "../../domain/message/message-id.value-object.js";
import { SessionMessage, type SessionMessageRole } from "../../domain/message/session-message.js";
import { CopyTarget } from "../../domain/command/copy-target.js";
import type { OpenCodeValueReader } from "./opencode-value-reader.js";

export interface OpenCodeSessionMessageMapperContract {
  toSessionMessages(entry: unknown, excludeMessageID?: MessageId): SessionMessage[]
}

export class OpenCodeSessionMessageMapper implements OpenCodeSessionMessageMapperContract {
  constructor(private readonly valueReader: OpenCodeValueReader) { }

  toSessionMessages(entry: unknown, excludeMessageID?: MessageId): SessionMessage[] {
    if (!this.valueReader.isRecord(entry)) {
      return [];
    }

    const info = this.valueReader.isRecord(entry.info) ? entry.info : entry;
    const id = this.valueReader.string(info.id) ?? this.valueReader.string(info.messageID);
    if (excludeMessageID?.equals(id)) {
      return [];
    }

    const role = this.normalizeRole(this.valueReader.string(info.role) ?? this.valueReader.string(info.author));
    if (!role) {
      return [];
    }

    const content = this.extractContent(entry).trim();
    if (!content) {
      return [];
    }

    const time = this.valueReader.isRecord(info.time) ? info.time : undefined;
    return [SessionMessage.create({ id, role, content, createdAt: this.valueReader.string(info.createdAt) ?? this.valueReader.string(time?.created) })];
  }

  private extractContent(entry: Record<string, unknown>): string {
    const direct = this.valueReader.string(entry.content) ?? this.valueReader.string(entry.text);
    if (direct) {
      return direct;
    }

    const info = this.valueReader.isRecord(entry.info) ? entry.info : undefined;
    const infoText = info ? this.valueReader.string(info.content) ?? this.valueReader.string(info.text) : undefined;
    if (infoText) {
      return infoText;
    }

    if (!Array.isArray(entry.parts)) {
      return "";
    }
    return entry.parts.map((part) => this.extractPartText(part)).filter(Boolean).join("\n\n");
  }

  private extractPartText(part: unknown): string {
    if (typeof part === "string") {
      return part;
    }
    if (!this.valueReader.isRecord(part)) {
      return "";
    }
    const type = this.valueReader.string(part.type);
    if (type && type !== "text") {
      return "";
    }
    return this.valueReader.string(part.text) ?? this.valueReader.string(part.content) ?? "";
  }

  private normalizeRole(role: string | undefined): SessionMessageRole | undefined {
    return role ? CopyTarget.fromAlias(role)?.toMessageRole() : undefined;
  }

}
