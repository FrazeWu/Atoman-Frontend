import { afterEach, describe, expect, it, vi } from "vitest";
import {
  completeMusicAlbumImportFilePart,
  deleteMusicAlbumImportFile,
  getMusicAlbumImport,
  registerMusicAlbumImportFiles,
  uploadMusicAlbumImportFilePart,
} from "../../../src/api/musicV1";

describe("album import v2 API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uploads a raw part with byte progress and returns its ETag", async () => {
    class FakeXMLHttpRequest {
      static current: FakeXMLHttpRequest;
      status = 200;
      open = vi.fn();
      send = vi.fn();
      abort = vi.fn(() => this.listeners.get("abort")?.());
      getResponseHeader = vi.fn((name: string) =>
        name.toLowerCase() === "etag" ? "etag-1" : null,
      );
      private listeners = new Map<string, () => void>();
      private uploadListeners = new Map<
        string,
        (event: ProgressEvent) => void
      >();
      upload = {
        addEventListener: (
          event: string,
          listener: (event: ProgressEvent) => void,
        ) => {
          this.uploadListeners.set(event, listener);
        },
      };

      constructor() {
        FakeXMLHttpRequest.current = this;
      }

      addEventListener(event: string, listener: () => void) {
        this.listeners.set(event, listener);
      }

      emitProgress(loaded: number, total: number) {
        this.uploadListeners.get("progress")?.({
          lengthComputable: true,
          loaded,
          total,
        } as ProgressEvent);
      }

      emit(event: string) {
        this.listeners.get(event)?.();
      }
    }
    vi.stubGlobal(
      "XMLHttpRequest",
      FakeXMLHttpRequest as unknown as typeof XMLHttpRequest,
    );
    const progress = vi.fn();
    const body = new Blob(["12345678"]);

    const result = uploadMusicAlbumImportFilePart(
      "https://upload.test/part-1",
      body,
      {
        onProgress: progress,
      },
    );
    const xhr = FakeXMLHttpRequest.current;
    xhr.emitProgress(4, 8);
    xhr.emit("load");

    await expect(result).resolves.toBe("etag-1");
    expect(xhr.open).toHaveBeenCalledWith("PUT", "https://upload.test/part-1");
    expect(xhr.send).toHaveBeenCalledWith(body);
    expect(progress).toHaveBeenCalledWith({ loaded: 4, total: 8 });
  });

  it("turns a stalled raw part upload into a retryable timeout", async () => {
    class FakeXMLHttpRequest {
      static current: FakeXMLHttpRequest;
      status = 200;
      timeout = 0;
      open = vi.fn();
      send = vi.fn();
      abort = vi.fn();
      getResponseHeader = vi.fn(() => "etag-1");
      private listeners = new Map<string, () => void>();
      upload = { addEventListener: vi.fn() };

      constructor() {
        FakeXMLHttpRequest.current = this;
      }

      addEventListener(event: string, listener: () => void) {
        this.listeners.set(event, listener);
      }

      emit(event: string) {
        this.listeners.get(event)?.();
      }
    }
    vi.stubGlobal(
      "XMLHttpRequest",
      FakeXMLHttpRequest as unknown as typeof XMLHttpRequest,
    );

    const result = uploadMusicAlbumImportFilePart(
      "https://upload.test/part-1",
      new Blob(["data"]),
      {
        timeoutMs: 123,
      },
    );
    const xhr = FakeXMLHttpRequest.current;
    expect(xhr.timeout).toBe(123);
    xhr.emit("timeout");

    await expect(result).rejects.toThrow("上传分片超时，请重试");
  });
  it("normalizes nullable import arrays before consumers receive a snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              importId: "import-1",
              status: "queued",
              derivedTracks: null,
              files: null,
              errors: null,
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const snapshot = await getMusicAlbumImport("import-1");

    expect(snapshot.derivedTracks).toEqual([]);
    expect(snapshot.files).toEqual([]);
    expect(snapshot.errors).toEqual([]);
  });

  it("normalizes nullable arrays returned by file registration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              importId: "import-1",
              status: "uploading",
              files: null,
              derivedTracks: null,
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const snapshot = await registerMusicAlbumImportFiles("import-1", {
      files: [],
    });

    expect(snapshot.files).toEqual([]);
    expect(snapshot.derivedTracks).toEqual([]);
  });

  it("returns the completed file instead of treating it as an import snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              fileId: "file-1",
              fileName: "track.flac",
              uploadStatus: "uploading",
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const file = await completeMusicAlbumImportFilePart(
      "import-1",
      "file-1",
      1,
      "etag-1",
      1024,
    );

    expect(file.fileId).toBe("file-1");
    expect(file.uploadStatus).toBe("uploading");
  });

  it("accepts an empty successful response when deleting an import file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await expect(
      deleteMusicAlbumImportFile("import-1", "file-1"),
    ).resolves.toBeUndefined();
  });
});
