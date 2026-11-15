/**
 * Publicly visible, source-checked editorial context for a deliberately small
 * set of songs. This does not overwrite the user-editable music wiki.
 *
 * Editorial copy must be original: never paste lyrics or provider descriptions.
 * Show the same note to visitors and server-rendered search crawlers.
 */
export interface SongEditorialSource {
  label: string
  href: string
}

export function canShowSongEditorialNote(song: {
  description?: string | null
  lifecycle_status?: string | null
  status?: string | null
  entry_status?: string | null
}) {
  if (song.description?.trim()) return false
  if (song.lifecycle_status !== 'active') return false
  return (song.entry_status || song.status) === 'open'
}

export interface SongEditorialNote {
  expectedTitle: string
  expectedAlbumId: string
  text: string
  sources: readonly SongEditorialSource[]
}

const productionCredits = {
  label: 'Pitchfork · 《DAMN.》完整制作名单',
  href: 'https://pitchfork.com/news/72695-kendrick-lamars-new-album-damn-the-full-credits/',
}

const notes: Readonly<Record<string, SongEditorialNote>> = {
  '01a07774-5cc3-7d3a-af30-6611899f00fc': {
    expectedTitle: 'DNA.',
    expectedAlbumId: '01a06b7f-0330-7f31-a440-b666a9722289',
    text: '《DNA.》位于 Kendrick Lamar 2017 年专辑《DAMN.》的第二首。歌曲由 Mike WiLL Made-It 制作，制作名单还记录了 Matt Schaeffer 的吉他演奏。Apple Music 的专辑介绍将它列为整张唱片身份表达主题的代表曲目之一。',
    sources: [
      { label: 'Apple Music · DNA.', href: 'https://music.apple.com/us/song/1440881357' },
      productionCredits,
    ],
  },
  '01a07774-5cb4-7c6f-b5df-841db6db86a2': {
    expectedTitle: 'HUMBLE.',
    expectedAlbumId: '01a06b7f-0330-7f31-a440-b666a9722289',
    text: '《HUMBLE.》在 2017 年 3 月 30 日发行，后来收录于《DAMN.》的第八首。制作名单列出 Mike WiLL Made-It，Matt Schaeffer 参与吉他演奏。歌曲首次发行时间早于《DAMN.》于 4 月 14 日发行的日期，两者需要区别记录。',
    sources: [
      { label: 'Apple Music · HUMBLE.', href: 'https://music.apple.com/us/song/1440881684' },
      productionCredits,
    ],
  },
  '01a07774-5cea-71fd-b4f2-1d5058157f3f': {
    expectedTitle: 'ELEMENT.',
    expectedAlbumId: '01a06b7f-0330-7f31-a440-b666a9722289',
    text: '《ELEMENT.》是《DAMN.》的第四首，位于《YAH.》和《FEEL.》之间。公开制作名单列出 Bekon、James Blake、Ricci Riera、Sounwave 及 Tae Beast，Kid Capri 则提供额外人声。这些曲目层级的制作信息不同于整张专辑的主要演唱者名单。',
    sources: [
      { label: 'Apple Music · ELEMENT.', href: 'https://music.apple.com/us/song/1440881367' },
      productionCredits,
    ],
  },
  '01a07774-5ce2-734c-bb0f-d5c4f76141e8': {
    expectedTitle: 'PRIDE.',
    expectedAlbumId: '01a06b7f-0330-7f31-a440-b666a9722289',
    text: '《PRIDE.》收录于《DAMN.》第七首。Steve Lacy 与 Bekon、Anthony Tiffith 参与制作；Anna Wise 和 Steve Lacy 还在完整制作名单中列为和声参与者。这首歌的制作人与人声贡献，为专辑曲目资料补充了更具体的署名信息。',
    sources: [
      { label: 'Apple Music · PRIDE.', href: 'https://music.apple.com/us/song/1440881578' },
      productionCredits,
    ],
  },
  '01a07774-5cd5-7394-ac29-df24632a1588': {
    expectedTitle: 'LOYALTY. (feat. Rihanna)',
    expectedAlbumId: '01a06b7f-0330-7f31-a440-b666a9722289',
    text: '《LOYALTY.》是《DAMN.》的第六首，邀请 Rihanna 参与演唱。制作名单列出 Terrace Martin、Sounwave、DJ Dahi 和 Anthony Tiffith。按照专辑曲目顺序，它处于《FEEL.》与《PRIDE.》之间，属于专辑明确署名合作艺人的作品。',
    sources: [
      { label: 'Apple Music · LOYALTY.', href: 'https://music.apple.com/us/song/1440881570' },
      productionCredits,
    ],
  },
  '01a07774-5d0a-70cd-a832-70943fb3acc0': {
    expectedTitle: 'FEEL.',
    expectedAlbumId: '01a06b7f-0330-7f31-a440-b666a9722289',
    text: '《FEEL.》位于《DAMN.》第五首，由 Sounwave 制作。公开制作名单还记录了 Thundercat 的贝斯演奏、Chelsea Blythe 的额外人声，以及 Matt Schaeffer 的吉他演奏。它的歌曲资料因此不应仅限于主要演唱者 Kendrick Lamar。',
    sources: [
      { label: 'Apple Music · FEEL.', href: 'https://music.apple.com/us/song/1440881374' },
      productionCredits,
    ],
  },
}

export function getSongEditorialNote(
  songId: string,
  currentTitle: string,
  currentAlbumId: string,
): SongEditorialNote | undefined {
  const note = notes[songId.trim().toLowerCase()]
  if (!note || note.expectedTitle !== currentTitle.trim() ||
      note.expectedAlbumId !== currentAlbumId.trim().toLowerCase()) return undefined
  return note
}
