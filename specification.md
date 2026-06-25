# PDF Live Server Specification

## 1. Overview
A lightweight web server designed to watch PDF files during paper writing (e.g., LaTeX) and serve them for live preview via a web browser.
When the target PDF is updated, it automatically instructs the browser to reload the PDF while **maintaining the current scroll position (page position)** after the reload.

## 2. Core Requirements
* **PDF Serving**: Serves the specified target PDF file over HTTP.
* **File Watching**: Watches the target PDF file on the server side and detects updates (e.g., atomic overwrites by LaTeX compilers).
* **Automatic Reload & Position Retention**:
  * Upon detecting a PDF update, sends a notification to the connected client (browser).
  * The browser refreshes the PDF data upon receiving the notification.
  * During the refresh, it automatically restores the exact page number and scroll position the user was viewing, providing a seamless reading experience.
* **Network & Infrastructure**:
  * Designed to run as a simple local web server binding to `0.0.0.0`, accessible from other devices via local network or Tailscale.
  * No built-in authentication or manual HTTPS configuration is required.
* **Dynamic Port Allocation**:
  * The server attempts to listen on port `8080` by default.
  * If `8080` is in use, it automatically falls back to an available random port provided by the OS.
* **Tailscale Integration (`-t` / `--tailscale`)**:
  * Can be launched with the `--tailscale` flag to automatically expose the local server to the Tailnet via `tailscale serve`.
  * Automatically handles Tailscale port conflicts and generates/prints a QR code in the terminal for easy access from mobile or tablet devices.
* **ngrok Integration (`-n` / `--ngrok`)**:
  * Can be launched with the `--ngrok` flag to dynamically create a public tunnel to the local server using `@ngrok/ngrok`.
  * Requires the `NGROK_AUTHTOKEN` environment variable to authenticate the session.
  * Generates and prints a QR code of the public ngrok URL for easy access.
  * Mutually exclusive with the `--tailscale` flag; specifying both will result in an error.

## 3. System Architecture
* **Backend (Web Server)**:
  * **Language**: Node.js (TypeScript)
  * **Key Responsibilities**:
    1. Serve the frontend assets (HTML/JS/CSS).
    2. Serve the target PDF file.
    3. File watching using `chokidar`. It handles atomic saves by watching the parent directory and filtering for the specific file, implementing debounce logic to prevent multiple rapid reload events during compilation.
    4. Client notification channel using **Server-Sent Events (SSE)** for simple, unidirectional real-time communication.
    5. OS-level automatic port fallback when the target port encounters an `EADDRINUSE` error.
* **Frontend (Browser)**:
  * **Rendering**: Instead of using `<embed>` or `<iframe>` which lack programmatic scroll control, **PDF.js** is used to render the PDF natively in the browser.
  * **State Management**: Upon receiving an "update" event via SSE, it caches the current scroll position (Y-coordinate), re-renders the new PDF, and restores the scroll position.

## 4. Technical Stack & Implementation Details
* **Language**: **TypeScript** is used for both frontend and backend.
* **Backend Framework**: Node.js + Express.
* **Command Line Interface (CLI)**: 
  * Provided as an installable CLI tool (`pdf-live-server`).
  * Target PDF and flags are specified via command-line arguments (e.g., `pdf-live-server --tailscale ./paper.pdf`).
* **Frontend Build Tool**: **Vite** is used to bundle the frontend code and PDF.js workers.
* **Testing**: 
  * Automated End-to-End (E2E) testing powered by **Playwright**.
  * Validates core functionalities including CLI flag parsing, dynamic port fallback, Tailscale configuration, and frontend scroll retention.
* **Development Methodology**: Developed strictly following a Test-Driven Development (TDD) cycle (Red-Green-Refactor) as mandated by the project guidelines (`AGENTS.md`).
