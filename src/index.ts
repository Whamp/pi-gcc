import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function activate(pi: ExtensionAPI) {
  // React to events
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });

  // Register a custom tool
  pi.registerTool({
    name: "hello",
    label: "Hello",
    description: "Greet someone by name",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      return Promise.resolve({
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      });
    },
  });

  // Register a command
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: (args, ctx) => {
      ctx.ui.notify(`Hello ${args || "world"}!`, "info");
      return Promise.resolve();
    },
  });
}
