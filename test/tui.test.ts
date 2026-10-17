import { describe, expect, it, vi } from "vitest";
import type { Context } from "@opencode/plugin/tui/context";
import { CopyLastRpc } from "../src/rpc.js";

// The real TUI entrypoint pulls in the renderer, which is not needed to exercise the plugin.
vi.mock("@opencode/plugin/tui", () => ({ Plugin: { define: (definition: unknown) => definition } }));

const { default: plugin } = await import("../src/tui.js");

type StatusEventPayload = { data: unknown; location?: { directory?: string; workspaceID?: string } };
type Handler = (event: StatusEventPayload) => void;
type Location = StatusEventPayload["location"];
type Route = { type: "home" } | { type: "session"; sessionID: string };

const SESSION_ID = "ses_1";
const DIRECTORY = "/workspace/project";

interface ContextOptions {
  location?: Location;
  defaultLocation?: Location;
  route?: Route;
  roots?: Record<string, string>;
}

function createContext(options: ContextOptions = {}) {
  let handler: Handler | undefined;
  let location = Object.hasOwn(options, "location") ? options.location : { directory: DIRECTORY };
  const defaultLocation = options.defaultLocation ?? { directory: DIRECTORY };
  const route = options.route ?? { type: "session", sessionID: SESSION_ID };
  const unsubscribe = vi.fn();
  const show = vi.fn();
  const on = vi.fn((_name: string, next: Handler) => {
    handler = next;
    return unsubscribe;
  });
  const rpc = vi.fn(() => ({ events: { on } }));
  const defaultLocationReader = vi.fn(() => defaultLocation);
  const root = vi.fn((sessionID: string) => options.roots?.[sessionID] ?? sessionID);
  const context = {
    get location() {
      return location;
    },
    data: {
      location: { default: defaultLocationReader },
      session: { root },
    },
    client: { rpc },
    ui: {
      router: { current: vi.fn(() => route) },
      toast: { show },
    },
  } as unknown as Context;

  return {
    context,
    show,
    rpc,
    on,
    unsubscribe,
    defaultLocationReader,
    emit: (event: StatusEventPayload) => handler?.(event),
    setLocation: (next: Location) => {
      location = next;
    },
  };
}

function status(overrides: Record<string, unknown> = {}, location: StatusEventPayload["location"] = { directory: DIRECTORY }) {
  return {
    data: { message: "Copied 1 user message to clipboard", variant: "success", sessionID: SESSION_ID, ...overrides },
    location,
  };
}

describe("copy-last TUI plugin", () => {
  it("subscribes to the copy-last status event and returns its unsubscribe function", () => {
    const { context, rpc, on, unsubscribe } = createContext();

    const cleanup = plugin.setup(context);

    expect(rpc).toHaveBeenCalledWith(CopyLastRpc);
    expect(on).toHaveBeenCalledWith("status", expect.any(Function));
    expect(cleanup).toBe(unsubscribe);
  });

  it("shows a success toast for the session that ran the command", () => {
    const { context, show, emit } = createContext();

    plugin.setup(context);
    emit(status());

    expect(show).toHaveBeenCalledWith({
      message: "Copied 1 user message to clipboard",
      variant: "success",
      sessionID: SESSION_ID,
      duration: 4000,
    });
  });

  it("shows an error toast", () => {
    const { context, show, emit } = createContext();

    plugin.setup(context);
    emit(status({ variant: "error", message: "Unknown argument: bogus" }));

    expect(show).toHaveBeenCalledWith(expect.objectContaining({
      message: "Unknown argument: bogus",
      variant: "error",
      sessionID: SESSION_ID,
    }));
  });

  it("ignores events raised for another location", () => {
    const { context, show, emit } = createContext();

    plugin.setup(context);
    emit(status({}, { directory: "/workspace/other" }));

    expect(show).not.toHaveBeenCalled();
  });

  it("ignores events without a location", () => {
    const { context, show, emit } = createContext();

    plugin.setup(context);
    emit({ ...status(), location: undefined });

    expect(show).not.toHaveBeenCalled();
  });

  it("ignores events from another workspace of the same directory", () => {
    const { context, show, emit } = createContext({
      location: { directory: DIRECTORY, workspaceID: "ws-1" },
    });

    plugin.setup(context);
    emit(status({}, { directory: DIRECTORY, workspaceID: "ws-2" }));

    expect(show).not.toHaveBeenCalled();
  });

  it("accepts events from the current workspace", () => {
    const { context, show, emit } = createContext({
      location: { directory: DIRECTORY, workspaceID: "ws-1" },
    });

    plugin.setup(context);
    emit(status({}, { directory: DIRECTORY, workspaceID: "ws-1" }));

    expect(show).toHaveBeenCalledTimes(1);
  });

  it("falls back to the default location when the plugin has none", () => {
    const { context, show, emit, defaultLocationReader } = createContext({
      location: undefined,
      defaultLocation: { directory: DIRECTORY },
    });

    plugin.setup(context);
    emit(status({}, { directory: DIRECTORY }));
    emit(status({}, { directory: "/workspace/other" }));

    expect(defaultLocationReader).toHaveBeenCalledTimes(2);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("uses the current location when it changes after setup", () => {
    const { context, show, emit, setLocation } = createContext();
    plugin.setup(context);
    setLocation({ directory: "/workspace/other" });

    emit(status({}, { directory: DIRECTORY }));
    emit(status({}, { directory: "/workspace/other" }));

    expect(show).toHaveBeenCalledTimes(1);
  });

  it("ignores statuses for another session in the same location", () => {
    const { context, show, emit } = createContext();
    plugin.setup(context);

    emit(status({ sessionID: "ses_2" }));

    expect(show).not.toHaveBeenCalled();
  });

  it("accepts statuses from the current session family", () => {
    const { context, show, emit } = createContext({
      route: { type: "session", sessionID: "ses_child" },
      roots: { ses_child: "ses_root", ses_sibling: "ses_root" },
    });
    plugin.setup(context);

    emit(status({ sessionID: "ses_sibling" }));

    expect(show).toHaveBeenCalledTimes(1);
  });

  it("ignores statuses when no session is open", () => {
    const { context, show, emit } = createContext({ route: { type: "home" } });
    plugin.setup(context);

    emit(status());

    expect(show).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-object payload", "nope"],
    ["a missing message", { variant: "success", sessionID: SESSION_ID }],
    ["a missing session", { message: "Copied 1 user message", variant: "success" }],
    ["an unknown variant", { message: "Copied 1 user message", variant: "info", sessionID: SESSION_ID }],
  ])("ignores %s", (_label, data) => {
    const { context, show, emit } = createContext();

    plugin.setup(context);
    emit({ data, location: { directory: DIRECTORY } });

    expect(show).not.toHaveBeenCalled();
  });
});
