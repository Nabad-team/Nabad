# Self-hosted AI model

This deployment runs the model you configure with Ollama on a server you control. The app sends report content and health questions to that server; it does not call Gemini, OpenAI, or another hosted model API. Keep in mind the model host is still a remote server reachable by the production API, and the host operator can access the requests unless you control the machine and its logs.

## Model host setup

Use a Linux server with Docker Compose, a DNS name pointed at its public IP, and enough memory/storage for the model. `qwen3.5:9b` is a general-purpose multimodal model, not a clinically trained or validated medical model. A GPU is recommended for reasonable response times. CPU inference may be very slow.

1. On the model host, copy `ai-server/.env.example` to `ai-server/.env`, set `OLLAMA_DOMAIN` to the DNS name, and replace `OLLAMA_API_TOKEN` with a long random secret. Do not commit this file.
2. Allow inbound TCP ports 80 and 443 in the host firewall. Point DNS to the host first so Caddy can obtain a TLS certificate.
3. From `ai-server/`, start the stack:

   ```sh
   docker compose --env-file .env -f compose.yaml up -d
   ```

4. For an NVIDIA host with NVIDIA Container Toolkit installed, add `-f compose.gpu.yaml` to that command.
5. Wait for the initial model pull to finish. It can take several minutes and several GB of storage. Check with `docker compose --env-file .env -f compose.yaml logs -f model-pull`.

Only Caddy publishes network ports. Ollama's port 11434 is private to the Compose network; do not publish it in the firewall or add a host port mapping. Caddy automatically obtains and renews TLS certificates and rejects requests without the bearer token.

## Connect the production API

Configure these backend environment variables in Render (or the API host's secret manager), then redeploy:

| Variable | Value |
| --- | --- |
| `LLM_PROVIDER` | `ollama` |
| `LLM_API_URL` | `https://<OLLAMA_DOMAIN>` (base URL only; no `/v1` or `/api/chat`) |
| `LLM_API_KEY` | The same secret as `OLLAMA_API_TOKEN` |
| `LLM_MODEL` | Same model tag as `OLLAMA_MODEL`, normally `qwen3.5:9b` |
| `LLM_TIMEOUT_MS` | `60000` |
| `LLM_VISION_ENABLED` | `true` |

The Render Blueprint marks the URL and token as unsynced secrets. Set the URL and token in the Render dashboard. The API needs outbound HTTPS access to the model host.

## What the assistant can process

Existing report extraction handles searchable PDF, DOCX, TXT/CSV and photos of written reports. Images are sent to the multimodal model. Raw MRI/CT/X-ray/ultrasound scans and DICOM files are not interpreted. The API retains its output validation, report evidence checks, urgency rules and fallback behavior; a model response is not a diagnosis and cannot confirm that a result is safe. The model is not guaranteed to answer every question correctly. Clinical use requires appropriate validation and clinician oversight.

## Local development

The repository-root `docker-compose.yml` runs Ollama alongside the app, downloads the configured model into a persistent Docker volume, and keeps the inference port private. The first run downloads several GB. See [Docker development](docker.md).

## References

- [Ollama native chat API](https://docs.ollama.com/api/chat)
- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
- [Ollama vision](https://docs.ollama.com/capabilities/vision)
- [Qwen 3.5 model library](https://ollama.com/library/qwen3.5)
