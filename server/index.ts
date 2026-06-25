import express from 'express';
import chokidar from 'chokidar';
import cors from 'cors';
import qrcode from 'qrcode-terminal';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';

let targetPdf = '';
let useTailscale = false;
let useNgrok = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-t' || args[i] === '--tailscale') {
    useTailscale = true;
  } else if (args[i] === '-n' || args[i] === '--ngrok') {
    useNgrok = true;
  } else if (!targetPdf) {
    targetPdf = args[i];
  }
}

if (useTailscale && useNgrok) {
  console.error('❌ Error: Cannot use both --tailscale and --ngrok at the same time.');
  process.exit(1);
}

if (useNgrok && !process.env.NGROK_AUTHTOKEN) {
  console.error('❌ Error: NGROK_AUTHTOKEN is not set.');
  console.error('To use the --ngrok option, you must sign up at https://dashboard.ngrok.com');
  console.error('and set your authtoken as an environment variable:');
  console.error('export NGROK_AUTHTOKEN="your_auth_token_here"');
  process.exit(1);
}

if (!targetPdf) {
  console.error('Usage: npx tsx server/index.ts [-t|--tailscale] [-n|--ngrok] <path_to_pdf>');
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

function startTailscale(localPort: number, tsPort: number = 443) {
  console.log(`Configuring Tailscale serve on port ${tsPort}...`);
  exec(`tailscale serve --bg --https ${tsPort} http://127.0.0.1:${localPort}`, (error, stdout, stderr) => {
    if (error || (stderr && stderr.includes('in use'))) {
      if (tsPort === 443 || (error && error.message.includes('in use')) || (stderr && stderr.includes('in use'))) {
        const nextPort = Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
        console.warn(`⚠️ Tailscale port ${tsPort} might be in use or failed. Retrying with random port ${nextPort}...`);
        startTailscale(localPort, nextPort);
        return;
      }
      console.error('Failed to configure Tailscale serve:', error?.message || stderr);
      return;
    }
    console.log('✅ Tailscale serve configured successfully!');

    exec('tailscale status --json', (statusError, statusStdout) => {
      if (statusError) {
        console.error('Failed to get Tailscale status:', statusError.message);
        return;
      }
      try {
        const status = JSON.parse(statusStdout);
        const dnsName = status.Self?.DNSName?.replace(/\.$/, '');
        if (dnsName) {
          const publicUrl = `https://${dnsName}${tsPort === 443 ? '' : ':' + tsPort}`;
          console.log(`🎉 Public URL (Tailscale): ${publicUrl}`);
          qrcode.generate(publicUrl, { small: true });
        }
      } catch (parseError) {
        console.error('Failed to parse Tailscale status JSON:', parseError);
      }
    });
  });
}

async function startNgrok(localPort: number) {
  console.log('Configuring ngrok serve...');
  try {
    const ngrok = await import('@ngrok/ngrok');
    const listener = await ngrok.connect({ addr: localPort, authtoken_from_env: true });
    const publicUrl = listener.url();
    if (publicUrl) {
      console.log(`🎉 Public URL (ngrok): ${publicUrl}`);
      qrcode.generate(publicUrl, { small: true });
    }
  } catch (error: any) {
    console.error('❌ Failed to configure ngrok serve:', error?.message || error);
  }
}

function startServer(targetPort: number) {
  const server = app.listen(targetPort, '0.0.0.0', () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : targetPort;
    console.log(`PDF Live Server listening on http://localhost:${actualPort}`);
    console.log(`Watching PDF: ${absolutePdfPath}`);

    if (useTailscale) {
      startTailscale(actualPort, 443);
    } else if (useNgrok) {
      startNgrok(actualPort);
    }
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      if (targetPort !== 0) {
        console.warn(`\n⚠️ Port ${targetPort} is in use. Falling back to a random available port...`);
        startServer(0);
      } else {
        console.error(`\n❌ Failed to bind to any port.`);
        process.exit(1);
      }
    } else {
      console.error(`\n❌ Server error:`, err);
      process.exit(1);
    }
  });
}

startServer(8080);
