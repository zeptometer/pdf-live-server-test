#!/usr/bin/env node

/**
 * livepdf-server
 * Serve a local PDF over HTTP and auto-reload it in the browser when updated.
 *
 * @author Yuito Murase <https://github.com/zeptometer>
 */

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import cli from './utils/cli.js';
import init from './utils/init.js';
import log from './utils/log.js';

const { flags, input, showHelp } = cli;
const { clear, debug, port, host } = flags;

(async () => {
	await init({ clear });
	if (input.includes(`help`)) showHelp(0);

	const pdfPath = input[0];
	if (!pdfPath) {
		console.error('Please provide a path to a PDF file.');
		showHelp(1);
	}

	const absolutePdfPath = path.resolve(pdfPath);
	if (!fs.existsSync(absolutePdfPath)) {
		console.error(`File not found: ${absolutePdfPath}`);
		process.exit(1);
	}

	debug && log(flags);

	const app = express();

	app.get('/', (req, res) => {
		res.send(`<!DOCTYPE html>
<html lang="en">
<meta charset="utf-8" />
<title>livepdf-server</title>
<style>html,body{height:100%;margin:0}#viewer{height:100%;overflow:auto}</style>
<div id="viewer"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.269/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.269/pdf.worker.min.js';

const viewer = document.getElementById('viewer');
let scrollPos = 0;

function render(url) {
  pdfjsLib.getDocument(url).promise.then(doc => {
    viewer.innerHTML = '';
    const num = doc.numPages;
    const renderPage = n => {
      doc.getPage(n).then(page => {
        const canvas = document.createElement('canvas');
        viewer.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        page.render({ canvasContext: ctx, viewport }).promise.then(() => {
          if (n < num) renderPage(n + 1);
        });
      });
    };
    renderPage(1);
    viewer.scrollTop = scrollPos;
  });
}

render('/pdf');

const ws = new WebSocket('ws://' + location.host);
ws.onmessage = ev => {
  if (ev.data === 'reload') {
    scrollPos = viewer.scrollTop;
    render('/pdf?' + Date.now());
  }
};
</script>`);
	});

	app.get('/pdf', (req, res) => {
		res.sendFile(absolutePdfPath);
	});

	const server = app.listen(port, host, () => {
		const address = server.address();
		const url = `http://${address.address}:${address.port}`;
		console.log(`Serving ${absolutePdfPath}`);
		console.log(`Open ${url} in your browser`);
	});

	const wss = new WebSocketServer({ server });

	chokidar.watch(absolutePdfPath).on('change', () => {
		wss.clients.forEach(client => {
			if (client.readyState === WebSocket.OPEN) client.send('reload');
		});
	});
})();
