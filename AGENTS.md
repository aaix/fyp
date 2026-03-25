# AGENTS.md

## Cursor Cloud specific instructions

you are only authorized to make changes to the ui/ folder, refrain from making anything but typo fixes to the ui/app/src/lib/ folder, do not try to implement things to interact with the backend - if functionality is missing make a note of it and use placeholders, you can search for api routes in api/ and the response model will be defined in the models file in the same folder as the route definition.

the frontend is a vite+react app, if you think something may be reused multiple times, you should create a component for it, do not worry about supporting old browsers as the project requires websockets & webcrypto support, when using try/catch, if the error will affect the user (e.g. error text shown to the user, or message or element not rendered, you MUST console.error the error)

### Architecture overview

This is a private social media platform with end-to-end encrypted messaging ("az7"). It consists of:

| Service | Tech | Runs in |
|---|---|---|
| **UI** | React 19 + Vite 7 + Tailwind CSS 4 | Local (npm) |
| **API** | Python 3.14 + FastAPI | Docker |
| **Gateway** | Python 3.14 + websockets | Docker |
| **Dataservices** | Rust (edition 2024) + Tonic gRPC | Docker |
| **Database** | ScyllaDB | Docker |

### Running the full stack

1. **Docker must be running** (`sudo dockerd` if not already started).
2. Bootstrap local images + env + services with one command: `bash start.bash` from the workspace root.
3. Start the frontend dev server: `npm run dev` in `ui/app/`.

The Vite dev server proxies `/api` to the API container at `172.31.0.20:8000` and `/gateway` to the Gateway container at `172.31.0.30:80` (Docker compose network IPs).

### Key caveats

- **Python 3.14 required**: The API and Gateway use PEP 649 (deferred annotation evaluation), so they cannot be imported/run locally with Python 3.12. Always run them in Docker. Local venvs (`api/.venv`, `gateway/.venv`) are useful only for IDE autocompletion—not for running the services.
- **ScyllaDB startup is slow**: The seed node takes ~30-60 seconds to become healthy. The `dataservices-0` container depends on it and will wait automatically.
- **One-command bootstrap**: `start.bash` auto-creates `.env.cloud` from `.env.cloud.example`, sets Scylla data permissions, builds missing images, starts required services, and applies schema only when missing.
- **Docker images must be rebuilt** after code changes to backend services: run `bash build.bash` (or `FORCE_IMAGE_BUILD=1 bash start.bash`).
- **Compose profile note**: extra Scylla nodes use profile `full-cluster`; default startup only launches services required for UI work.
- **No healthcheck on docker-compose**: The `scylla-seed` container has a healthcheck, but `dataservices-0`, `api-0`, and `gateway-0` do not. Check `sudo docker logs <container>` to verify they started.

### Standard commands

- **Lint**: `npm run lint` in `ui/app/`
- **Build frontend**: `npm run build` in `ui/app/`
- **Dev server**: `npm run dev` in `ui/app/`
- **Rust check**: `cargo check` in `dataservices/`
- **Build all Docker images**: `bash build.bash` from workspace root
- **Bootstrap UI-ready services**: `bash start.bash` from workspace root
- **Start full Scylla cluster (optional)**: `sudo docker compose --profile full-cluster up -d`
