# livepdf-server

`livepdf-server` is a small utility that serves a local PDF over HTTP so you can access it from any device on your network. When the PDF changes, connected browsers automatically reload to display the latest version. The viewer uses [PDF.js](https://mozilla.github.io/pdf.js/) loaded from the [cdnjs](https://cdnjs.com/libraries/pdf.js) CDN and preserves your scroll position between reloads.

## Features

- Serve a specified PDF file via an HTTP server
- View the PDF simply by accessing the server URL
- Automatically reloads the browser to show the latest PDF when the file is updated
- Reloading keeps your scroll position thanks to a PDF.js-based viewer
- Accessible from other devices (PC, smartphone, tablet, etc.) on the same local network
- Binds to `0.0.0.0` so other devices on your LAN can connect

## Usage

```sh
npx livepdf-server <path-to-pdf> [options]
```

or

```sh
livepdf-server <path-to-pdf> [options]
```

### Options

- `--port <number>` : Specify the server port (default: 3000)
- `--host <address>` : Specify the address to bind (default: 0.0.0.0)

## Example

```sh
livepdf-server ./mydoc.pdf --port 8080
```

## Use cases

- Check drafts or documents in PDF format in real time from multiple devices
- Review or share presentation materials with multiple people
