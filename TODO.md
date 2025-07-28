# TODO for Implementing livepdf-server

The current repository only contains a minimal CLI skeleton. The features outlined in `README.md` are not yet present. Below are the tasks required to implement them.

## Core Server

- [x] Create an HTTP server to serve the specified PDF file.
- [x] Provide an HTML viewer page that embeds the PDF and connects to the reload mechanism.
- [x] Accept `--port` and `--host` options to configure the listening address/port.

## Automatic Reloading

- [x] Watch the target PDF file for changes (e.g. using `fs.watch` or `chokidar`).
- [x] Establish a WebSocket or SSE connection to notify the browser when the PDF updates.
- [x] Make the viewer page reload the PDF upon receiving a notification.

## Cross-Device Access

- [x] Ensure the server binds to `0.0.0.0` by default so other devices on the local network can connect.
- [x] Output the access URL (including host and port) for convenience.

## CLI Integration

- [x] Implement command line argument parsing to obtain the PDF path and options.
- [x] Validate that the provided PDF path exists and is readable.
- [x] Display helpful error messages when options are invalid or missing.

## Package Setup

- [x] Add necessary dependencies to `package.json` (such as `express`, `ws` or `chokidar`).
- [x] Implement script or entry file (`index.js`) that sets up the server using these modules.

## Documentation and Examples

- [x] Update `README.md` once implementation is complete, including usage examples and option descriptions.

