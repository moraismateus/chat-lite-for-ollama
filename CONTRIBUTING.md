# Contributing

Thanks for helping improve Chat Lite for Ollama.

## Before opening a pull request

1. Preserve the zero-JavaScript-dependency, no-build-step approach unless a dependency solves a clear, documented need.
2. Preserve the same-origin `/ollama/` proxy boundary; browser code should not call arbitrary remote servers directly.
3. Check the interface at both desktop and mobile widths, including keyboard navigation.
4. Build the container and confirm that `/health` returns a successful response.
5. Avoid committing chat transcripts, environment files, model data, or credentials.

For substantial changes, open an issue first so the user experience and scope can be discussed before implementation.

By contributing, you agree that your contribution is licensed under the project's MIT License.
