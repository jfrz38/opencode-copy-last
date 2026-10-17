import { describe, expect, it, vi } from "vitest";
import { CopyLastCommand } from "../../../src/domain/command/copy-last-command.js";
import { CopyCount } from "../../../src/domain/command/copy-count.js";
import { CopyTarget } from "../../../src/domain/command/copy-target.js";
import { OpenCodeRpcNotifier } from "../../../src/infrastructure/opencode/opencode-rpc-notifier.adapter.js";
import type { StatusEventPublisher } from "../../../src/infrastructure/opencode/opencode-rpc-notifier.adapter.js";

const SESSION_ID = "ses_1";

function publisher(): StatusEventPublisher {
  return { emit: vi.fn(async () => undefined) };
}

describe("OpenCodeRpcNotifier", () => {
  it("publishes a success status with the copied count and session", async () => {
    const events = publisher();

    await new OpenCodeRpcNotifier(events, SESSION_ID).success(new CopyLastCommand({ count: CopyCount.fromNumber(2) }));

    expect(events.emit).toHaveBeenCalledWith("status", {
      message: "Copied 2 agent messages to clipboard",
      variant: "success",
      sessionID: SESSION_ID,
    });
  });

  it("reports an all-count command without a number", async () => {
    const events = publisher();

    await new OpenCodeRpcNotifier(events, SESSION_ID).success(new CopyLastCommand({
      target: CopyTarget.fromAlias("user"),
      count: CopyCount.all(),
    }));

    expect(events.emit).toHaveBeenCalledWith("status", {
      message: "Copied all user messages to clipboard",
      variant: "success",
      sessionID: SESSION_ID,
    });
  });

  it("uses the singular noun for a single message", async () => {
    const events = publisher();

    await new OpenCodeRpcNotifier(events, SESSION_ID).success(new CopyLastCommand());

    expect(events.emit).toHaveBeenCalledWith("status", {
      message: "Copied 1 agent message to clipboard",
      variant: "success",
      sessionID: SESSION_ID,
    });
  });

  it("publishes failures as an error status", async () => {
    const events = publisher();

    await new OpenCodeRpcNotifier(events, SESSION_ID).error("Unknown argument: bogus");

    expect(events.emit).toHaveBeenCalledWith("status", {
      message: "Unknown argument: bogus",
      variant: "error",
      sessionID: SESSION_ID,
    });
  });

  it("scopes statuses to the session of each invocation", async () => {
    const events = publisher();

    await new OpenCodeRpcNotifier(events, "ses_1").error("first");
    await new OpenCodeRpcNotifier(events, "ses_2").error("second");

    expect(events.emit).toHaveBeenNthCalledWith(1, "status", expect.objectContaining({ sessionID: "ses_1" }));
    expect(events.emit).toHaveBeenNthCalledWith(2, "status", expect.objectContaining({ sessionID: "ses_2" }));
  });
});
