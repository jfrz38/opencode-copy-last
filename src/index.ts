import type { Plugin as PluginV1 } from "@opencode-ai/plugin";
import type { Plugin as PluginV2 } from "@opencode/plugin";
import { OpenCodeV1Plugin } from "./infrastructure/opencode/opencode-v1.entry.js";

/**
 * OpenCode 2 calls `setup`, while OpenCode 1.18.29 and newer call `server`.
 * The V2 entrypoint is loaded lazily so OpenCode 1 does not need to resolve the V2 runtime.
 */
export default {
  id: "copy-last",
  async setup(context: PluginV2.Context) {
    const { OpenCodeV2Plugin } = await import("./infrastructure/opencode/opencode-v2.entry.js");
    return OpenCodeV2Plugin.setup(context);
  },
  server: OpenCodeV1Plugin,
} satisfies PluginV2.Plugin & { server: PluginV1 };
