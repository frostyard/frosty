import { join } from "node:path";
import { createIPCServer } from "./ipc.js";
import {
  handleUserMessage,
  resolveConfirmation,
  clearConfirmations,
} from "./agent.js";
import type { ClientMessage } from "./ipc-types.js";
import type { SendFn } from "./ipc.js";

const socketPath = join(
  process.env.XDG_RUNTIME_DIR || "/tmp",
  "frosty.sock",
);

async function handleMessage(
  msg: ClientMessage,
  send: SendFn,
): Promise<void> {
  switch (msg.type) {
    case "message":
      await handleUserMessage(msg.text, send);
      break;

    case "confirm":
      resolveConfirmation(msg.toolCallId, msg.approved);
      break;

    case "cancel":
      resolveConfirmation(msg.toolCallId, false);
      break;

    case "session.new":
      clearConfirmations();
      break;

    case "session.load":
      clearConfirmations();
      break;
  }
}

async function main(): Promise<void> {
  const server = await createIPCServer(socketPath, handleMessage);
  console.log(`Frosty backend listening on ${server.socketPath}`);

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Frosty backend failed to start:", err);
  process.exit(1);
});
