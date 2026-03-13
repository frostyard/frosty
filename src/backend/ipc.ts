import { createServer, type Socket } from "node:net";
import { unlinkSync } from "node:fs";
import {
  isClientMessage,
  type ClientMessage,
  type ServerMessage,
} from "./ipc-types.js";

export type SendFn = (msg: ServerMessage) => void;
export type MessageHandler = (msg: ClientMessage, send: SendFn) => Promise<void>;

export interface IPCServer {
  socketPath: string;
  close: () => Promise<void>;
}

export async function createIPCServer(
  socketPath: string,
  onMessage: MessageHandler,
): Promise<IPCServer> {
  // Clean up stale socket file
  try {
    unlinkSync(socketPath);
  } catch {
    // Doesn't exist, fine
  }

  const server = createServer((socket: Socket) => {
    let buffer = "";

    const send: SendFn = (msg) => {
      socket.write(JSON.stringify(msg) + "\n");
    };

    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.length === 0) continue;

        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue; // Skip malformed JSON
        }

        if (isClientMessage(parsed)) {
          onMessage(parsed, send).catch((err) => {
            send({ type: "error", message: String(err) });
          });
        }
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(socketPath, () => {
      resolve({
        socketPath,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => {
              try {
                unlinkSync(socketPath);
              } catch {
                // Already gone
              }
              res();
            });
          }),
      });
    });
  });
}
