import { CopyCountTooLargeError, CopyCountTooSmallError, InvalidCopyCountError } from "../errors/copy-count.error.js";

const DEFAULT_COUNT = 1;
const MAX_COUNT = 20;
const MIN_COUNT = 1;

export class CopyCount {
  private constructor(private readonly count: number) { }

  static default(): CopyCount {
    return new CopyCount(DEFAULT_COUNT);
  }

  static fromNumber(value: number): CopyCount {
    if (!Number.isInteger(value)) {
      throw new InvalidCopyCountError(value);
    }
    if (value < MIN_COUNT) {
      throw new CopyCountTooSmallError();
    }
    if (value > MAX_COUNT) {
      throw new CopyCountTooLargeError(MAX_COUNT);
    }
    return new CopyCount(value);
  }

  get value(): number {
    return this.count;
  }
}
