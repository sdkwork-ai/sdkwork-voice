use cloudrouter_open_sdk::OpenAiSpeechCreateRequest;
use sdkwork_voice_generation_provider_spi::{
    VoiceGenerationProviderError, VoiceGenerationProviderResult, VoiceSpeechGenerationCommand,
};

#[derive(Default, serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct OpenAiSpeechVendorParameters {}

pub fn build_speech_generation_request(
    command: &VoiceSpeechGenerationCommand,
) -> VoiceGenerationProviderResult<OpenAiSpeechCreateRequest> {
    command.validate()?;
    let _parameters: OpenAiSpeechVendorParameters =
        decode_vendor_parameters(command, "openai.speech-generation.v1")?;
    Ok(OpenAiSpeechCreateRequest {
        input: command.input.trim().to_string(),
        model: command.model.trim().to_string(),
        response_format: Some(command.response_format.as_str().to_string()),
        speed: command.speed,
        voice: command.voice.trim().to_string(),
    })
}

fn decode_vendor_parameters<T>(
    command: &VoiceSpeechGenerationCommand,
    expected_schema: &str,
) -> VoiceGenerationProviderResult<T>
where
    T: serde::de::DeserializeOwned + Default,
{
    let Some(parameters) = command.vendor_parameters.as_ref() else {
        return Ok(T::default());
    };
    if parameters.schema.trim() != expected_schema {
        return Err(VoiceGenerationProviderError::UnsupportedParameter(format!(
            "vendor parameter schema {} is not valid for {}",
            parameters.schema, command.vendor
        )));
    }
    serde_json::from_value(parameters.values.clone()).map_err(|error| {
        VoiceGenerationProviderError::InvalidRequest(format!(
            "invalid {} vendor parameters: {error}",
            command.vendor
        ))
    })
}
