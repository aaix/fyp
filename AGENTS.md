# AGENTS.md

## Cursor Cloud specific instructions

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
2. Ensure ScyllaDB data directories have open permissions: `sudo chmod -R 777 /workspace/database/data/`.
3. Start services: `sudo docker compose up -d` from the workspace root. ScyllaDB (`scylla-seed`) must become healthy before `dataservices-0` will start.
4. Apply the database schema (only needed on first run or after wiping data): `sudo docker exec workspace-scylla-seed-1 cqlsh -f /schema.cql`.
5. Start the frontend dev server: `npm run dev` in `ui/app/`.

The Vite dev server proxies `/api` to the API container at `172.31.0.20:8000` and `/gateway` to the Gateway container at `172.31.0.30:80` (Docker compose network IPs).

### Key caveats

- **Python 3.14 required**: The API and Gateway use PEP 649 (deferred annotation evaluation), so they cannot be imported/run locally with Python 3.12. Always run them in Docker. Local venvs (`api/.venv`, `gateway/.venv`) are useful only for IDE autocompletion—not for running the services.
- **ScyllaDB startup is slow**: The seed node takes ~30-60 seconds to become healthy. The `dataservices-0` container depends on it and will wait automatically.
- **ScyllaDB data directory permissions**: The bind-mount directories under `database/data/` must be writable by the ScyllaDB container user. If you get `PermissionError`, run `sudo chmod -R 777 /workspace/database/data/`.
- **Docker images must be rebuilt** after code changes to backend services: `sudo docker build --build-context shared=./shared/ ./api -t az-api:latest` (similarly for gateway and dataservices). See `build.bash`.
- **No healthcheck on docker-compose**: The `scylla-seed` container has a healthcheck, but `dataservices-0`, `api-0`, and `gateway-0` do not. Check `sudo docker logs <container>` to verify they started.

### Standard commands

- **Lint**: `npm run lint` in `ui/app/`
- **Build frontend**: `npm run build` in `ui/app/`
- **Dev server**: `npm run dev` in `ui/app/`
- **Rust check**: `cargo check` in `dataservices/`
- **Build all Docker images**: `bash build.bash` from workspace root
- **Start all services**: `sudo docker compose up -d` from workspace root
