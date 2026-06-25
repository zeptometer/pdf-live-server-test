# PDF Live Server

A web server for live previewing PDFs, designed to support paper writing (e.g., LaTeX).
It detects updates to a target PDF file and automatically instructs the browser to reload the view, **maintaining the current scroll position** after the redraw.
It detects updates to a target PDF file and automatically instructs the browser to reload the view, **maintaining the current scroll position** after the redraw.
It is built as a simple HTTP server, making it ideal for viewing over a local network or VPN/reverse proxies like Tailscale or ngrok.

## Features

* 🚀 **Real-time Updates**: When the file is updated, the PDF in the browser reloads instantly.
* 📜 **Scroll Position Retention**: After reloading, the view does not jump back to the top; it stays exactly where you were reading.
* 🌐 **HTTP-based Serving**: You can view the preview from other devices on the local network, or securely over the internet via Tailscale/ngrok without any complex configuration.
* 🔍 **Robust File Watching**: Combines directory-level watching and polling to prevent the watcher from losing track due to atomic file saves (deletion and recreation) typically performed by LaTeX compilers.

## Prerequisites

* Node.js (v18 or later recommended)
* npm

## Installation

Clone the repository and install the dependencies:

```bash
cd pdf-live-server
npm install
```

### Install as a Global Command

Running the following command in the project directory allows you to use the `pdf-live-server` command from anywhere on your system:

```bash
npm link
# or npm install -g .
```

## Usage

After installation, run the command by specifying the path to the PDF you want to watch.

```bash
pdf-live-server [-t|--tailscale] [-n|--ngrok] <path-to-target-pdf>
```

* `-t, --tailscale`: (Optional) Executes `tailscale serve` on startup to automatically generate HTTPS routing and a QR code.
* `-n, --ngrok`: (Optional) Starts an ngrok tunnel on startup to provide a public URL and a QR code. **Requires the `NGROK_AUTHTOKEN` environment variable to be set.**

**Examples:**
```bash
# Watch paper.pdf on the default port
pdf-live-server path/to/your/paper.pdf

# Automatically configure secure access via Tailscale
pdf-live-server --tailscale path/to/your/paper.pdf

# Automatically configure public access via ngrok
export NGROK_AUTHTOKEN="your_auth_token_here"
pdf-live-server --ngrok path/to/your/paper.pdf
```

After startup, open the URL displayed in the console (e.g., `http://localhost:8080`) in your browser. Whenever the PDF file is overwritten and saved by another editor or compiler, the browser preview will update automatically.

## Testing

This project includes End-to-End (E2E) tests using Playwright.
The tests launch a virtual browser and automatically verify the entire flow: "pseudo-modification of the file → refetching and redrawing the PDF → verifying that the scroll position is maintained."

```bash
npm run test
```

## Technologies Used

* **Frontend**: TypeScript, Vite, PDF.js
* **Backend**: Express (Node.js), chokidar, Server-Sent Events (SSE)
* **Testing**: Playwright
