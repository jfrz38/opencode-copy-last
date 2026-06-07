import { PairTargetIsNotMessageRoleError } from "../errors/copy-target.error.js";

const AGENT = 'agent' as const;
const USER = 'user' as const;
const PAIR = 'pair' as const;

type Agent = typeof AGENT;
type User = typeof USER;
type Pair = typeof PAIR;

export type CopyTargetValue = Agent | User | Pair;

const TARGET_ALIASES: Record<string, CopyTargetValue> = {
  agent: AGENT,
  assistant: AGENT,
  user: USER,
  me: USER,
  pair: PAIR,
  us: PAIR,
};

export class CopyTarget {
  private constructor(private readonly target: CopyTargetValue) {}

  static default(): CopyTarget {
    return new CopyTarget(AGENT);
  }

  static fromAlias(value: string): CopyTarget | undefined {
    const target = TARGET_ALIASES[value.toLowerCase()];
    return target ? new CopyTarget(target) : undefined;
  }

  static fromValue(value: CopyTargetValue): CopyTarget {
    return new CopyTarget(value);
  }

  get value(): CopyTargetValue {
    return this.target;
  }

  equals(value: CopyTargetValue): boolean {
    return this.target === value;
  }

  assertMessageRole(): Agent | User {
    if (this.target === PAIR) {
      throw new PairTargetIsNotMessageRoleError();
    }
    return this.target;
  }
}
