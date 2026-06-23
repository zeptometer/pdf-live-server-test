import express from 'express';
import chokidar from 'chokidar';
import cors from 'cors';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';

let targetPdf = '';
let port = 8080;
let useTailscale = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-p' && i + 1 < args.length) {
    port = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '-t' || args[i] === '--tailscale') {
    useTailscale = true;
  } else if (!targetPdf) {
    targetPdf = args[i];
  }
}

if (!targetPdf) {
  console.error('Usage: npx tsx server/index.ts [-p <port>] [-t|--tailscale] <path_to_pdf>');
  process.exit(1);
}

const absolutePdfPath = resolve(process.cwd(), targetPdf);

if (!existsSync(absolutePdfPath)) {
  console.error(`Target PDF not found: ${absolutePdfPath}`);
  process.exit(1);
}

const app = express();

app.use(cors());

// 開発時は Vite がフロントエンドを配信し、APIをプロキシします。
// 本番ビルド用のフォールバックとして静的ファイルの配信も設定しておきます。
app.use(express.static(resolve(__dirname, '../dist/client')));

app.get('/target.pdf', (req, res) => {
  res.sendFile(absolutePdfPath);
});

// SSE endpoint
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // クライアントとの接続を維持するための初期データ
  res.write('data: {"type":"connected"}\n\n');

  let debounceTimer: NodeJS.Timeout;

  const { dirname, basename } = require('path');
  const dir = dirname(absolutePdfPath);
  const file = basename(absolutePdfPath);

  const watcher = chokidar.watch(dir, {
    persistent: true,
    usePolling: true,
    interval: 100,
    depth: 0,
    ignoreInitial: true,
  });

  watcher.on('all', (event, path) => {
    if (basename(path) === file && (event === 'add' || event === 'change' || event === 'unlink')) {
      console.log(`Chokidar event: ${event} on ${path}`);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('PDF updated, sending reload event...');
        res.write('data: {"type":"reload"}\n\n');
      }, 500); // 500ms debounce
    }
  });

  req.on('close', () => {
    watcher.close();
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`PDF Live Server listening on http://localhost:${port}`);
  console.log(`Watching PDF: ${absolutePdfPath}`);

  if (useTailscale) {
    console.log('Configuring Tailscale serve...');
    exec(`tailscale serve --bg http://127.0.0.1:${port}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Failed to configure Tailscale serve:', error.message);
        return;
      }
      if (stderr) {
        console.error('Tailscale serve stderr:', stderr);
      }
      
      exec('tailscale status --json', (err2, stdout2) => {
        if (!err2) {
          try {
            const status = JSON.parse(stdout2);
            let dnsName = status.Self?.DNSName;
            if (dnsName) {
              if (dnsName.endsWith('.')) dnsName = dnsName.slice(0, -1);
              console.log('✅ Tailscale serve configured successfully!');
              console.log(`\n🎉 Public URL (Tailscale): https://${dnsName}\n`);
              return;
            }
          } catch (e) {
            // ignore JSON parse error
          }
        }
        console.log('✅ Tailscale serve configured successfully!');
      });
    });
  }
});
