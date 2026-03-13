import GLib from "gi://GLib";
import Gio from "gi://Gio";

/**
 * IPC client that connects to the Frosty backend over a Unix socket.
 */
export class IPCClient {
  constructor(callbacks) {
    this._callbacks = callbacks;
    this._connection = null;
    this._outputStream = null;
    this._reading = false;
  }

  /**
   * Connect to the backend socket with retry logic.
   * @param {string} socketPath
   * @param {number} maxRetries
   * @param {number} intervalMs
   * @returns {Promise<boolean>}
   */
  async connect(socketPath, maxRetries = 50, intervalMs = 100) {
    const client = new Gio.SocketClient();
    const address = Gio.UnixSocketAddress.new(socketPath);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        log(`IPC: connect attempt ${attempt + 1} to ${socketPath}`);
        this._connection = await client.connect_async(address, null);
        log(`IPC: connected!`);
        this._outputStream = this._connection.get_output_stream();
        this._startReading();
        return true;
      } catch (e) {
        log(`IPC: attempt ${attempt + 1} failed: ${e.message}`);
        await this._sleep(intervalMs);
      }
    }

    return false;
  }

  _sleep(ms) {
    return new Promise((resolve) =>
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
      }),
    );
  }

  /**
   * Send a message to the backend.
   * @param {object} msg
   */
  send(msg) {
    if (!this._outputStream) return;
    const line = JSON.stringify(msg) + "\n";
    const bytes = new GLib.Bytes(new TextEncoder().encode(line));
    this._outputStream.write_bytes_async(bytes, GLib.PRIORITY_DEFAULT, null)
      .catch((err) => log(`IPC send error: ${err.message}`));
  }

  _startReading() {
    if (this._reading || !this._connection) return;
    this._reading = true;

    const inputStream = new Gio.DataInputStream({
      base_stream: this._connection.get_input_stream(),
      close_base_stream: true,
    });

    this._readLoop(inputStream);
  }

  async _readLoop(stream) {
    log("IPC: read loop started");
    while (this._reading) {
      try {
        const [line] = await stream.read_line_async(GLib.PRIORITY_DEFAULT, null);

        if (line === null) {
          this._reading = false;
          this._callbacks.onDisconnect?.();
          return;
        }

        const text = typeof line === "string" ? line : new TextDecoder().decode(line);
        if (text.length === 0) continue;

        let msg;
        try {
          msg = JSON.parse(text);
        } catch {
          continue;
        }

        this._dispatch(msg);
      } catch (err) {
        log(`IPC read error: ${err.message}`);
        this._reading = false;
        this._callbacks.onDisconnect?.();
        return;
      }
    }
  }

  _dispatch(msg) {
    switch (msg.type) {
      case "text":
        this._callbacks.onText?.(msg);
        break;
      case "tool.request":
        this._callbacks.onToolRequest?.(msg);
        break;
      case "tool.running":
        this._callbacks.onToolRunning?.(msg);
        break;
      case "tool.output":
        this._callbacks.onToolOutput?.(msg);
        break;
      case "tool.done":
        this._callbacks.onToolDone?.(msg);
        break;
      case "error":
        this._callbacks.onError?.(msg);
        break;
    }
  }

  disconnect() {
    this._reading = false;
    if (this._connection) {
      this._connection.close(null);
      this._connection = null;
    }
  }
}
