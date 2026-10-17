import { describe, expect, it, vi } from "vitest";
import plugin from "../src/index.js";

vi.mock("clipboardy", () => ({
  default: { write: vi.fn(async () => undefined) },
}));

const clipboard = (await import("clipboardy")).default;

interface Registered {
  name: string;
  description?: string;
  execute(input: { sessionID: string; prompt: { text: string } }): Promise<void>;
}

function createContext(messages: unknown[]) {
  const registered: Registered[] = [];
  const emit = vi.fn(async () => undefined);
  const dispose = vi.fn(async () => undefined);
  const context = {
    session: { context: vi.fn(async () => messages) },
    command: {
      transform: vi.fn(async (callback: (editor: { add(definition: Registered): void }) => void) => {
        callback({ add: (definition: Registered) => registered.push(definition) });
      }),
    },
    rpc: {
      register: vi.fn(async () => ({ events: { emit }, dispose })),
    },
  };

  return { context, registered, emit, dispose };
}

const SESSION_MESSAGES = [
  { id: "u1", type: "user", text: "first question", time: { created: 1 } },
  { id: "a1", type: "assistant", content: [{ type: "reasoning", text: "hidden" }, { type: "text", text: "first answer" }] },
  { id: "u2", type: "user", text: "second question", time: { created: 3 } },
  { id: "a2", type: "assistant", content: [{ type: "text", text: "second answer" }] },
];

describe("copy-last plugin", () => {
  it("registers the copy-last command with its usage", async () => {
    const { context, registered } = createContext([]);

    await plugin.setup(context as never);

    expect(registered).toHaveLength(1);
    expect(registered[0].name).toBe("copy-last");
    expect(registered[0].description).toContain("/copy-last [agent|user|pair] [count|all]");
  });

  it("copies the selected messages and publishes a success status", async () => {
    const { context, registered, emit } = createContext(SESSION_MESSAGES);
    await plugin.setup(context as never);

    await registered[0].execute({ sessionID: "session-1", prompt: { text: "user 2" } });

    expect(clipboard.write).toHaveBeenCalledWith("first question\n\n---\n\nsecond question");
    expect(emit).toHaveBeenCalledWith("status", {
      message: "Copied 2 user messages to clipboard",
      variant: "success",
      sessionID: "session-1",
    });
  });

  it("formats pairs with user and agent headings", async () => {
    const { context, registered } = createContext(SESSION_MESSAGES);
    await plugin.setup(context as never);

    await registered[0].execute({ sessionID: "session-1", prompt: { text: "pair 1" } });

    expect(clipboard.write).toHaveBeenCalledWith(
      "## User\n\nsecond question\n\n## Agent\n\nsecond answer",
    );
  });

  it("publishes an error status for unknown arguments", async () => {
    const { context, registered, emit } = createContext(SESSION_MESSAGES);
    await plugin.setup(context as never);

    await registered[0].execute({ sessionID: "session-1", prompt: { text: "bogus" } });

    expect(clipboard.write).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith("status", {
      message: "Unknown argument: bogus",
      variant: "error",
      sessionID: "session-1",
    });
  });

  it("disposes the RPC registration on cleanup", async () => {
    const { context, dispose } = createContext([]);
    const cleanup = await plugin.setup(context as never);

    await cleanup?.();

    expect(dispose).toHaveBeenCalled();
  });

  it("reports the session that ran the command", async () => {
    const { context, registered, emit } = createContext(SESSION_MESSAGES);
    await plugin.setup(context as never);

    await registered[0].execute({ sessionID: "session-1", prompt: { text: "user 1" } });

    expect(emit).toHaveBeenCalledWith("status", {
      message: "Copied 1 user message to clipboard",
      variant: "success",
      sessionID: "session-1",
    });
  });
});

describe("copy-last OpenCode 1 entrypoint", () => {
  function createClient() {
    return {
      session: {
        messages: vi.fn(async () => [
          { info: { id: "u1", role: "user" }, parts: [{ type: "text", text: "first question" }] },
          { info: { id: "a1", role: "assistant" }, parts: [{ type: "text", text: "first answer" }] },
        ]),
      },
      tui: {
        showToast: vi.fn(async () => undefined),
      },
    };
  }

  async function loadHooks(client: ReturnType<typeof createClient>) {
    return (plugin.server as (input: unknown) => Promise<Record<string, (...args: never[]) => Promise<void>>>)({
      client,
      directory: "/workspace/project",
      project: { id: "project-1" },
      worktree: "/workspace/project",
    });
  }

  const input = { command: "copy-last", sessionID: "session-1", messageID: "cmd-1", arguments: "user 1" };

  it("registers the copy-last command in the OpenCode 1 config", async () => {
    const hooks = await loadHooks(createClient());
    const config: { command?: Record<string, unknown> } = {};

    await hooks.config(config as never);

    expect(config.command?.["copy-last"]).toMatchObject({
      template: "/copy-last [agent|user|pair] [count|all]",
      description: "Copy recent session messages to the clipboard",
    });
  });

  it("copies the requested messages and aborts the command", async () => {
    const client = createClient();
    const hooks = await loadHooks(client);

    await expect(hooks["command.execute.before"](input as never)).rejects.toThrow("OPENCODE_COPY_LAST_HANDLED");

    expect(client.session.messages).toHaveBeenCalledWith({ path: { id: "session-1" }, responseStyle: "data" });
    expect(clipboard.write).toHaveBeenCalledWith("first question");
    expect(client.tui.showToast).toHaveBeenCalledWith({
      body: { message: "Copied 1 user message to clipboard", variant: "success" },
    });
  });

  it("reports argument errors without copying", async () => {
    const client = createClient();
    const hooks = await loadHooks(client);

    await expect(hooks["command.execute.before"]({ ...input, arguments: "bogus" } as never))
      .rejects.toThrow("OPENCODE_COPY_LAST_HANDLED");

    expect(clipboard.write).not.toHaveBeenCalled();
    expect(client.tui.showToast).toHaveBeenCalledWith({
      body: { message: "Unknown argument: bogus", variant: "error" },
    });
  });

  it("ignores commands other than copy-last", async () => {
    const client = createClient();
    const hooks = await loadHooks(client);

    await expect(hooks["command.execute.before"]({ ...input, command: "init" } as never)).resolves.toBeUndefined();

    expect(clipboard.write).not.toHaveBeenCalled();
  });
});
