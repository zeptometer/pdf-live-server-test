import { test, expect } from '@playwright/test';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

test('Server prints Tailscale URL and QR code when using --tailscale', async () => {
  const dummyPdfPath = path.resolve(process.cwd(), 'dummy.pdf');
  if (!fs.existsSync(dummyPdfPath)) {
    fs.writeFileSync(dummyPdfPath, '');
  }

  // Create a mock tailscale command to avoid real system dependencies
  const mockBinDir = path.resolve(process.cwd(), 'tests', '.mock-bin');
  if (!fs.existsSync(mockBinDir)) {
    fs.mkdirSync(mockBinDir, { recursive: true });
  }

  const mockTailscalePath = path.join(mockBinDir, 'tailscale');
  const mockJsonOutput = JSON.stringify({
    Self: { DNSName: 'mock-test.tailnet.ts.net.' }
  });

  // The mock script checks arguments. If "status --json", print fake json.
  // Otherwise, exit 0.
  const mockScript = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'status' && args[1] === '--json') {
  console.log(JSON.stringify(${mockJsonOutput}));
} else if (args[0] === 'serve') {
  process.exit(0);
}
`;
  fs.writeFileSync(mockTailscalePath, mockScript, { mode: 0o755 });

  // Spawn the server with the mocked PATH
  const env = { ...process.env, PATH: `${mockBinDir}:${process.env.PATH}` };
  
  const serverProcess = cp.spawn('node', ['--import', 'tsx', 'server/index.ts', '--tailscale', 'dummy.pdf'], {
    env,
    cwd: process.cwd(),
    detached: true,
  });

  let stdoutData = '';
  
  const outputContainsQR = await new Promise<boolean>((resolve) => {
    // Timeout to ensure the test doesn't hang forever
    const timeout = setTimeout(() => {
      resolve(false);
    }, 10000);

    serverProcess.stdout.on('data', (data) => {
      const text = data.toString();
      stdoutData += text;
      
      // Check if it printed the URL (default HTTPS port is usually hidden or 443)
      const hasUrl = stdoutData.includes('https://mock-test.tailnet.ts.net');
      // Check if it printed QR code blocks (e.g., ▄ or █)
      const hasQrBlocks = stdoutData.includes('▄') || stdoutData.includes('█');
      
      if (hasUrl && hasQrBlocks) {
        clearTimeout(timeout);
        resolve(true);
      }
    });
  });

  // Cleanup
  if (serverProcess.pid) {
    try {
      process.kill(-serverProcess.pid, 'SIGKILL');
    } catch (e) {}
  }
  fs.rmSync(mockBinDir, { recursive: true, force: true });

  // Assertions
  expect(outputContainsQR).toBe(true);
});

test('Server falls back to another port when default 8080 is in use', async () => {
  // 1. Create a dummy server listening on port 8080 to simulate an existing process
  const net = require('net');
  const dummyServer = net.createServer();
  
  await new Promise<void>((resolve) => {
    dummyServer.on('error', (err: any) => {
      // Ignore if already taken (e.g. by Playwright webServer)
      if (err.code === 'EADDRINUSE') resolve();
    });
    dummyServer.listen(8080, '0.0.0.0', () => resolve());
  });

  try {
    // 2. Try to start pdf-live-server (should fallback from 8080 to another port)
    const serverProcess = cp.spawn('node', ['--import', 'tsx', 'server/index.ts', 'dummy.pdf'], {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
    });

    let stdoutData = '';
    
    const fallbackSuccess = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 10000);

      serverProcess.stdout?.on('data', (data) => {
        stdoutData += data.toString();
        // Check if it successfully started on a DIFFERENT port
        const matches = [...stdoutData.matchAll(/http:\/\/localhost:(\d+)/g)];
        for (const match of matches) {
          if (match[1] !== '8080') {
            clearTimeout(timeout);
            resolve(true);
          }
        }
      });
    });

    if (serverProcess.pid) {
      try {
        process.kill(-serverProcess.pid, 'SIGKILL');
      } catch (e) {}
    }

    // 4. Assert that it successfully found another port
    expect(fallbackSuccess).toBe(true);
    expect(stdoutData).not.toContain('already in use');
  } finally {
    // 5. Clean up the dummy server
    await new Promise<void>((resolve) => dummyServer.close(() => resolve()));
  }
});

test('Server exits with error if --ngrok and --tailscale are both specified', async () => {
  const serverProcess = cp.spawn('node', ['--import', 'tsx', 'server/index.ts', '--tailscale', '--ngrok', 'dummy.pdf']);
  
  let stderrData = '';
  serverProcess.stderr?.on('data', (data) => {
    stderrData += data.toString();
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    serverProcess.on('exit', (code) => {
      resolve(code);
    });
  });

  expect(exitCode).not.toBe(0);
  expect(stderrData).toContain('Cannot use both --tailscale and --ngrok');
});

test('Server exits with error if --ngrok is used without NGROK_AUTHTOKEN', async () => {
  // Ensure NGROK_AUTHTOKEN is unset for this test
  const env = { ...process.env };
  delete env.NGROK_AUTHTOKEN;
  // Isolate OS config paths so it doesn't accidentally find the real ngrok config on the host
  env.HOME = '/tmp/empty-home-for-test';
  env.USERPROFILE = '/tmp/empty-home-for-test';
  env.LOCALAPPDATA = '/tmp/empty-home-for-test';

  const serverProcess = cp.spawn('node', ['--import', 'tsx', 'server/index.ts', '--ngrok', 'dummy.pdf'], { env });
  
  let stderrData = '';
  serverProcess.stderr?.on('data', (data) => {
    stderrData += data.toString();
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    serverProcess.on('exit', (code) => {
      resolve(code);
    });
  });

  expect(exitCode).not.toBe(0);
  expect(stderrData).toContain('ngrok session is not authenticated');
  expect(stderrData).toContain('ngrok config add-authtoken');
});

