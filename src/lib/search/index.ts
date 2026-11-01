import "server-only";
import type { Track } from "@/lib/types";
import * as ytm from "@/lib/search/youtube-music";
import { QuotaExceededError, getRadioOfficial, searchTracksOfficial } from "@/lib/search/youtube-data-api";

/**
 * Picks the search backend from the environment:
 * - YOUTUBE_API_KEY set: search uses the official YouTube Data API v3.
 * - YOUTUBEI_ENABLED=false: the unofficial YouTube Music client (youtubei.js) is never
 *   used. That turns off the YouTube Music home feed, playlists and YouTube Music lyrics.
 *   Recommended for public deployments.
 * With neither variable set, everything goes through youtubei.js (fine for running locally).
 */
export const youtubeiEnabled = process.env.YOUTUBEI_ENABLED !== "false";
const officialEnabled = Boolean(process.env.YOUTUBE_API_KEY);

export class SearchUnavailableError extends Error {}

export async function searchTracks(query: string, kind: Track["kind"] = "song"): Promise<Track[]> {
  if (officialEnabled) {
    try {
      return await searchTracksOfficial(query, kind);
    } catch (err) {
      if (!youtubeiEnabled) {
        throw new SearchUnavailableError(
          err instanceof QuotaExceededError
            ? "Today's search limit has been reached. Try again tomorrow."
            : "Search is unavailable right now. Try again.",
        );
      }
      console.warn("official search failed, falling back to youtubei.js", err);
    }
  }
  if (!youtubeiEnabled) throw new SearchUnavailableError("Search isn't configured on this server.");
  return ytm.searchTracks(query, kind);
}

/** Songs related to a track, for "Up next" and "Made for you". */
export async function getRadio(videoId: string, artist?: string): Promise<Track[]> {
  // YouTube Music's automix is free and truly "related"; the official API costs a search
  if (youtubeiEnabled) {
    try {
      return await ytm.getRadio(videoId);
    } catch (err) {
      if (!officialEnabled || !artist) throw err;
    }
  }
  if (officialEnabled && artist) return getRadioOfficial({ videoId, artist });
  return [];
}

export async function getHomeSections(): Promise<ytm.HomeSection[]> {
  return youtubeiEnabled ? ytm.getHomeSections() : [];
}

export async function getPlaylistTracks(id: string): Promise<Track[]> {
  return youtubeiEnabled ? ytm.getPlaylistTracks(id) : [];
}

export async function getYouTubeLyrics(videoId: string) {
  return youtubeiEnabled ? ytm.getYouTubeLyrics(videoId) : null;
}
