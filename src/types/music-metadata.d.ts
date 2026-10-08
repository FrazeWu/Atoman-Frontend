declare module 'music-metadata' {
  interface MusicMetadataPicture {
    data: Uint8Array
    format?: string
  }

  interface MusicMetadataCommon {
    title?: string
    artist?: string
    albumartist?: string
    album?: string
    track?: { no?: number | null }
    disk?: { no?: number | null }
    picture?: MusicMetadataPicture[]
  }

  interface MusicMetadataResult {
    common: MusicMetadataCommon
  }

  export function parseBlob(blob: Blob): Promise<MusicMetadataResult>
}
