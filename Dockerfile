FROM nginx:1.29.8-alpine

LABEL org.opencontainers.image.title="Chat Lite for Ollama" \
      org.opencontainers.image.description="A tiny, private web chat for local Ollama models" \
      org.opencontainers.image.licenses="MIT"

ENV OLLAMA_BASE_URL=http://host.docker.internal:11434 \
    NGINX_ENVSUBST_FILTER=OLLAMA_BASE_URL

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY index.html styles.css app.js favicon.svg /usr/share/nginx/html/
COPY LICENSE /usr/share/licenses/chat-lite-for-ollama/LICENSE

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=5 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/health || exit 1
