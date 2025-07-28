# livepdf-server

`livepdf-server` is a Node.js server that serves a local PDF file over HTTP, allowing you to view it from other devices via a web browser. When the PDF file is updated, the browser automatically reloads to display the latest version.

## Features

- Serve a specified PDF file via an HTTP server
- View the PDF simply by accessing the server URL
- Automatically reloads the browser to show the latest PDF when the file is updated
- Accessible from other devices (PC, smartphone, tablet, etc.) on the same local network

## Usage

```sh
npx livepdf-server <path-to-pdf> [options]
```

or

```sh
livepdf-server <path-to-pdf> [options]
```

### Example options

- `--port <number>` : Specify the server port (default: 3000)
- `--host <address>` : Specify the address to bind (default: 0.0.0.0)

## Example

```sh
livepdf-server ./mydoc.pdf --port 8080
```

## Use cases

- Check drafts or documents in PDF format in real time from multiple devices
- Review or share presentation materials with multiple people
