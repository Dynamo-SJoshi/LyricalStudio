/** A playable track. `videoId` is the YouTube video the IFrame player loads. */
export type Track = {
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  durationSec?: number;
  artwork?: string;
  /** "song" = YouTube Music album upload (best lyric timing), "video" = regular video */
  kind: "song" | "video";
};

export type LyricWord = {
  text: string;
  start: number; // seconds
  end: number; // seconds
  /** inside parentheses, e.g. backing vocals */
  backing?: boolean;
  /** held noticeably longer than the line's average word */
  emphasis?: boolean;
};

export type LyricLine = {
  text: string;
  start: number;
  end: number;
  words: LyricWord[];
  lang: "en" | "ja" | "hi" | "ko" | "other";
  /** romanization or translation sharing the same timestamp, shown as a subtitle */
  sub?: string;
  /** how many times this exact line appears in the song (chorus detection) */
  repeats: number;
};

export type LyricsResult = {
  source: "lrclib" | "youtube" | "lyricsovh";
  /** who provides the text, e.g. "Musixmatch" (shown with plain lyrics) */
  credit?: string;
  synced: boolean;
  wordSynced: boolean;
  /** raw LRC (synced) or plain text */
  raw: string;
  instrumental: boolean;
  matchedDuration?: number;
};

export type TrackMeta = {
  genre?: string;
  artworkHiRes?: string;
};
