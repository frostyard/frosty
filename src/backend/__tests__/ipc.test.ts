import { describe, it, expect, afterEach } from "vitest";
import { createIPCServer } from "../ipc.js";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ClientMessage, ServerMessage } from "../ipc-types.js";

function tmpSocket(): string {
  return join(tmpdir(), `frosty-test-${randomUUID()}.sock`);
}

function connectAndSend(
  socketPath: string,
  msg: ClientMessage,
): Promise<ServerMessage[]> {
  return new Promise((resolve, reject) => {
    const client = connect(socketPath, () => {
      client.write(JSON.stringify(msg) + "\n");
    });

    const chunks: string[] = [];
    client.on("data", (data) => chunks.push(data.toString()));
    client.on("error", reject);

    // Give the server time to respond, then close
    setTimeout(() => {
      client.end();
      const messages = chunks
        .join("")
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as ServerMessage);
      resolve(messages);
    }, 200);
  });
}

describe("IPC Server", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = undefined;
    }
  });

  it("receives a client message and sends a response", async () => {
    const socketPath = tmpSocket();
    const received: ClientMessage[] = [];

    const server = await createIPCServer(socketPath, async (msg, send) => {
      received.push(msg);
      send({ type: "text", delta: "got it" });
    });
    cleanup = server.close;

    const responses = await connectAndSend(socketPath, {
      type: "message",
      text: "hello",
      sessionId: "s1",
    });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("message");
    expect(responses).toHaveLength(1);
    expect(responses[0]).toEqual({ type: "text", delta: "got it" });
  });

  it("ignores invalid JSON lines", async () => {
    const socketPath = tmpSocket();
    const received: ClientMessage[] = [];

    const server = await createIPCServer(socketPath, async (msg, send) => {
      received.push(msg);
    });
    cleanup = server.close;

    await new Promise<void>((resolve) => {
      const client = connect(socketPath, () => {
        client.write("not json\n");
        client.write('{"type":"unknown"}\n');
        setTimeout(() => {
          client.end();
          resolve();
        }, 100);
      });
    });

    expect(received).toHaveLength(0);
  });
});
