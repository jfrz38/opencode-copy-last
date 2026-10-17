import { Rpc } from "@opencode/plugin";

export type CopyLastStatusVariant = "success" | "error";

export type CopyLastStatus = {
  message: string;
  variant: CopyLastStatusVariant;
  sessionID: string;
};

export const CopyLastRpc = Rpc.define({
  id: "copy-last",
  methods: {},
  events: {
    status: {
      schema: {
        type: "object",
        properties: {
          message: { type: "string" },
          variant: { type: "string", enum: ["success", "error"] },
          sessionID: { type: "string" },
        },
        required: ["message", "variant", "sessionID"],
        additionalProperties: false,
      },
    },
  },
});
