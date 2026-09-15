// WORKSPACE-PATH:allow-fixture: fixtures name a foreign checkout root, drive, or home directory to exercise path handling, so the literal is the value under assertion rather than a binding this build resolves
import assert from 'node:assert/strict';
import { test } from 'vitest';

import { configureMyVoiceSdkPorts, resetMyVoiceSdkPorts } from '../runtime/myVoiceSdkPorts';
import type { MyVoiceProfilesClient } from '../runtime/myVoiceSdkPorts';
import type { MyVoiceMediaSample } from '../types/myVoice';
import {
  createMyVoice,
  deleteMyVoice,
  listMyVoices,
  mapMyVoiceProfile,
  MyVoiceCapabilityUnavailableError,
  resolveMyVoicePlaybackUrl,
  retrieveMyVoice,
  updateMyVoice,
  uploadMyVoiceSample,
} from './myVoiceService';

function fakeClient(overrides: Partial<MyVoiceProfilesClient['voice']['voiceProfiles']> = {}): MyVoiceProfilesClient {
  const profiles: MyVoiceProfilesClient['voice']['voiceProfiles'] = {
    list: async () => ({ items: [], pageInfo: { hasMore: false, page: 1, pageSize: 20 } }),
    retrieve: async () => ({ item: {} }),
    create: async () => ({ item: {} }),
    update: async () => ({ item: {} }),
    delete: async () => ({ deleted: true }),
    ...overrides,
  };
  return { voice: { voiceProfiles: profiles } };
}

function wirePorts(client: MyVoiceProfilesClient, sample?: MyVoiceMediaSample): void {
  configureMyVoiceSdkPorts({
    getVoiceClient: () => client,
    uploadAudioSample: async () => sample ?? { source: 'drive', uri: 'drive://s/n' },
    resolveMediaPlaybackUrl: async () => 'https://media.example/play.wav',
  });
}

test('mapMyVoiceProfile normalizes wire records and drops invalid items', () => {
  assert.equal(mapMyVoiceProfile({}), null);
  assert.equal(mapMyVoiceProfile({ id: '   ' }), null);
  const profile = mapMyVoiceProfile({
    id: '42',
    profileNo: 'vp-1',
    name: ' 温柔女声 ',
    description: null,
    kind: 'cloned',
    status: 'ready',
    durationSeconds: 12.5,
    sampleMedia: { url: 'https://a.example/x.mp3' },
    createdAt: '2026-08-10T00:00:00Z',
  });
  assert.ok(profile);
  assert.equal(profile!.name, '温柔女声');
  assert.equal(profile!.description, null);
  assert.equal(profile!.durationSeconds, 12.5);
});

test('listMyVoices maps items and pagination from the SDK page', async () => {
  wirePorts(
    fakeClient({
      list: async () => ({
        items: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }],
        pageInfo: { hasMore: true, page: 1, pageSize: 20 },
      }),
    }),
  );
  const page = await listMyVoices({ page: 1, pageSize: 20 });
  assert.equal(page.items.length, 2);
  assert.equal(page.items[0].name, 'A');
  assert.equal(page.hasMore, true);
  assert.equal(page.page, 1);
});

test('listMyVoices clamps page size to the SDK maximum', async () => {
  const calls: Array<{ page?: number; pageSize?: number }> = [];
  wirePorts(
    fakeClient({
      list: async (params) => {
        calls.push(params ?? {});
        return { items: [], pageInfo: { hasMore: false } };
      },
    }),
  );
  await listMyVoices({ page: 0, pageSize: 9999 });
  assert.equal(calls[0].page, 1);
  assert.equal(calls[0].pageSize, 200);
});

test('createMyVoice posts a normalized command and returns the mapped profile', async () => {
  const received: { body: Record<string, unknown> | null } = { body: null };
  wirePorts(
    fakeClient({
      create: async (body) => {
        received.body = body;
        return { item: { id: '9', name: '我的克隆', sampleMedia: { source: 'drive' } } };
      },
    }),
  );
  const profile = await createMyVoice({
    name: '我的克隆',
    description: '描述',
    kind: 'cloned',
    sampleMedia: { source: 'drive', uri: 'drive://s/n' },
    durationSeconds: 30,
  });
  assert.equal(profile.id, '9');
  assert.equal(profile.name, '我的克隆');
  assert.deepEqual(received.body?.name, '我的克隆');
  assert.equal(received.body?.durationSeconds, 30);
});

test('updateMyVoice sends only provided fields', async () => {
  const received: { body: Record<string, unknown> | null } = { body: null };
  wirePorts(
    fakeClient({
      update: async (_id, body) => {
        received.body = body ?? {};
        return { item: { id: '9', name: '新名字' } };
      },
    }),
  );
  const profile = await updateMyVoice('9', { name: '新名字' });
  assert.equal(profile.name, '新名字');
  assert.deepEqual(Object.keys(received.body ?? {}), ['name']);
});

test('retrieveMyVoice unwraps the item envelope', async () => {
  wirePorts(
    fakeClient({
      retrieve: async () => ({ item: { id: '7', name: '详情' } }),
    }),
  );
  const profile = await retrieveMyVoice('7');
  assert.equal(profile?.id, '7');
});

test('deleteMyVoice resolves void success', async () => {
  let deletedId = '';
  wirePorts(
    fakeClient({
      delete: async (profileId) => {
        deletedId = profileId;
        return { deleted: true };
      },
    }),
  );
  await deleteMyVoice('7');
  assert.equal(deletedId, '7');
});

test('uploadMyVoiceSample delegates to the host media port', async () => {
  wirePorts(fakeClient(), { source: 'drive', uri: 'drive://spaces/1/nodes/2' });
  const sample = await uploadMyVoiceSample(new Blob(['audio'], { type: 'audio/wav' }), {
    fileName: 'sample.wav',
  });
  assert.equal(sample.uri, 'drive://spaces/1/nodes/2');
});

test('resolveMyVoicePlaybackUrl prefers embedded URLs then the host grant port', async () => {
  wirePorts(fakeClient());
  const direct = await resolveMyVoicePlaybackUrl({
    id: '1',
    profileNo: '',
    name: 'x',
    description: null,
    kind: 'cloned',
    status: 'ready',
    voiceId: null,
    providerCode: null,
    sampleMedia: { url: 'https://direct.example/a.mp3' },
    durationSeconds: null,
    createdAt: '',
    updatedAt: '',
  });
  assert.equal(direct, 'https://direct.example/a.mp3');

  const granted = await resolveMyVoicePlaybackUrl({
    id: '2',
    profileNo: '',
    name: 'x',
    description: null,
    kind: 'cloned',
    status: 'ready',
    voiceId: null,
    providerCode: null,
    sampleMedia: { source: 'drive', uri: 'drive://s/n' },
    durationSeconds: null,
    createdAt: '',
    updatedAt: '',
  });
  assert.equal(granted, 'https://media.example/play.wav');
});

test('services fail closed when ports are not composed', async () => {
  resetMyVoiceSdkPorts();
  await assert.rejects(listMyVoices(), MyVoiceCapabilityUnavailableError);
  await assert.rejects(
    uploadMyVoiceSample(new Blob([])),
    MyVoiceCapabilityUnavailableError,
  );
});
