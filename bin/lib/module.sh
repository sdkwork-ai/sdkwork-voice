#!/usr/bin/env bash
# module.sh — sdkwork-voice bin/ wiring (MODULE_BIN_SPEC.md §3).
# Scaffolded by sdkwork-specs/tools/scaffold-module-bin.mjs; replace the
# unwired hooks with the repository's canonical commands as they land.
# Every shared primitive comes from sdkwork-specs/bin/lib/sdkwork-common.sh.

SDKWORK_MODULE_ID="sdkwork-voice"
SDKWORK_IMAGE_NAME="sdkwork-voice-standalone"
SDKWORK_APP_TYPES="server,pc"

# Operations wiring (OPERATIONS_SPEC.md): compose service carrying the health
# probe and its path; adjust to the module's compose file when it lands.
SDKWORK_PRIMARY_SERVICE="app"
SDKWORK_HEALTH_PATH="/healthz"
SDKWORK_CONFIG_ENV_SUBDIR="env"

# ----------------------------------------------------------------------------
# Container image (docker-image.sh build)
# ----------------------------------------------------------------------------
sdkwork_image_build() {
  local ref="$1" tag="$2"
  # Canonical container build: self-contained multi-stage Dockerfile at deployments/docker/Dockerfile
  # (build context = repository root). Wires MODULE_BIN_SPEC.md §4.1; the
  # shared entrypoint asserts the ${ref} image exists after this returns.
  sdkwork_local_run docker build -f "deployments/docker/Dockerfile" -t "${ref}" .
}

# ----------------------------------------------------------------------------
# Application build (apps-build.sh)
# ----------------------------------------------------------------------------
sdkwork_build_app() {
  local app_type="$1" environment="$2" profile="$3"
  case "${app_type}" in
    server)
      sdkwork_local_run cargo build --release ;;
    *)
      sdkwork_die "${SDKWORK_BIN_E_ENV}" \
        "app type '${app_type}' has no wired build for sdkwork-voice; extend sdkwork_build_app with the repository's canonical runner (declared: ${SDKWORK_APP_TYPES})" ;;
  esac
}

# ----------------------------------------------------------------------------
# Application packaging (apps-package.sh)
# ----------------------------------------------------------------------------
sdkwork_package_app() {
  local app_type="$1" environment="$2" profile="$3" out="$4"
  sdkwork_die "${SDKWORK_BIN_E_STATE}" \
    "sdkwork-voice has no canonical release packager wired yet; implement sdkwork_package_app against the repository's packaging command (MODULE_BIN_SPEC.md §4.4)"
}

# ----------------------------------------------------------------------------
# Native installer packaging (apps-pkg-installer.sh, MODULE_BIN_SPEC.md §4.9)
# ----------------------------------------------------------------------------
sdkwork_installer_app() {
  local app_type="$1" platform="$2" environment="$3" profile="$4" out="$5" arch="$6" format="$7"
  sdkwork_die "${SDKWORK_BIN_E_STATE}" \
    "sdkwork-voice has no native installer builder wired yet; implement sdkwork_installer_app against the repository's installer commands (MODULE_BIN_SPEC.md §4.9; platforms: windows|linux|macos|android|ios)"
}

# ----------------------------------------------------------------------------
# Application deployment (apps-deploy.sh)
# ----------------------------------------------------------------------------
sdkwork_deploy_app() {
  local app_type="$1" action="$2" environment="$3" profile="$4" host="$5"
  sdkwork_die "${SDKWORK_BIN_E_STATE}" \
    "sdkwork-voice has no application deployment channel wired yet; implement sdkwork_deploy_app (host-native install via bin/apps-package artifacts, MODULE_BIN_SPEC.md §4.5)"
}
