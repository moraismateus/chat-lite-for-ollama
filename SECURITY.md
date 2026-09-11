# Security policy

## Reporting a vulnerability

Please do not publish exploit details in a public issue. Use the repository's private vulnerability-reporting form to report suspected vulnerabilities. If that form is unavailable, contact the repository owner privately through the contact method listed on their GitHub profile. Include the affected version or commit, reproduction steps, impact, and any suggested mitigation.

Repository maintainers should enable GitHub Private Vulnerability Reporting before announcing a public release.

## Deployment boundary

Chat Lite for Ollama does not provide authentication or authorization. Its reverse proxy makes the Ollama model-list, model-details, and chat endpoints available to anyone who can reach the web interface. The default Compose configuration binds only to `127.0.0.1`; keep that boundary unless you add authentication, TLS, and network access controls suitable for your environment.

Never point the proxy at an Ollama server containing models or data that untrusted users should not access.
