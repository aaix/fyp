# docker build provider
docker_build_ci_aware() {
  local scope=$1
  shift
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    DOCKER_BUILDKIT=1 docker buildx build \
      --cache-from "type=gha,scope=${scope}" \
      --cache-to "type=gha,scope=${scope},mode=max" \
      --load \
      "$@"
  else
    docker build "$@"
  fi
}
