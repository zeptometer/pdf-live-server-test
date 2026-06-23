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
  
  const serverProcess = cp.spawn('node', ['--import', 'tsx', 'server/index.ts', '-p', '8089', '--tailscale', 'dummy.pdf'], {
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
      
      // Check if it printed the URL
      const hasUrl = stdoutData.includes('https://mock-test.tailnet.ts.net:8089');
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

test('Server exits gracefully with an error message when port is already in use', async () => {
  // 1. Create a dummy server listening on port 8090 to simulate an existing process
  const net = require('net');
  const dummyServer = net.createServer();
  
  await new Promise<void>((resolve, reject) => {
    dummyServer.listen(8090, '0.0.0.0', () => resolve());
    dummyServer.on('error', reject);
  });

  try {
    // 2. Try to start pdf-live-server on the same port
    const serverProcess = cp.spawn('node', ['--import', 'tsx', 'server/index.ts', '-p', '8090', 'dummy.pdf'], {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
    });

    let stderrData = '';
    serverProcess.stderr?.on('data', (data) => {
      stderrData += data.toString();
    });

    // 3. Wait for the process to exit
    const exitCode = await new Promise<number | null>((resolve) => {
      serverProcess.on('exit', (code) => resolve(code));
    });

    // 4. Assert that it exited with code 1 and printed the friendly error message
    expect(exitCode).toBe(1);
    expect(stderrData).toContain('Error: Port 8090 is already in use');
    expect(stderrData).toContain('another instance of pdf-live-server is already running');
  } finally {
    // 5. Clean up the dummy server
    await new Promise<void>((resolve) => dummyServer.close(() => resolve()));
  }
});
