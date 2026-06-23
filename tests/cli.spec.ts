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
  
  const serverProcess = cp.spawn('npx', ['tsx', 'server/index.ts', '-p', '8082', '--tailscale', 'dummy.pdf'], {
    env,
    cwd: process.cwd()
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
  serverProcess.kill('SIGKILL');
  fs.rmSync(mockBinDir, { recursive: true, force: true });

  // Assertions
  expect(outputContainsQR).toBe(true);
});
