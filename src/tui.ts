import { Plugin } from "@opencode/plugin/tui";
import type { Context } from "@opencode/plugin/tui/context";
import { CopyLastRpc, type CopyLastStatus } from "./rpc.js";

const TOAST_DURATION_MS = 4000;

interface StatusEvent {
  readonly data: unknown;
  readonly location?: { directory?: string; workspaceID?: string };
}

function readStatus(data: unknown): CopyLastStatus | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const { message, variant, sessionID } = data as Partial<Record<keyof CopyLastStatus, unknown>>;
  if (typeof message !== "string" || typeof sessionID !== "string") {
    return undefined;
  }
  if (variant !== "success" && variant !== "error") {
    return undefined;
  }

  return { message, variant, sessionID };
}

/**
 * RPC events are broadcast to every connected location, so events raised by another
 * workspace are ignored.
 */
function isCurrentLocation(
  current: { directory?: string; workspaceID?: string } | undefined,
  event: StatusEvent,
): boolean {
  if (!current?.directory || !event.location?.directory) {
    return false;
  }

  return current.directory === event.location.directory
    && (current.workspaceID ?? undefined) === (event.location.workspaceID ?? undefined);
}

function isCurrentSession(context: Pick<Context, "data" | "ui">, sessionID: string): boolean {
  const route = context.ui.router.current();
  if (route.type !== "session" || !route.sessionID) {
    return false;
  }

  return context.data.session.root(route.sessionID) === context.data.session.root(sessionID);
}

/**
 * Renders the copy outcome as a toast, because an OpenCode 2 server cannot show toasts itself.
 */
export default Plugin.define({
  id: "copy-last.tui",
  setup(context) {
    const copyLast = context.client.rpc(CopyLastRpc);

    return copyLast.events.on("status", (event) => {
      const current = context.location ?? context.data.location.default();
      if (!isCurrentLocation(current, event as StatusEvent)) {
        return;
      }

      const status = readStatus(event.data);
      if (!status) {
        return;
      }
      if (!isCurrentSession(context, status.sessionID)) {
        return;
      }

      context.ui.toast.show({
        message: status.message,
        variant: status.variant,
        sessionID: status.sessionID,
        duration: TOAST_DURATION_MS,
      });
    });
  },
});
