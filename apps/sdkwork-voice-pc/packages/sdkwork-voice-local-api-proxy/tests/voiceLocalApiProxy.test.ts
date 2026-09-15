// WORKSPACE-PATH:allow-fixture: fixtures name a foreign checkout root, drive, or home directory to exercise path handling, so the literal is the value under assertion rather than a binding this build resolves
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  VoiceLocalApiCapability,
  VoiceLocalApiProxyConfig,
  VoiceLocalApiProxyMode,
  VoiceLocalApiProxyModelBinding,
  VoiceProxyUpstreamIdentity,
  VoiceRouteCapabilityBinding,
} from "../src/index.ts";
import {
  VOICE_LOCAL_API_PROXY_DEFAULT_POSTGRES_SCHEMA,
  VOICE_LOCAL_API_PROXY_DEFAULT_SQLITE_FILENAME,
  VOICE_LOCAL_API_PROXY_TABLE_PREFIX,
  buildVoiceLocalApiProxyPostgresqlSchema,
  buildVoiceLocalApiProxySqliteSchema,
  createDefaultVoiceLocalApiProxyConfig,
  createVoiceLocalApiProxyOperationCatalog,
  createVoiceLocalApiProxyRouteGroups,
  createVoiceLocalApiProxySchemaTableNames,
  findVoiceLocalApiProxyOperation,
  listVoiceLocalApiProxyOperationsByCapability,
  normalizeVoiceLocalApiProxyConfig,
  voiceLocalApiProxyPackageMeta,
} from "../src/index.ts";

describe("@sdkwork/voice-local-api-proxy", () => {
  it("is owned by sdkwork-voice and exposes only voice/audio proxy capabilities", () => {
    expect(voiceLocalApiProxyPackageMeta).toMatchObject({
      domain: "voice",
      package: "@sdkwork/voice-local-api-proxy",
      workspace: "sdkwork-voice",
    });

    expectTypeOf<VoiceLocalApiProxyMode>().toEqualTypeOf<"desktop-local" | "server-managed">();
    expectTypeOf<VoiceLocalApiCapability>().toEqualTypeOf<
      | "audio-speech"
      | "audio-transcription"
      | "audio-translation"
      | "audio-voice-catalog"
      | "audio-voice-consent"
      | "audio-sound-effect"
      | "audio-music"
      | "audio-generated-image"
      | "audio-generated-video"
      | "audio-realtime-session"
      | "audio-realtime-client-secret"
      | "audio-realtime-call"
      | "audio-realtime-transcription"
      | "audio-realtime-translation"
    >();
    expectTypeOf<VoiceRouteCapabilityBinding["capability"]>().toEqualTypeOf<VoiceLocalApiCapability>();
    expectTypeOf<VoiceLocalApiProxyModelBinding["role"]>().toEqualTypeOf<
      "speech" | "transcription" | "translation" | "sound-effect" | "music" | "realtime" | "custom"
    >();
    expectTypeOf<VoiceProxyUpstreamIdentity["protocolKind"]>().toEqualTypeOf<
      "openai-compatible" | "azure-openai" | "cloud-router" | "custom-http"
    >();
  });

  it("normalizes voice proxy route config with voice defaults", () => {
    const config = createDefaultVoiceLocalApiProxyConfig({
      storage: {
        dialect: "sqlite",
        sqlitePath: "C:/sdkwork/data/voice-local-api-proxy.db",
      },
      routes: [
        {
          capabilities: [
            {
              capability: "audio-speech",
              operationSet: [" openai.v1.audio.speech.create ", "openai.v1.audio.speech.create", ""],
            },
          ],
          clientProtocol: "openai-compatible",
          exposures: [
            { consumerId: " SDKWork Voice ", enabled: true, label: " SDKWork Voice ", target: "custom" },
            { consumerId: "sdkwork-voice", enabled: true, target: "custom" },
          ],
          id: " Voice Runtime / Primary ",
          modelBindings: [{ capability: "audio-speech", modelId: "tts-1", role: "speech" }],
          providerId: "openai",
          tags: [" voice ", "openai", "voice"],
          upstream: {
            baseUrl: "https://api.openai.com/v1/ ",
            credentialRef: " keychain:openai/default ",
            protocolKind: "openai-compatible",
            providerId: "openai",
          },
          upstreamProtocol: "openai-compatible",
        },
      ],
    });

    expect(VOICE_LOCAL_API_PROXY_TABLE_PREFIX).toBe("vlap_");
    expect(VOICE_LOCAL_API_PROXY_DEFAULT_SQLITE_FILENAME).toBe("voice-local-api-proxy.db");
    expect(config.bind).toEqual({
      host: "127.0.0.1",
      port: 21381,
      publicBaseUrl: "http://127.0.0.1:21381",
    });
    expect(config.routes[0]).toMatchObject({
      id: "voice-runtime-primary",
      modelBindings: [{ capability: "audio-speech", modelId: "tts-1", role: "speech" }],
      tags: ["voice", "openai"],
      upstream: {
        baseUrl: "https://api.openai.com/v1",
        credentialRef: "keychain:openai/default",
      },
    });
    expect(config.routes[0]?.capabilities).toEqual([
      {
        capability: "audio-speech",
        enabled: true,
        operationSet: ["openai.v1.audio.speech.create"],
        streaming: false,
      },
    ]);
  });

  it("registers speech, transcription, translation, voice catalog, voice consent, sound-effect, music, realtime, and provider task operations", () => {
    expect(createVoiceLocalApiProxyOperationCatalog().map((operation) => operation.id)).toEqual([
      "openai.v1.audio.speech.create",
      "openai.v1.audio.transcriptions.create",
      "openai.v1.audio.translations.create",
      "openai.v1.audio.voices.list",
      "openai.v1.audio.voices.create",
      "openai.v1.audio.voices.retrieve",
      "openai.v1.audio.voice_consents.list",
      "openai.v1.audio.voice_consents.create",
      "openai.v1.audio.voice_consents.retrieve",
      "openai.v1.audio.voice_consents.update",
      "openai.v1.audio.voice_consents.delete",
      "openai.v1.realtime.sessions.create",
      "openai.v1.realtime.client_secrets.create",
      "openai.v1.realtime.calls.create",
      "openai.v1.realtime.calls.accept.create",
      "openai.v1.realtime.calls.hangup.create",
      "openai.v1.realtime.calls.refer.create",
      "openai.v1.realtime.calls.reject.create",
      "openai.v1.realtime.transcription_sessions.create",
      "openai.v1.realtime.translations.create",
      "suno.v1.music.generations.create",
      "suno.v1.music.generations.retrieve",
      "elevenlabs.v1.sound_generation.create",
      "volcengine.api.v3.contents.generations.tasks.create",
      "volcengine.api.v3.contents.generations.tasks.retrieve",
      "kling.v1.videos.generations.create",
      "kling.v1.videos.generations.retrieve",
      "nano-banana.v1.images.generations.create",
      "nano-banana.v1.images.generations.retrieve",
      "midjourney.v1.images.generations.create",
      "midjourney.v1.images.generations.retrieve",
      "vidu.ent.v2.reference2image.create",
      "vidu.ent.v2.text2video.create",
      "vidu.ent.v2.img2video.create",
      "vidu.ent.v2.reference2video.create",
      "vidu.ent.v2.start_end2video.create",
      "vidu.ent.v2.tasks.creations.list",
    ]);
    expect(findVoiceLocalApiProxyOperation("openai.v1.audio.transcriptions.create")).toMatchObject({
      capability: "audio-transcription",
      groupId: "voice-audio",
      pathPattern: "/v1/audio/transcriptions",
    });
    expect(findVoiceLocalApiProxyOperation("openai.v1.audio.voices.retrieve")).toMatchObject({
      capability: "audio-voice-catalog",
      groupId: "voice-audio",
      method: "GET",
      pathPattern: "/v1/audio/voices/{voice_id}",
    });
    expect(findVoiceLocalApiProxyOperation("openai.v1.realtime.client_secrets.create")).toMatchObject({
      capability: "audio-realtime-client-secret",
      groupId: "voice-audio",
      method: "POST",
      pathPattern: "/v1/realtime/client_secrets",
    });
    expect(listVoiceLocalApiProxyOperationsByCapability("audio-realtime-call")).toEqual([
      {
        capability: "audio-realtime-call",
        consumerProtocol: "openai-compatible",
        groupId: "voice-audio",
        id: "openai.v1.realtime.calls.create",
        method: "POST",
        pathPattern: "/v1/realtime/calls",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-realtime-call",
        consumerProtocol: "openai-compatible",
        groupId: "voice-audio",
        id: "openai.v1.realtime.calls.accept.create",
        method: "POST",
        pathPattern: "/v1/realtime/calls/{call_id}/accept",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-realtime-call",
        consumerProtocol: "openai-compatible",
        groupId: "voice-audio",
        id: "openai.v1.realtime.calls.hangup.create",
        method: "POST",
        pathPattern: "/v1/realtime/calls/{call_id}/hangup",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-realtime-call",
        consumerProtocol: "openai-compatible",
        groupId: "voice-audio",
        id: "openai.v1.realtime.calls.refer.create",
        method: "POST",
        pathPattern: "/v1/realtime/calls/{call_id}/refer",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-realtime-call",
        consumerProtocol: "openai-compatible",
        groupId: "voice-audio",
        id: "openai.v1.realtime.calls.reject.create",
        method: "POST",
        pathPattern: "/v1/realtime/calls/{call_id}/reject",
        probeSupport: true,
        streaming: false,
      },
    ]);
    expect(listVoiceLocalApiProxyOperationsByCapability("audio-translation")).toEqual([
      {
        capability: "audio-translation",
        consumerProtocol: "openai-compatible",
        groupId: "voice-audio",
        id: "openai.v1.audio.translations.create",
        method: "POST",
        pathPattern: "/v1/audio/translations",
        probeSupport: true,
        streaming: false,
      },
    ]);
    expect(listVoiceLocalApiProxyOperationsByCapability("audio-voice-consent")).toEqual([
      {
        capability: "audio-voice-consent",
        consumerProtocol: "openai-compatible",
        groupId: "voice-audio",
        id: "openai.v1.audio.voice_consents.list",
        method: "GET",
        pathPattern: "/v1/audio/voice_consents",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-voice-consent",
        consumerProtocol: "openai-compatible",
        groupId: "voice-audio",
        id: "openai.v1.audio.voice_consents.create",
        method: "POST",
        pathPattern: "/v1/audio/voice_consents",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-voice-consent",
        consumerProtocol: "openai-compatible",
        groupId: "voice-audio",
        id: "openai.v1.audio.voice_consents.retrieve",
        method: "GET",
        pathPattern: "/v1/audio/voice_consents/{consent_id}",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-voice-consent",
        consumerProtocol: "openai-compatible",
        groupId: "voice-audio",
        id: "openai.v1.audio.voice_consents.update",
        method: "POST",
        pathPattern: "/v1/audio/voice_consents/{consent_id}",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-voice-consent",
        consumerProtocol: "openai-compatible",
        groupId: "voice-audio",
        id: "openai.v1.audio.voice_consents.delete",
        method: "DELETE",
        pathPattern: "/v1/audio/voice_consents/{consent_id}",
        probeSupport: true,
        streaming: false,
      },
    ]);
    expect(listVoiceLocalApiProxyOperationsByCapability("audio-generated-image")).toEqual([
      {
        capability: "audio-generated-image",
        consumerProtocol: "custom-http",
        groupId: "voice-audio",
        id: "nano-banana.v1.images.generations.create",
        method: "POST",
        pathPattern: "/nano-banana/v1/images/generations",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-generated-image",
        consumerProtocol: "custom-http",
        groupId: "voice-audio",
        id: "nano-banana.v1.images.generations.retrieve",
        method: "GET",
        pathPattern: "/nano-banana/v1/images/generations/{task_id}",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-generated-image",
        consumerProtocol: "custom-http",
        groupId: "voice-audio",
        id: "midjourney.v1.images.generations.create",
        method: "POST",
        pathPattern: "/midjourney/v1/images/generations",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-generated-image",
        consumerProtocol: "custom-http",
        groupId: "voice-audio",
        id: "midjourney.v1.images.generations.retrieve",
        method: "GET",
        pathPattern: "/midjourney/v1/images/generations/{task_id}",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-generated-image",
        consumerProtocol: "custom-http",
        groupId: "voice-audio",
        id: "vidu.ent.v2.reference2image.create",
        method: "POST",
        pathPattern: "/vidu/ent/v2/reference2image",
        probeSupport: true,
        streaming: false,
      },
    ]);
    expect(listVoiceLocalApiProxyOperationsByCapability("audio-generated-video")).toEqual([
      {
        capability: "audio-generated-video",
        consumerProtocol: "custom-http",
        groupId: "voice-audio",
        id: "kling.v1.videos.generations.create",
        method: "POST",
        pathPattern: "/kling/v1/videos/generations",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-generated-video",
        consumerProtocol: "custom-http",
        groupId: "voice-audio",
        id: "kling.v1.videos.generations.retrieve",
        method: "GET",
        pathPattern: "/kling/v1/videos/generations/{task_id}",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-generated-video",
        consumerProtocol: "custom-http",
        groupId: "voice-audio",
        id: "vidu.ent.v2.text2video.create",
        method: "POST",
        pathPattern: "/vidu/ent/v2/text2video",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-generated-video",
        consumerProtocol: "custom-http",
        groupId: "voice-audio",
        id: "vidu.ent.v2.img2video.create",
        method: "POST",
        pathPattern: "/vidu/ent/v2/img2video",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-generated-video",
        consumerProtocol: "custom-http",
        groupId: "voice-audio",
        id: "vidu.ent.v2.reference2video.create",
        method: "POST",
        pathPattern: "/vidu/ent/v2/reference2video",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-generated-video",
        consumerProtocol: "custom-http",
        groupId: "voice-audio",
        id: "vidu.ent.v2.start_end2video.create",
        method: "POST",
        pathPattern: "/vidu/ent/v2/start-end2video",
        probeSupport: true,
        streaming: false,
      },
      {
        capability: "audio-generated-video",
        consumerProtocol: "custom-http",
        groupId: "voice-audio",
        id: "vidu.ent.v2.tasks.creations.list",
        method: "GET",
        pathPattern: "/vidu/ent/v2/tasks/{task_id}/creations",
        probeSupport: true,
        streaming: false,
      },
    ]);
    expect(createVoiceLocalApiProxyRouteGroups()).toEqual([
      {
        capabilityFamilies: [
          "audio-speech",
          "audio-transcription",
          "audio-translation",
          "audio-voice-catalog",
          "audio-voice-consent",
          "audio-sound-effect",
          "audio-music",
          "audio-generated-image",
          "audio-generated-video",
          "audio-realtime-session",
          "audio-realtime-client-secret",
          "audio-realtime-call",
          "audio-realtime-transcription",
          "audio-realtime-translation",
        ],
        id: "voice-audio",
        operationIds: [
          "openai.v1.audio.speech.create",
          "openai.v1.audio.transcriptions.create",
          "openai.v1.audio.translations.create",
          "openai.v1.audio.voices.list",
          "openai.v1.audio.voices.create",
          "openai.v1.audio.voices.retrieve",
          "openai.v1.audio.voice_consents.list",
          "openai.v1.audio.voice_consents.create",
          "openai.v1.audio.voice_consents.retrieve",
          "openai.v1.audio.voice_consents.update",
          "openai.v1.audio.voice_consents.delete",
          "openai.v1.realtime.sessions.create",
          "openai.v1.realtime.client_secrets.create",
          "openai.v1.realtime.calls.create",
          "openai.v1.realtime.calls.accept.create",
          "openai.v1.realtime.calls.hangup.create",
          "openai.v1.realtime.calls.refer.create",
          "openai.v1.realtime.calls.reject.create",
          "openai.v1.realtime.transcription_sessions.create",
          "openai.v1.realtime.translations.create",
          "suno.v1.music.generations.create",
          "suno.v1.music.generations.retrieve",
          "elevenlabs.v1.sound_generation.create",
          "volcengine.api.v3.contents.generations.tasks.create",
          "volcengine.api.v3.contents.generations.tasks.retrieve",
          "kling.v1.videos.generations.create",
          "kling.v1.videos.generations.retrieve",
          "nano-banana.v1.images.generations.create",
          "nano-banana.v1.images.generations.retrieve",
          "midjourney.v1.images.generations.create",
          "midjourney.v1.images.generations.retrieve",
          "vidu.ent.v2.reference2image.create",
          "vidu.ent.v2.text2video.create",
          "vidu.ent.v2.img2video.create",
          "vidu.ent.v2.reference2video.create",
          "vidu.ent.v2.start_end2video.create",
          "vidu.ent.v2.tasks.creations.list",
        ],
      },
    ]);
  });

  it("builds voice-specific sqlite and postgresql schema", () => {
    expect(createVoiceLocalApiProxySchemaTableNames()).toEqual([
      "vlap_schema_migrations",
      "vlap_config",
      "vlap_routes",
      "vlap_route_capabilities",
      "vlap_request_logs",
      "vlap_generation_tasks",
      "vlap_task_events",
      "vlap_audio_artifacts",
      "vlap_artifact_drive_sync",
      "vlap_provider_webhook_events",
    ]);

    const sqlite = buildVoiceLocalApiProxySqliteSchema({
      dialect: "sqlite",
      sqlitePath: "C:/sdkwork/data/voice-local-api-proxy.db",
    });
    const sqliteDdl = sqlite.statements.join("\n");
    expect(sqlite.databasePath).toBe("C:/sdkwork/data/voice-local-api-proxy.db");
    expect(sqliteDdl).toContain("CREATE TABLE IF NOT EXISTS vlap_audio_artifacts");
    expect(sqliteDdl).toContain("CREATE TABLE IF NOT EXISTS vlap_artifact_drive_sync");
    expect(sqliteDdl).toContain("CREATE TABLE IF NOT EXISTS vlap_generation_tasks");
    expect(sqliteDdl).toContain("provider_task_id TEXT");
    expect(sqliteDdl).toContain("CREATE INDEX IF NOT EXISTS idx_vlap_generation_tasks_status");
    expect(sqliteDdl).toContain("media_resource_json TEXT NOT NULL");
    expect(sqliteDdl).toContain("drive_space_type TEXT NOT NULL");

    const postgresql = buildVoiceLocalApiProxyPostgresqlSchema({
      dialect: "postgresql",
      postgresUrl: "postgres://localhost:5432/sdkwork_ai_dev",
    });
    const pgDdl = postgresql.statements.join("\n");
    expect(VOICE_LOCAL_API_PROXY_DEFAULT_POSTGRES_SCHEMA).toBe("sdkwork_ai_dev");
    expect(postgresql.schemaName).toBe("sdkwork_ai_dev");
    expect(pgDdl).toContain("CREATE SCHEMA IF NOT EXISTS sdkwork_ai_dev;");
    expect(pgDdl).toContain("CREATE TABLE IF NOT EXISTS sdkwork_ai_dev.vlap_audio_artifacts");
    expect(pgDdl).toContain("CREATE TABLE IF NOT EXISTS sdkwork_ai_dev.vlap_artifact_drive_sync");
    expect(pgDdl).toContain("CREATE TABLE IF NOT EXISTS sdkwork_ai_dev.vlap_generation_tasks");
    expect(pgDdl).toContain("provider_task_id TEXT");
    expect(pgDdl).toContain("media_resource_json JSONB NOT NULL");
    expect(pgDdl).toContain("drive_resource_json JSONB");
  });

  it("keeps VoiceLocalApiProxyConfig assignable with a canonical audio route", () => {
    const config: VoiceLocalApiProxyConfig = normalizeVoiceLocalApiProxyConfig({
      mode: "desktop-local",
      routes: [
        {
          capabilities: [
            {
              capability: "audio-transcription",
              operationSet: ["openai.v1.audio.transcriptions.create"],
            },
          ],
          clientProtocol: "openai-compatible",
          id: "transcription",
          modelBindings: [{ capability: "audio-transcription", modelId: "whisper-1", role: "transcription" }],
          providerId: "openai",
          upstream: {
            baseUrl: "https://api.openai.com/v1",
            protocolKind: "openai-compatible",
            providerId: "openai",
          },
          upstreamProtocol: "openai-compatible",
        },
      ],
      storage: {
        dialect: "sqlite",
        sqlitePath: `C:/sdkwork/data/${VOICE_LOCAL_API_PROXY_DEFAULT_SQLITE_FILENAME}`,
      },
    });

    expect(config.routes[0]?.capabilities[0]?.capability).toBe("audio-transcription");
    expect(config.routes[0]?.modelBindings[0]?.role).toBe("transcription");
  });

  it("keeps sound-effect and music route capabilities normalized", () => {
    const config = normalizeVoiceLocalApiProxyConfig({
      routes: [
        {
          capabilities: [
            {
              capability: "audio-sound-effect",
              operationSet: ["elevenlabs.v1.sound_generation.create"],
            },
            {
              capability: "audio-music",
              operationSet: ["suno.v1.music.generations.create", "suno.v1.music.generations.retrieve"],
            },
            {
              capability: "audio-generated-video",
              operationSet: ["kling.v1.videos.generations.retrieve", "vidu.ent.v2.tasks.creations.list"],
            },
            {
              capability: "audio-generated-image",
              operationSet: [
                "nano-banana.v1.images.generations.retrieve",
                "midjourney.v1.images.generations.retrieve",
              ],
            },
          ],
          clientProtocol: "custom-http",
          id: "voice-generation-provider",
          modelBindings: [
            { capability: "audio-sound-effect", modelId: "eleven_text_to_sound_v2", role: "sound-effect" },
            { capability: "audio-music", modelId: "suno-v5", role: "music" },
          ],
          providerId: "cloud-router",
          upstream: {
            baseUrl: "http://localhost:8080",
            protocolKind: "custom-http",
            providerId: "cloud-router",
          },
          upstreamProtocol: "custom-http",
        },
      ],
      storage: {
        dialect: "sqlite",
        sqlitePath: `C:/sdkwork/data/${VOICE_LOCAL_API_PROXY_DEFAULT_SQLITE_FILENAME}`,
      },
    });

    expect(config.routes[0]?.capabilities.map((capability) => capability.capability)).toEqual([
      "audio-sound-effect",
      "audio-music",
      "audio-generated-video",
      "audio-generated-image",
    ]);
    expect(config.routes[0]?.modelBindings.map((binding) => binding.role)).toEqual(["sound-effect", "music"]);
  });
});
