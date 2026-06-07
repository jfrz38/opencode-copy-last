export class CopyLastRequest {
  constructor(
    readonly args: string | string[] | undefined,
    readonly sessionID: string,
    readonly excludeMessageID?: string,
  ) {}
}
