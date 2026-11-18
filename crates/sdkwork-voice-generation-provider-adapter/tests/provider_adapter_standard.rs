use sdkwork_voice_generation_provider_adapter::{
    build_speech_generation_request, resolve_speech_sdk_route, VOICE_GENERATION_PROVIDER_ADAPTER_ID,
};
use sdkwork_voice_generation_provider_spi::{
    VoiceAudioFormat, VoiceGenerationVendorParameters, VoiceSpeechGenerationCommand, VoiceVendorId,
};

fn command() -> VoiceSpeechGenerationCommand {
    VoiceSpeechGenerationCommand {
        vendor: VoiceVendorId::new("openai").expect("vendor"),
        model: "gpt-4o-mini-tts".to_string(),
        input: "Hello from SDKWork".to_string(),
        voice: "alloy".to_string(),
        response_format: VoiceAudioFormat::Mp3,
        speed: Some(1.0),
        instructions: None,
        callback_url: None,
        idempotency_key: None,
        vendor_parameters: None,
    }
}

#[test]
fn sdk_route_is_owned_only_by_the_adapter() {
    let route = resolve_speech_sdk_route();
    assert_eq!(route.resource, "audio");
    assert_eq!(route.method, "create_speech");
    assert_eq!(
        VOICE_GENERATION_PROVIDER_ADAPTER_ID,
        "sdkwork-voice-generation-provider-adapter"
    );
}

#[test]
fn maps_the_speech_request_to_the_regenerated_sdk_model() {
    let command = command();
    let request = build_speech_generation_request(&command).expect("request");
    assert_eq!(request.model, "gpt-4o-mini-tts");
    assert_eq!(request.response_format.as_deref(), Some("mp3"));
    assert!(request.instructions.is_none());
    assert!(request.stream_format.is_none());
}

#[test]
fn rejects_the_removed_metadata_vendor_parameter() {
    let mut command = command();
    command.vendor_parameters = Some(VoiceGenerationVendorParameters {
        schema: "openai.speech-generation.v1".to_string(),
        values: serde_json::json!({ "metadata": { "scene": "narration" } }),
    });
    let error = build_speech_generation_request(&command)
        .expect_err("the regenerated SDK no longer carries metadata");
    assert!(error.to_string().contains("metadata"));
}

#[test]
fn rejects_vendor_parameter_schema_mismatch() {
    let mut command = command();
    command.vendor_parameters = Some(VoiceGenerationVendorParameters {
        schema: "suno.music-generation.v1".to_string(),
        values: serde_json::json!({}),
    });
    let error = build_speech_generation_request(&command).expect_err("schema mismatch");
    assert!(error.to_string().contains("schema"));
}
