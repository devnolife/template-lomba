// @ts-check
const vscode = require('vscode');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const url = require('url');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTENSION_ID = 'codingContestMonitor';
const OUTPUT_CHANNEL_NAME = 'Contest Monitor';

const EVENT_TYPES = /** @type {const} */ ({
  PASTE: 'paste',
  TYPING: 'typing',
  FILE_CHANGE: 'file_change',
  FILE_OP: 'file_operation',
  WINDOW_BLUR: 'window_blur',
  CLIPBOARD: 'clipboard',
});

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * SHA-256 hash of a string, returned as hex.
 * @param {string} text
 * @returns {string}
 */
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Resolve the server URL from env var or settings (env var takes priority).
 * @returns {string}
 */
function getServerUrl() {
  const fromEnv = process.env.CONTEST_MONITOR_SERVER_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  const fromSettings = config.get('serverUrl', '');
  return fromSettings.replace(/\/+$/, '');
}

/**
 * Read a numeric config value.
 * @param {string} key
 * @param {number} fallback
 * @returns {number}
 */
function getConfigNumber(key, fallback) {
  return vscode.workspace.getConfiguration(EXTENSION_ID).get(key, fallback);
}

/**
 * Read a boolean config value.
 * @param {string} key
 * @param {boolean} fallback
 * @returns {boolean}
 */
function getConfigBool(key, fallback) {
  return vscode.workspace.getConfiguration(EXTENSION_ID).get(key, fallback);
}

/**
 * Sleep helper.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// EventQueue – queues events and uploads in batches
// ---------------------------------------------------------------------------

class EventQueue {
  /**
   * @param {vscode.OutputChannel} channel
   */
  constructor(channel) {
    /** @type {Array<object>} */
    this._queue = [];
    /** @type {Array<{timestamp:number, interval:number}>} */
    this._typingPattern = [];
    this._channel = channel;
    /** @type {NodeJS.Timeout | undefined} */
    this._timer = undefined;
    this._uploading = false;
    this._retryCount = 0;
    this._maxRetries = 3;
  }

  /** Start the periodic upload timer. */
  start() {
    const intervalSec = getConfigNumber('uploadInterval', 30);
    this._timer = setInterval(() => this.flush(), intervalSec * 1000);
    this._channel.appendLine(
      `[EventQueue] Upload timer started – every ${intervalSec}s`,
    );
  }

  /** Stop the periodic upload timer. */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = undefined;
    }
  }

  /**
   * Push an event onto the queue.
   * @param {object} event
   */
  push(event) {
    this._queue.push(event);
  }

  /**
   * Record a typing interval for WPM analysis.
   * @param {number} timestamp
   * @param {number} interval
   */
  recordTypingInterval(timestamp, interval) {
    this._typingPattern.push({ timestamp, interval });
    // Keep a rolling window of 5000 entries to avoid unbounded growth.
    if (this._typingPattern.length > 5000) {
      this._typingPattern = this._typingPattern.slice(-4000);
    }
  }

  /**
   * Immediately flush queued events to the server.
   */
  async flush() {
    if (this._uploading) return;
    if (this._queue.length === 0 && this._typingPattern.length === 0) return;

    const serverUrl = getServerUrl();
    if (!serverUrl) {
      this._channel.appendLine(
        '[EventQueue] No server URL configured – events buffered locally.',
      );
      return;
    }

    this._uploading = true;
    const batchSize = getConfigNumber('batchSize', 100);

    // Drain up to batchSize events.
    const batch = this._queue.splice(0, batchSize);
    // Snapshot typing pattern and clear.
    const patternSnapshot = this._typingPattern.splice(0);

    const participant = {
      machineId: vscode.env.machineId,
      workspace:
        vscode.workspace.name ||
        vscode.workspace.workspaceFolders?.[0]?.name ||
        'unknown',
      sessionId: vscode.env.sessionId,
    };

    const payload = JSON.stringify({
      events: batch,
      typingPattern: patternSnapshot,
      participant,
    });

    this._retryCount = 0;
    let success = false;

    while (this._retryCount <= this._maxRetries && !success) {
      try {
        await this._post(`${serverUrl}/api/events`, payload);
        this._channel.appendLine(
          `[EventQueue] Uploaded ${batch.length} events, ${patternSnapshot.length} typing samples.`,
        );
        success = true;
      } catch (err) {
        this._retryCount++;
        const message = err instanceof Error ? err.message : String(err);
        this._channel.appendLine(
          `[EventQueue] Upload failed (attempt ${this._retryCount}/${this._maxRetries}): ${message}`,
        );
        if (this._retryCount <= this._maxRetries) {
          const backoff = Math.pow(2, this._retryCount) * 1000;
          await sleep(backoff);
        }
      }
    }

    if (!success) {
      // Put events back at the front of the queue so they are retried next
      // flush cycle.
      this._queue.unshift(...batch);
      this._typingPattern.unshift(...patternSnapshot);
      this._channel.appendLine(
        '[EventQueue] Events re-queued for next upload cycle.',
      );
    }

    this._uploading = false;
  }

  /**
   * Low-level POST using Node built-ins (no external deps).
   * @param {string} endpoint
   * @param {string} body
   * @returns {Promise<void>}
   */
  _post(endpoint, body) {
    return new Promise((resolve, reject) => {
      try {
        const parsed = new url.URL(endpoint);
        const transport = parsed.protocol === 'https:' ? https : http;

        const options = {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 15000,
        };

        const req = transport.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              resolve();
            } else {
              reject(
                new Error(
                  `Server responded with ${res.statusCode}: ${data.slice(0, 200)}`,
                ),
              );
            }
          });
        });

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timed out'));
        });

        req.write(body);
        req.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Number of events currently buffered. */
  get length() {
    return this._queue.length;
  }
}

// ---------------------------------------------------------------------------
// Monitor – orchestrates all tracking logic
// ---------------------------------------------------------------------------

class ContestMonitor {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this._context = context;
    this._channel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
    this._eventQueue = new EventQueue(this._channel);

    /** @type {vscode.Disposable[]} */
    this._disposables = [];

    this._active = false;
    /** @type {vscode.StatusBarItem | undefined} */
    this._statusBarItem = undefined;

    // Typing analysis state
    this._lastKeystrokeTime = 0;
    /** @type {Map<string, number>} maps documentUri -> last change timestamp */
    this._lastChangeTimestamps = new Map();

    // Window focus state
    this._windowFocused = true;
    this._lastBlurTime = 0;
    /** @type {NodeJS.Timeout | undefined} */
    this._unfocusTimer = undefined;

    // Clipboard state
    this._lastClipboardHash = '';
    /** @type {NodeJS.Timeout | undefined} */
    this._clipboardPollTimer = undefined;
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  start() {
    if (this._active) return;
    this._active = true;
    this._channel.appendLine(
      `[Monitor] Started at ${new Date().toISOString()}`,
    );

    this._registerDocumentChangeTracking();
    this._registerTypingTracking();
    this._registerFileOperationTracking();
    this._registerWindowStateTracking();
    this._startClipboardPolling();
    this._createStatusBar();

    this._eventQueue.start();
    this._updateStatusBar();
  }

  stop() {
    if (!this._active) return;
    this._active = false;
    this._channel.appendLine(
      `[Monitor] Stopped at ${new Date().toISOString()}`,
    );

    for (const d of this._disposables) d.dispose();
    this._disposables = [];

    this._eventQueue.stop();
    this._stopClipboardPolling();
    this._stopUnfocusTimer();

    if (this._statusBarItem) {
      this._statusBarItem.hide();
    }
  }

  async dispose() {
    this.stop();
    // Flush remaining events before shutdown.
    try {
      await this._eventQueue.flush();
    } catch {
      // best-effort
    }
    this._channel.dispose();
    if (this._statusBarItem) this._statusBarItem.dispose();
  }

  // -----------------------------------------------------------------------
  // Event creation helper
  // -----------------------------------------------------------------------

  /**
   * Build a standardised event object and enqueue it.
   * @param {string} type
   * @param {object} data
   */
  _emit(type, data) {
    const event = {
      type,
      timestamp: Date.now(),
      data,
      userId: vscode.env.machineId,
      workspace:
        vscode.workspace.name ||
        vscode.workspace.workspaceFolders?.[0]?.name ||
        'unknown',
    };
    this._eventQueue.push(event);
    this._channel.appendLine(`[Event] ${type} ${JSON.stringify(data)}`);
  }

  // -----------------------------------------------------------------------
  // 1. Document Changes Tracking (also detects paste-like bursts)
  // -----------------------------------------------------------------------

  _registerDocumentChangeTracking() {
    const disposable = vscode.workspace.onDidChangeTextDocument((e) => {
      try {
        if (!this._active) return;
        // Ignore output / debug channels.
        if (e.document.uri.scheme !== 'file') return;

        const now = Date.now();
        const fileName = vscode.workspace.asRelativePath(e.document.uri);

        for (const change of e.contentChanges) {
          const insertedLength = change.text.length;
          const deletedLength = change.rangeLength;

          // --- Detect large pastes ---
          const pasteThreshold = getConfigNumber('pasteThreshold', 50);
          if (insertedLength > pasteThreshold) {
            const lastTs =
              this._lastChangeTimestamps.get(e.document.uri.toString()) || 0;
            const elapsed = now - lastTs;

            // A burst of >50 chars in <100ms is almost certainly a paste.
            if (elapsed < 100 || insertedLength > pasteThreshold) {
              this._emit(EVENT_TYPES.PASTE, {
                length: insertedLength,
                file: fileName,
                elapsed,
                hash: sha256(change.text),
              });
            }
          }

          // --- General document change event ---
          this._emit(EVENT_TYPES.FILE_CHANGE, {
            file: fileName,
            insertedLength,
            deletedLength,
            lineCount: e.document.lineCount,
          });

          this._lastChangeTimestamps.set(e.document.uri.toString(), now);
        }
      } catch (err) {
        this._logError('onDidChangeTextDocument', err);
      }
    });

    this._disposables.push(disposable);
  }

  // -----------------------------------------------------------------------
  // 2. Typing Pattern Analysis
  // -----------------------------------------------------------------------

  _registerTypingTracking() {
    // VS Code doesn't expose a raw keypress API. The closest proxy is
    // onDidChangeTextDocument with single-character inserts (length === 1 and
    // no range deletion).  We already subscribe to that event above; here we
    // layer on typing-interval analysis by hooking the same event a second
    // time with a lightweight handler.

    const disposable = vscode.workspace.onDidChangeTextDocument((e) => {
      try {
        if (!this._active) return;
        if (e.document.uri.scheme !== 'file') return;

        for (const change of e.contentChanges) {
          // Only consider single-character inserts as "keystrokes".
          if (change.text.length !== 1 || change.rangeLength !== 0) continue;

          const now = Date.now();
          const interval =
            this._lastKeystrokeTime > 0 ? now - this._lastKeystrokeTime : -1;
          this._lastKeystrokeTime = now;

          if (interval > 0) {
            this._eventQueue.recordTypingInterval(now, interval);

            // Flag anomalously fast typing (<50ms between keystrokes).
            if (interval < 50) {
              this._emit(EVENT_TYPES.TYPING, {
                interval,
                anomaly: 'fast_typing',
                file: vscode.workspace.asRelativePath(e.document.uri),
              });
            }
          }
        }
      } catch (err) {
        this._logError('typingTracking', err);
      }
    });

    this._disposables.push(disposable);
  }

  // -----------------------------------------------------------------------
  // 3. File Operations Tracking
  // -----------------------------------------------------------------------

  _registerFileOperationTracking() {
    // File create
    const watcherCreate = vscode.workspace.createFileSystemWatcher(
      '**/*',
      false,
      true,
      true,
    );
    watcherCreate.onDidCreate((uri) => {
      try {
        if (!this._active) return;
        this._emit(EVENT_TYPES.FILE_OP, {
          operation: 'create',
          file: vscode.workspace.asRelativePath(uri),
        });
      } catch (err) {
        this._logError('fileCreate', err);
      }
    });
    this._disposables.push(watcherCreate);

    // File delete
    const watcherDelete = vscode.workspace.createFileSystemWatcher(
      '**/*',
      true,
      true,
      false,
    );
    watcherDelete.onDidDelete((uri) => {
      try {
        if (!this._active) return;
        this._emit(EVENT_TYPES.FILE_OP, {
          operation: 'delete',
          file: vscode.workspace.asRelativePath(uri),
        });
      } catch (err) {
        this._logError('fileDelete', err);
      }
    });
    this._disposables.push(watcherDelete);

    // File rename – VS Code fires delete + create; we also track via the
    // explicit rename API if available (VS Code 1.80+).
    if (vscode.workspace.onDidRenameFiles) {
      const renameDisposable = vscode.workspace.onDidRenameFiles((e) => {
        try {
          if (!this._active) return;
          for (const f of e.files) {
            this._emit(EVENT_TYPES.FILE_OP, {
              operation: 'rename',
              from: vscode.workspace.asRelativePath(f.oldUri),
              to: vscode.workspace.asRelativePath(f.newUri),
            });
          }
        } catch (err) {
          this._logError('fileRename', err);
        }
      });
      this._disposables.push(renameDisposable);
    }

    // File open tracking
    const openDisposable = vscode.workspace.onDidOpenTextDocument((doc) => {
      try {
        if (!this._active) return;
        if (doc.uri.scheme !== 'file') return;
        this._emit(EVENT_TYPES.FILE_OP, {
          operation: 'open',
          file: vscode.workspace.asRelativePath(doc.uri),
        });
      } catch (err) {
        this._logError('fileOpen', err);
      }
    });
    this._disposables.push(openDisposable);
  }

  // -----------------------------------------------------------------------
  // 4. Window State Monitoring
  // -----------------------------------------------------------------------

  _registerWindowStateTracking() {
    const disposable = vscode.window.onDidChangeWindowState((state) => {
      try {
        if (!this._active) return;
        const now = Date.now();

        if (!state.focused) {
          // Window lost focus.
          this._windowFocused = false;
          this._lastBlurTime = now;

          this._emit(EVENT_TYPES.WINDOW_BLUR, {
            focused: false,
          });

          // Start timer to alert if unfocused too long.
          this._startUnfocusTimer();
        } else {
          // Window regained focus.
          const duration =
            this._lastBlurTime > 0 ? now - this._lastBlurTime : 0;
          this._windowFocused = true;

          this._emit(EVENT_TYPES.WINDOW_BLUR, {
            focused: true,
            unfocusedDurationMs: duration,
          });

          this._stopUnfocusTimer();
        }
      } catch (err) {
        this._logError('windowState', err);
      }
    });
    this._disposables.push(disposable);
  }

  _startUnfocusTimer() {
    this._stopUnfocusTimer();
    const alertSec = getConfigNumber('unfocusedAlertSeconds', 120);
    this._unfocusTimer = setTimeout(() => {
      if (!this._windowFocused && this._active) {
        const durationMs = Date.now() - this._lastBlurTime;
        this._emit(EVENT_TYPES.WINDOW_BLUR, {
          focused: false,
          alert: true,
          unfocusedDurationMs: durationMs,
        });
        vscode.window.showWarningMessage(
          `[Contest Monitor] Window unfocused for ${Math.round(durationMs / 1000)}s – this will be logged.`,
        );
      }
    }, alertSec * 1000);
  }

  _stopUnfocusTimer() {
    if (this._unfocusTimer) {
      clearTimeout(this._unfocusTimer);
      this._unfocusTimer = undefined;
    }
  }

  // -----------------------------------------------------------------------
  // 5. Clipboard Monitoring
  // -----------------------------------------------------------------------

  _startClipboardPolling() {
    // VS Code only exposes readText; no push-based change event exists.
    // Poll every 2 seconds to detect clipboard changes.
    this._clipboardPollTimer = setInterval(async () => {
      try {
        if (!this._active) return;
        const text = await vscode.env.clipboard.readText();
        if (!text) return;

        const hash = sha256(text);
        if (hash !== this._lastClipboardHash) {
          const isFirst = this._lastClipboardHash === '';
          this._lastClipboardHash = hash;

          // Skip the very first read (we don't know when it was copied).
          if (!isFirst) {
            this._emit(EVENT_TYPES.CLIPBOARD, {
              hash,
              length: text.length,
              source: this._windowFocused ? 'internal' : 'external',
            });
          }
        }
      } catch (err) {
        // Clipboard read can fail in some sandboxed environments – ignore.
      }
    }, 2000);
  }

  _stopClipboardPolling() {
    if (this._clipboardPollTimer) {
      clearInterval(this._clipboardPollTimer);
      this._clipboardPollTimer = undefined;
    }
  }

  // -----------------------------------------------------------------------
  // Status bar
  // -----------------------------------------------------------------------

  _createStatusBar() {
    if (!getConfigBool('enableStatusBar', true)) return;

    if (!this._statusBarItem) {
      this._statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100,
      );
      this._statusBarItem.command = `${EXTENSION_ID}.status`;
    }
    this._statusBarItem.show();
  }

  _updateStatusBar() {
    if (!this._statusBarItem) return;
    if (this._active) {
      this._statusBarItem.text = '$(eye) Contest Monitor';
      this._statusBarItem.tooltip = `Monitoring active – ${this._eventQueue.length} events buffered`;
      this._statusBarItem.backgroundColor = undefined;
    } else {
      this._statusBarItem.text = '$(eye-closed) Monitor Off';
      this._statusBarItem.tooltip = 'Contest monitoring is paused';
      this._statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground',
      );
    }

    // Keep tooltip fresh.
    if (this._active) {
      setTimeout(() => this._updateStatusBar(), 5000);
    }
  }

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  /**
   * @param {string} source
   * @param {unknown} err
   */
  _logError(source, err) {
    const message = err instanceof Error ? err.message : String(err);
    this._channel.appendLine(`[ERROR] ${source}: ${message}`);
  }

  // -----------------------------------------------------------------------
  // Public getters
  // -----------------------------------------------------------------------

  get isActive() {
    return this._active;
  }

  get bufferedEventCount() {
    return this._eventQueue.length;
  }

  /** Expose flush for the command. */
  async flushEvents() {
    await this._eventQueue.flush();
  }
}

// ---------------------------------------------------------------------------
// Extension entry points
// ---------------------------------------------------------------------------

/** @type {ContestMonitor | undefined} */
let monitor;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const channel = vscode.window.createOutputChannel(
    OUTPUT_CHANNEL_NAME + ' (Init)',
  );
  channel.appendLine(
    `[Init] Coding Contest Monitor activating at ${new Date().toISOString()}`,
  );

  monitor = new ContestMonitor(context);

  // --- Register commands --------------------------------------------------

  context.subscriptions.push(
    vscode.commands.registerCommand(`${EXTENSION_ID}.start`, () => {
      if (monitor && !monitor.isActive) {
        monitor.start();
        vscode.window.showInformationMessage(
          'Contest Monitor: Monitoring started.',
        );
      } else {
        vscode.window.showInformationMessage(
          'Contest Monitor: Already running.',
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(`${EXTENSION_ID}.stop`, () => {
      if (monitor && monitor.isActive) {
        monitor.stop();
        vscode.window.showInformationMessage(
          'Contest Monitor: Monitoring stopped.',
        );
      } else {
        vscode.window.showInformationMessage('Contest Monitor: Not running.');
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(`${EXTENSION_ID}.status`, () => {
      if (!monitor) return;
      const status = monitor.isActive ? 'ACTIVE' : 'STOPPED';
      const serverUrl = getServerUrl() || '(not configured)';
      vscode.window.showInformationMessage(
        `Contest Monitor: ${status} | Buffered events: ${monitor.bufferedEventCount} | Server: ${serverUrl}`,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(`${EXTENSION_ID}.flushEvents`, async () => {
      if (!monitor) return;
      await monitor.flushEvents();
      vscode.window.showInformationMessage('Contest Monitor: Events flushed.');
    }),
  );

  // --- Auto-start if configured ------------------------------------------

  if (getConfigBool('autoStart', true)) {
    monitor.start();
    channel.appendLine('[Init] Auto-start enabled – monitoring is active.');
  }

  // --- Cleanup on deactivation -------------------------------------------

  context.subscriptions.push({
    dispose: () => {
      if (monitor) {
        monitor.dispose();
        monitor = undefined;
      }
    },
  });

  channel.appendLine('[Init] Activation complete.');
}

function deactivate() {
  if (monitor) {
    monitor.dispose();
    monitor = undefined;
  }
}

module.exports = { activate, deactivate };
