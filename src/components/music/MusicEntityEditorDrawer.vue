<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { Disc3, FileAudio, Upload } from "lucide-vue-next";
import {
  convertMusicSongToAlbum,
  getMusicSongDetail,
  queueMusicSongAudioReplacement,
  submitSongRevision,
  uploadMusicAsset,
  uploadMusicAssetWithProgress,
  type MusicSource,
  type MusicStandaloneSongType,
} from "@/api/musicV1";
import MusicCreationContributorPicker from "@/components/music/MusicCreationContributorPicker.vue";
import PMaskedDateInput from "@/components/ui/PMaskedDateInput.vue";
import PButton from "@/components/ui/PButton.vue";
import PInput from "@/components/ui/PInput.vue";
import PSelect from "@/components/ui/PSelect.vue";
import PSheet from "@/components/ui/PSheet.vue";
import PTextarea from "@/components/ui/PTextarea.vue";
import {
  parsePartialDateParts,
  serializePartialDate,
} from "@/components/music/birthDateMask";
import { useMusicDrawers } from "@/composables/useMusicDrawers";
import { reportError } from "@/utils/logger";
import {
  albumArtistCreditsFromContributors,
  hasValidAlbumContributors,
} from "@/utils/musicAlbumCredits";
import type {
  MusicCreationAlbumContributorDraft,
  MusicCreationDatePartsDraft,
} from "./musicCreationTypes";
import type { MusicSheetLayer } from "./musicSheetTypes";

type EditorLayer = Extract<MusicSheetLayer, { kind: "editor" }>;

const props = withDefaults(
  defineProps<{
    layer?: EditorLayer;
    layerIndex?: number;
    stackSize?: number;
  }>(),
  {
    layerIndex: 0,
    stackSize: 1,
  },
);

const router = useRouter();
const {
  state,
  closeMusicEditor,
  refreshAlbum,
  refreshArtist,
  refreshSong,
  closeMusicCreationFlow,
  openMusicCreationFlow,
  isLayerActive,
  isLayerShifted,
  isTopLayer,
  returnToLayer,
} = useMusicDrawers();

const editor = computed(() => props.layer?.payload ?? state.value.musicEditor);
const isOpen = computed(() =>
  props.layer ? isLayerActive(props.layer.key) : editor.value !== null,
);
const isSongEditor = computed(
  () => editor.value?.entity === "song" && editor.value.mode === "edit",
);
const sheetIndex = computed(() => {
  if (props.layer) return props.layerIndex;
  let count = 0;
  if (state.value.artistId !== null) count += 1;
  if (state.value.albumId !== null) count += 1;
  return count;
});
const shifted = computed(() =>
  props.layer ? isLayerShifted(props.layer.key) : false,
);
const topLayer = computed(() =>
  props.layer ? isTopLayer(props.layer.key) : true,
);
let audioUploadController: AbortController | null = null;
let songCoverObjectURL = "";

const songLoading = ref(false);
const songSubmitting = ref(false);
const songErrorMessage = ref("");
const standaloneSong = ref(false);
const parentAlbum = ref<{ id: string; title: string } | null>(null);
const coverInput = ref<HTMLInputElement | null>(null);
const audioInput = ref<HTMLInputElement | null>(null);
const songDraft = reactive({
  title: "",
  description: "",
  releaseType: "single" as MusicStandaloneSongType | string,
  releaseDateParts: {
    year: "",
    month: "",
    day: "",
  } as MusicCreationDatePartsDraft,
  source: "",
  coverUrl: "",
  coverFile: null as File | null,
  audioFile: null as File | null,
  contributors: [] as MusicCreationAlbumContributorDraft[],
});

const releaseTypeOptions = [
  { label: "专辑", value: "album" },
  { label: "EP", value: "ep" },
  { label: "单曲", value: "single" },
  { label: "泄曲", value: "leak" },
  { label: "混音带", value: "mixtape" },
  { label: "精选集", value: "compilation" },
  { label: "原声带", value: "soundtrack" },
  { label: "现场专辑", value: "live" },
  { label: "重混专辑", value: "remix" },
  { label: "Demo", value: "demo" },
];
const convertingToAlbum = computed(
  () =>
    standaloneSong.value && !["single", "leak"].includes(songDraft.releaseType),
);
const submitLabel = computed(() =>
  convertingToAlbum.value ? "保存并转为专辑" : "保存歌曲",
);

watch(
  editor,
  async (value) => {
    resetSongState();
    if (value?.entity !== "song" || value.mode !== "edit" || !value.id) return;
    closeMusicCreationFlow();
    await loadSong(value.id);
  },
  { immediate: true },
);

function resetSongState() {
  songLoading.value = false;
  songSubmitting.value = false;
  songErrorMessage.value = "";
  standaloneSong.value = false;
  parentAlbum.value = null;
  songDraft.title = "";
  songDraft.description = "";
  songDraft.releaseType = "single";
  songDraft.releaseDateParts = { year: "", month: "", day: "" };
  songDraft.source = "";
  songDraft.coverUrl = "";
  songDraft.coverFile = null;
  songDraft.audioFile = null;
  songDraft.contributors = [];
  revokeSongCoverPreview();
}

function revokeSongCoverPreview() {
  if (!songCoverObjectURL) return;
  URL.revokeObjectURL(songCoverObjectURL);
  songCoverObjectURL = "";
}

onBeforeUnmount(() => {
  audioUploadController?.abort();
  revokeSongCoverPreview();
});

function musicSourceValue(sources?: MusicSource[]) {
  const source = sources?.find(
    (item) => item.url?.trim() || item.title?.trim(),
  );
  return source?.url?.trim() || source?.title?.trim() || "";
}

function buildSource(value: string): MusicSource {
  const normalized = value.trim();
  return /^https?:\/\//i.test(normalized)
    ? { type: "url", url: normalized }
    : { type: "text", title: normalized };
}

async function loadSong(songId: string) {
  songLoading.value = true;
  try {
    const detail = await getMusicSongDetail(songId);
    standaloneSong.value =
      detail.song.release_type === "single" ||
      detail.song.release_type === "leak";
    parentAlbum.value = detail.song.album?.id
      ? { id: String(detail.song.album.id), title: detail.song.album.title }
      : null;
    songDraft.title = detail.song.title;
    songDraft.description = detail.song.description ?? "";
    songDraft.releaseType = detail.song.release_type ?? "single";
    songDraft.releaseDateParts = parsePartialDateParts(
      detail.song.release_date ?? "",
    );
    songDraft.source = musicSourceValue(detail.song.sources);
    songDraft.coverUrl =
      detail.song.cover_url ?? detail.song.album?.cover_url ?? "";
    const contributors = new Map<string, MusicCreationAlbumContributorDraft>();
    for (const credit of detail.artists) {
      const current = contributors.get(credit.id) ?? {
        id: `song-contributor-${credit.id}`,
        artistId: credit.id,
        name: credit.name,
        avatarUrl: "",
        kind: "person" as const,
        locked: false,
        roles: [],
      };
      current.roles.push({
        id: `song-role-${credit.id}-${credit.role}-${credit.custom_role ?? ""}`,
        role: credit.role,
        label: credit.custom_role ?? "",
      });
      contributors.set(credit.id, current);
    }
    songDraft.contributors = [...contributors.values()];
  } catch (error) {
    reportError(error, "Failed to load song:");
    songErrorMessage.value = "加载歌曲失败";
  } finally {
    songLoading.value = false;
  }
}

function selectSongCover(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  songDraft.coverFile = file;
  revokeSongCoverPreview();
  if (file) {
    songCoverObjectURL = URL.createObjectURL(file);
    songDraft.coverUrl = songCoverObjectURL;
  }
}

function selectSongAudio(event: Event) {
  songDraft.audioFile = (event.target as HTMLInputElement).files?.[0] ?? null;
}

function hasValidTrackContributors() {
  return songDraft.contributors.every(
    (contributor) =>
      contributor.name.trim() &&
      contributor.roles.length > 0 &&
      contributor.roles.every(
        (role) => role.role !== "custom" || role.label.trim(),
      ),
  );
}

function openParentAlbumEditor() {
  const album = parentAlbum.value;
  if (!album) return;
  closeMusicEditor(props.layer?.key);
  openMusicCreationFlow({
    mode: "edit",
    entity: "album",
    albumId: album.id,
    startStep: "albumDetails",
  });
}

function validateSongDraft() {
  if (!songDraft.title.trim()) return "请填写歌曲名";
  if (!hasValidTrackContributors()) return "请补全创作者身份";
  if (standaloneSong.value) {
    if (!songDraft.coverUrl.trim()) return "请上传歌曲封面";
    if (!serializePartialDate(songDraft.releaseDateParts))
      return "请填写发行日期";
    if (!songDraft.source.trim()) return "请填写资料来源";
    if (
      ["single", "leak"].includes(songDraft.releaseType) &&
      !hasValidAlbumContributors(songDraft.contributors)
    ) {
      return "请保留一位主艺术家";
    }
  }
  return "";
}

async function uploadSelectedAudio() {
  if (!songDraft.audioFile) return null;
  audioUploadController = new AbortController();
  return uploadMusicAssetWithProgress(songDraft.audioFile, "music.audio", {
    signal: audioUploadController.signal,
    timeoutMs: 5 * 60 * 1000,
  }).finally(() => {
    audioUploadController = null;
  });
}

async function handleSongEditSubmit() {
  const current = editor.value;
  if (
    !current ||
    current.entity !== "song" ||
    current.mode !== "edit" ||
    !current.id
  )
    return;
  const validationMessage = validateSongDraft();
  if (validationMessage) {
    songErrorMessage.value = validationMessage;
    return;
  }

  songSubmitting.value = true;
  songErrorMessage.value = "";
  let metadataSaved = false;
  let convertedToAlbum = false;
  try {
    const coverAsset = songDraft.coverFile
      ? await uploadMusicAsset(songDraft.coverFile, "music.cover")
      : null;
    const audioAsset = await uploadSelectedAudio();
    const artistCredits = albumArtistCreditsFromContributors(
      songDraft.contributors,
    );
    const sources = songDraft.source.trim()
      ? [buildSource(songDraft.source)]
      : [];
    const releaseDate = serializePartialDate(songDraft.releaseDateParts);

    if (convertingToAlbum.value) {
      const converted = await convertMusicSongToAlbum(current.id, {
        title: songDraft.title.trim(),
        description: songDraft.description.trim(),
        release_date: releaseDate,
        release_type: songDraft.releaseType,
        cover_url: coverAsset?.url ?? songDraft.coverUrl,
        artist_credits: artistCredits,
        sources,
      });
      metadataSaved = true;
      convertedToAlbum = true;
      if (audioAsset?.id) {
        await queueMusicSongAudioReplacement(current.id, {
          asset_id: audioAsset.id,
        });
      }
      refreshArtist();
      refreshAlbum();
      refreshSong();
      closeMusicEditor(props.layer?.key);
      await router.replace(`/music/album/${converted.id}`);
      return;
    }

    await submitSongRevision(current.id, {
      title: songDraft.title.trim(),
      description: songDraft.description.trim(),
      ...(standaloneSong.value
        ? {
            release_type: songDraft.releaseType as MusicStandaloneSongType,
            release_date: releaseDate,
          }
        : {}),
      ...(coverAsset ? { cover: coverAsset } : {}),
      artist_credits: artistCredits,
      sources,
      reason: "编辑歌曲",
    });
    metadataSaved = true;
    if (audioAsset?.id) {
      await queueMusicSongAudioReplacement(current.id, {
        asset_id: audioAsset.id,
      });
    }
    refreshArtist();
    refreshSong();
    closeMusicEditor(props.layer?.key);
  } catch (error) {
    reportError(error, "Failed to save song:");
    if (metadataSaved) {
      refreshArtist();
      refreshAlbum();
      refreshSong();
      if (convertedToAlbum) await loadSong(current.id);
      songErrorMessage.value = "歌曲资料已保存，但音频替换提交失败，请重试";
    } else {
      songErrorMessage.value = "保存失败，请稍后重试";
    }
  } finally {
    songSubmitting.value = false;
  }
}
</script>

<template>
  <PSheet
    above-player
    :show="isOpen"
    title="编辑歌曲"
    content-max-width="64rem"
    :index="sheetIndex"
    :layer-index="layerIndex"
    :stack-size="stackSize"
    :is-shifted="shifted"
    :is-top-layer="topLayer"
    close-type="header"
    panel-class="entity-editor-drawer"
    @close="closeMusicEditor(props.layer?.key)"
    @activate="props.layer && returnToLayer(props.layer.key)"
  >
    <div v-if="isSongEditor" class="song-editor" data-testid="song-editor">
      <p v-if="songErrorMessage" class="song-editor__error">
        {{ songErrorMessage }}
      </p>
      <p v-else-if="songLoading" class="song-editor__state">
        正在加载歌曲资料...
      </p>
      <template v-else>
        <div v-if="parentAlbum" class="song-editor__album-context">
          <div>
            <span>所属专辑</span>
            <strong>{{ parentAlbum.title }}</strong>
          </div>
          <PButton variant="secondary" @click="openParentAlbumEditor">
            <Disc3 :size="16" aria-hidden="true" />编辑整张专辑
          </PButton>
        </div>

        <div class="song-editor__layout">
          <section class="song-editor__cover-field">
            <img
              v-if="songDraft.coverUrl"
              :src="songDraft.coverUrl"
              alt="歌曲封面"
              class="song-editor__cover"
            />
            <div v-else class="song-editor__cover song-editor__cover--empty">
              封面
            </div>
            <input
              ref="coverInput"
              class="song-editor__file-input"
              type="file"
              accept="image/*"
              @change="selectSongCover"
            />
            <PButton
              variant="secondary"
              title="选择歌曲封面"
              @click="coverInput?.click()"
            >
              <Upload :size="16" aria-hidden="true" />选择封面
            </PButton>
          </section>

          <div class="song-editor__fields">
            <div class="song-editor__basic-fields">
              <PInput
                v-model="songDraft.title"
                label="歌曲名"
                placeholder="输入歌曲名"
                data-testid="song-editor-title"
              />
              <template v-if="standaloneSong">
                <PMaskedDateInput
                  v-model="songDraft.releaseDateParts"
                  label="发行日期"
                  test-id="song-editor-release-date"
                />
                <PSelect
                  v-model="songDraft.releaseType"
                  label="类型"
                  :options="releaseTypeOptions"
                  data-testid="song-editor-release-type"
                />
              </template>
            </div>
            <PTextarea
              v-model="songDraft.description"
              :rows="3"
              label="简介"
              placeholder="补充歌曲简介"
              data-testid="song-editor-description"
            />
          </div>
        </div>

        <section class="song-editor__contributors">
          <span>创作者</span>
          <MusicCreationContributorPicker v-model="songDraft.contributors" />
        </section>

        <PInput
          v-model="songDraft.source"
          :label="standaloneSong ? '资料来源' : '歌曲来源（选填）'"
          placeholder="输入来源链接或说明"
          data-testid="song-editor-source"
        />

        <section class="song-editor__audio">
          <input
            ref="audioInput"
            class="song-editor__file-input"
            type="file"
            accept="audio/*"
            @change="selectSongAudio"
          />
          <PButton
            variant="secondary"
            title="选择替换音频"
            @click="audioInput?.click()"
          >
            <FileAudio :size="16" aria-hidden="true" />替换音频
          </PButton>
          <span>{{ songDraft.audioFile?.name || "未选择文件" }}</span>
        </section>

        <div class="song-editor__actions">
          <PButton
            variant="secondary"
            :disabled="songSubmitting"
            @click="closeMusicEditor(props.layer?.key)"
            >取消</PButton
          >
          <PButton
            variant="warning"
            :loading="songSubmitting"
            loading-text="正在保存..."
            @click="handleSongEditSubmit"
            >{{ submitLabel }}</PButton
          >
        </div>
      </template>
    </div>
  </PSheet>
</template>

<style scoped>
.song-editor {
  container: song-editor / inline-size;
  display: grid;
  gap: 1rem;
}
.song-editor__error {
  margin: 0;
  color: var(--a-color-accent-destructive);
  font-size: 0.92rem;
}
.song-editor__state {
  margin: 0;
  color: var(--a-color-muted);
  font-size: 0.95rem;
}
.song-editor__album-context {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--a-color-border-soft);
}
.song-editor__album-context > div {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.song-editor__album-context span,
.song-editor__audio span,
.song-editor__contributors > span {
  color: var(--a-color-muted);
  font-size: 0.85rem;
}
.song-editor__album-context strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.song-editor__layout {
  display: grid;
  grid-template-columns: minmax(11rem, 15rem) minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}
.song-editor__cover-field {
  display: grid;
  gap: 0.65rem;
}
.song-editor__cover {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 6px;
  background: var(--a-color-bg-subtle);
}
.song-editor__cover--empty {
  display: grid;
  place-items: center;
  color: var(--a-color-muted);
}
.song-editor__fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(14rem, 1fr);
  gap: 1rem;
}
.song-editor__basic-fields {
  display: grid;
  gap: 0.75rem;
  align-content: start;
}
.song-editor__contributors {
  display: grid;
  gap: 0.55rem;
}
.song-editor__audio {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}
.song-editor__audio span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.song-editor__file-input {
  display: none;
}
.song-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

@container song-editor (max-width: 48rem) {
  .song-editor__layout {
    grid-template-columns: 1fr;
  }
  .song-editor__cover-field {
    max-width: 15rem;
  }
}
@container song-editor (max-width: 34rem) {
  .song-editor__fields {
    grid-template-columns: 1fr;
  }
  .song-editor__album-context {
    align-items: flex-start;
    flex-direction: column;
  }
  .song-editor__audio {
    align-items: flex-start;
    flex-direction: column;
  }
}

:global(.entity-editor-drawer) {
  background: var(--a-color-bg) !important;
  border-left: 1px solid var(--a-color-border-soft) !important;
  box-shadow: none !important;
}
:root.dark :global(.entity-editor-drawer) {
  background: var(--a-color-bg) !important;
  border-left: 1px solid var(--a-color-border-dark, #334155) !important;
}
</style>
