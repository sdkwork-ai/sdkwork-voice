use std::sync::Arc;

use axum::Router;
use cloudrouter_open_sdk::{SdkworkAiClient, SdkworkConfig};
use sdkwork_database_sqlx::{create_any_pool_from_config, DatabasePool};
use sdkwork_routes_voice_app_api::{VoiceAppApiServicePort, VoiceAppRuntimeService};
use sdkwork_routes_voice_backend_api::{VoiceBackendApiServicePort, VoiceBackendRuntimeService};
use sdkwork_voice_drive_sync_processor::VoiceDriveSyncProcessor;
use sdkwork_voice_generation_provider_adapter::{
    VoiceGenerationProviderAdapter, VOICE_GENERATION_PROVIDER_ADAPTER_ID,
};
use sdkwork_voice_generation_provider_spi::VoiceGenerationProviderRegistry;
use sdkwork_voice_generation_repository_sqlx::{
    bootstrap_voice_database, connect_voice_database_pool_from_env, SqlVoiceStore,
};
use sdkwork_voice_service::{VoiceArtifactDriveSyncProcessorPort, VoiceGenerationService};
use sdkwork_utils_rust::service_base_url::registry_base_url_or;

pub struct EmbeddedVoiceAssembly {
    pub router: Router,
    pub voice_pool: DatabasePool,
}

pub async fn assemble_embedded_voice_application_router_from_env(
) -> Result<EmbeddedVoiceAssembly, String> {
    let _ = dotenvy::dotenv();
    let voice_pool = connect_voice_database_pool_from_env()
        .await
        .map_err(|error| error.to_string())?;
    let _voice_host = bootstrap_voice_database(voice_pool.clone()).await?;
    assemble_embedded_voice_application_router(voice_pool).await
}

pub async fn assemble_embedded_voice_application_router(
    voice_pool: DatabasePool,
) -> Result<EmbeddedVoiceAssembly, String> {
    let config = voice_pool.config().clone();
    let any_pool = create_any_pool_from_config(config)
        .await
        .map_err(|error| format!("create voice any pool failed: {error}"))?;
    let store = SqlVoiceStore::new(any_pool.clone());

    let app_service: Arc<dyn VoiceAppApiServicePort> =
        Arc::new(VoiceAppRuntimeService::new(store.clone()));

    let mut backend_runtime = VoiceBackendRuntimeService::new(store.clone());
    let drive_pool = voice_pool
        .as_postgres()
        .cloned()
        .ok_or_else(|| "voice Drive sync requires a PostgreSQL database pool".to_string())?;
    if let Some(processor) = VoiceDriveSyncProcessor::try_from_pool(voice_pool.clone(), drive_pool)
        .await
        .map_err(|error| error.to_string())?
    {
        let processor: Arc<dyn VoiceArtifactDriveSyncProcessorPort> = processor.into_arc();
        backend_runtime = backend_runtime.with_drive_sync_processor(processor);
        tracing::info!("voice drive sync processor enabled");
    } else {
        tracing::info!("voice drive sync processor disabled by VOICE_DRIVE_SYNC_ENABLED");
    }
    let backend_service: Arc<dyn VoiceBackendApiServicePort> = Arc::new(backend_runtime);

    Ok(EmbeddedVoiceAssembly {
        router: sdkwork_routes_voice_app_api::gateway_mount(app_service).merge(
            sdkwork_routes_voice_backend_api::gateway_mount(backend_service),
        ),
        voice_pool,
    })
}

pub fn build_voice_generation_service_from_env() -> Result<Arc<VoiceGenerationService>, String> {
    let configured = std::env::var("SDKWORK_CLOUDROUTER_OPEN_API_BASE_URL")
        .or_else(|_| std::env::var("CLOUDROUTER_OPEN_API_BASE_URL"))
        .map(|value| value.trim().to_string())
        .unwrap_or_default();
    // DISCOVERY_SPEC §12.1: registry-first, configured value as degradation.
    let base_url = registry_base_url_or("cloudrouter", &configured);
    if base_url.is_empty() {
        return Err(
            "SDKWORK_CLOUDROUTER_OPEN_API_BASE_URL (or CLOUDROUTER_OPEN_API_BASE_URL) is required, \
             or the HTTP service registry must have a healthy cloudrouter instance"
                .to_string(),
        );
    }
    let client = SdkworkAiClient::new(SdkworkConfig::new(&base_url))
        .map_err(|error| format!("speech generation SDK client init failed: {error}"))?;
    if let Ok(api_key) = std::env::var("SDKWORK_CLOUDROUTER_OPEN_API_KEY") {
        if !api_key.trim().is_empty() {
            client.set_api_key(api_key.trim());
        }
    }
    let registry = VoiceGenerationProviderRegistry::builder()
        .register(Arc::new(VoiceGenerationProviderAdapter::new(client)))
        .map_err(|error| format!("voice provider registration failed: {error}"))?
        .default_provider(VOICE_GENERATION_PROVIDER_ADAPTER_ID)
        .build()
        .map_err(|error| format!("voice provider registry failed: {error}"))?;
    Ok(Arc::new(VoiceGenerationService::new(registry)))
}
