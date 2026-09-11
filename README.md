# Chat Lite for Ollama

A tiny, private web chat for [Ollama](https://ollama.com/) with zero JavaScript dependencies and no build step. It discovers installed models, streams responses, adapts its thinking controls to the selected model, and keeps chat history in the browser.

## Features

- Streaming chat through Ollama's native API
- Automatic model discovery
- Model-aware thinking controls: Off or low/medium/high effort for thinking-capable Ollama models
- Concise, balanced, and detailed answer styles
- Stop-generation control
- Browser-local chat history with no analytics or telemetry
- Responsive, keyboard-friendly interface
- Configurable Ollama server with a same-origin Nginx proxy

## Run with Docker Compose

You need Docker and an Ollama server with at least one installed model. Start Ollama first, then run:

```console
docker compose up --build -d
```

Open <http://localhost:3000>.

By default, the container connects to Ollama on the host at `http://host.docker.internal:11434`. To use another address, copy `.env.example` to `.env` and change `OLLAMA_BASE_URL`. The URL must be reachable from inside the UI container and should not end with `/`.

On Linux, a host-run Ollama server may need to listen beyond loopback. Configure Ollama's `OLLAMA_HOST` carefully and keep the service behind a trusted network boundary.

## Run as a container

```console
docker build -t chat-lite-for-ollama .
docker run --rm -p 127.0.0.1:3000:8080 \
  --add-host host.docker.internal:host-gateway \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  chat-lite-for-ollama
```

PowerShell users can place the `docker run` arguments on one line or replace each trailing `\` with a backtick.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Ollama URL reachable from the container |
| `CHAT_LITE_PORT` | `3000` | Loopback host port used by `compose.yaml` |

The app intentionally has no direct-browser endpoint setting. Nginx proxies only the model-list, model-details, and chat endpoints needed by the interface. This avoids browser CORS configuration, keeps the server address out of client-side storage, and does not expose Ollama's other management endpoints.

## Development

The project uses plain HTML, CSS, and JavaScript, so there is no package installation or build step. Edit `index.html`, `styles.css`, or `app.js`, then rebuild the container to test the production path:

```console
docker compose up --build -d
```

The health endpoint is available at `http://localhost:3000/health`.

## Security

This interface has no authentication and proxies the Ollama endpoints it needs. The included Compose file binds it to loopback. Do not expose it to the public internet without adding authentication, TLS, and appropriate network controls. See [SECURITY.md](SECURITY.md) for reporting guidance.

Chat history and preferences are stored only in the browser's local storage. Prompts and responses still travel to the Ollama server you configure.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the lightweight development process.

## License and trademark

Released under the [MIT License](LICENSE).

Ollama is a trademark of Ollama, Inc. This community project is not affiliated with or endorsed by Ollama, Inc.
