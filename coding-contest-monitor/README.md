# Coding Contest Monitor

VS Code extension untuk memonitor aktivitas coding selama lomba programming. Extension ini melacak typing pattern, paste events, file operations, dan window focus untuk memastikan fair play.

## Fitur

| Fitur                       | Deskripsi                                                      |
| --------------------------- | -------------------------------------------------------------- |
| **Copy-Paste Detection**    | Mendeteksi paste >50 karakter, log waktu dan panjang text      |
| **Typing Pattern Analysis** | Track keystroke interval, deteksi anomali (<50ms), hitung WPM  |
| **Document Changes**        | Monitor perubahan file, deteksi burst edit mendadak            |
| **File Operations**         | Track create, delete, rename, dan open file                    |
| **Window Focus**            | Deteksi switch ke aplikasi lain, alert jika unfocused >2 menit |
| **Clipboard Monitoring**    | Track perubahan clipboard (hash only, bukan content)           |

## Privacy

- **Tidak menyimpan source code** -- hanya metadata dan hash SHA-256.
- User ID menggunakan `vscode.env.machineId` (anonymized).
- Clipboard content di-hash, bukan disimpan mentah.

## Instalasi

### Dari VSIX (untuk distribusi ke peserta lomba)

1. Build VSIX package:

```bash
cd coding-contest-monitor
npm install -g @vscode/vsce
vsce package
```

2. Install di VS Code peserta:

```bash
code --install-extension coding-contest-monitor-1.0.0.vsix
```

Atau melalui UI: `Extensions` > `...` > `Install from VSIX...`

### Dari source (development)

```bash
cd coding-contest-monitor
# Buka folder ini di VS Code
code .
# Tekan F5 untuk launch Extension Development Host
```

## Konfigurasi

### Melalui environment variable

```bash
# Set sebelum menjalankan VS Code
export CONTEST_MONITOR_SERVER_URL=https://your-server.com

# Windows
set CONTEST_MONITOR_SERVER_URL=https://your-server.com
```

### Melalui settings.json

```json
{
  "codingContestMonitor.serverUrl": "https://your-server.com",
  "codingContestMonitor.uploadInterval": 30,
  "codingContestMonitor.batchSize": 100,
  "codingContestMonitor.pasteThreshold": 50,
  "codingContestMonitor.unfocusedAlertSeconds": 120,
  "codingContestMonitor.autoStart": true,
  "codingContestMonitor.enableStatusBar": true
}
```

| Setting                 | Default | Deskripsi                                 |
| ----------------------- | ------- | ----------------------------------------- |
| `serverUrl`             | `""`    | URL server untuk upload events            |
| `uploadInterval`        | `30`    | Interval upload dalam detik (5-300)       |
| `batchSize`             | `100`   | Max events per upload batch (10-500)      |
| `pasteThreshold`        | `50`    | Min karakter untuk flag paste (10+)       |
| `unfocusedAlertSeconds` | `120`   | Detik unfocused sebelum alert (30+)       |
| `autoStart`             | `true`  | Auto-start monitoring saat VS Code dibuka |
| `enableStatusBar`       | `true`  | Tampilkan status di status bar            |

## Commands

Buka Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command                             | Deskripsi                                   |
| ----------------------------------- | ------------------------------------------- |
| `Contest Monitor: Start Monitoring` | Mulai monitoring                            |
| `Contest Monitor: Stop Monitoring`  | Stop monitoring                             |
| `Contest Monitor: Show Status`      | Tampilkan status dan jumlah buffered events |
| `Contest Monitor: Flush Events Now` | Upload buffered events segera               |

## API Endpoint

Extension mengirim data ke `POST ${SERVER_URL}/api/events` dengan format:

```json
{
  "events": [
    {
      "type": "paste",
      "timestamp": 1700000000000,
      "data": {
        "length": 150,
        "file": "src/solution.js",
        "elapsed": 50,
        "hash": "a1b2c3..."
      },
      "userId": "machine-id-hash",
      "workspace": "contest-workspace"
    }
  ],
  "typingPattern": [
    { "timestamp": 1700000000000, "interval": 120 },
    { "timestamp": 1700000000120, "interval": 85 }
  ],
  "participant": {
    "machineId": "machine-id-hash",
    "workspace": "contest-workspace",
    "sessionId": "session-id"
  }
}
```

### Event Types

| Type             | Deskripsi           | Data Fields                                            |
| ---------------- | ------------------- | ------------------------------------------------------ |
| `paste`          | Paste terdeteksi    | `length`, `file`, `elapsed`, `hash`                    |
| `typing`         | Anomali typing      | `interval`, `anomaly`, `file`                          |
| `file_change`    | Perubahan dokumen   | `file`, `insertedLength`, `deletedLength`, `lineCount` |
| `file_operation` | Operasi file        | `operation`, `file`, `from`, `to`                      |
| `window_blur`    | Focus/blur window   | `focused`, `unfocusedDurationMs`, `alert`              |
| `clipboard`      | Perubahan clipboard | `hash`, `length`, `source`                             |

## Untuk Panitia: Setup Server

Server harus menyediakan endpoint `POST /api/events` yang menerima JSON body sesuai format di atas. Contoh minimal dengan Express:

```javascript
const express = require('express');
const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/api/events', (req, res) => {
  const { events, typingPattern, participant } = req.body;
  // Simpan ke database
  console.log(`Received ${events.length} events from ${participant.machineId}`);
  res.json({ ok: true });
});

app.listen(3000);
```

## Error Handling

- Semua async operations dibungkus try-catch.
- Error di-log ke Output Channel "Contest Monitor".
- Extension tidak crash jika server down -- events di-queue dan retry.
- Retry: 3x dengan exponential backoff (2s, 4s, 8s).
- Jika semua retry gagal, events dikembalikan ke queue untuk cycle berikutnya.

## Troubleshooting

1. **Events tidak terupload**: Cek Output Channel (`View > Output > Contest Monitor`) untuk error messages.
2. **Server URL tidak terdeteksi**: Pastikan environment variable `CONTEST_MONITOR_SERVER_URL` ter-set atau `codingContestMonitor.serverUrl` di settings.json.
3. **Extension tidak aktif**: Jalankan command `Contest Monitor: Start Monitoring` dari Command Palette.
