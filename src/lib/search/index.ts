import "server-only";
import type { Track } from "@/lib/types";
import * as ytm from "@/lib/search/youtube-music";
import { sortByRelevance } from "@/lib/search/relevance";
import {
  ClientBudgetExceededError,
  QuotaExceededError,
  getRadioOfficial,
  searchCatalogOfficial,
  searchTracksOfficial,
} from "@/lib/search/youtube-data-api";

/**
 * Picks the search backend from the environment:
 * - YOUTUBE_API_KEY set: search uses the official YouTube Data API v3.
 * - YOUTUBEI_ENABLED=false: the unofficial YouTube Music client (youtubei.js) is never
 *   used. That turns off the YouTube Music home feed and playlists.
 *   Recommended for public deployments.
 * With neither variable set, everything goes through youtubei.js (fine for running locally).
 */
export const youtubeiEnabled = process.env.YOUTUBEI_ENABLED !== "false";
const officialEnabled = Boolean(process.env.YOUTUBE_API_KEY);

export class SearchUnavailableError extends Error {}

/** `clientId` (the visitor's IP) meters each visitor's share of the official API quota. */
export async function searchTracks(query: string, kind: Track["kind"], clientId: string): Promise<Track[]> {
  if (officialEnabled) {
    try {
      const officialTracks = await searchTracksOfficial(query, kind, clientId);
      return sortByRelevance(officialTracks, query);
    } catch (err) {
      if (!youtubeiEnabled) {
        throw new SearchUnavailableError(
          err instanceof ClientBudgetExceededError
            ? "You've reached today's search limit. Try again tomorrow, or play something from Home."
            : err instanceof QuotaExceededError
              ? "Today's search limit has been reached. Try again tomorrow."
              : "Search is unavailable right now. Try again.",
        );
      }
      console.warn("official search failed, falling back to youtubei.js", err);
    }
  }
  if (!youtubeiEnabled) throw new SearchUnavailableError("Search isn't configured on this server.");
  const tracks = await ytm.searchTracks(query, kind);
  return sortByRelevance(tracks, query);
}

export type SearchCatalogResult = ytm.SearchCatalogResult;

export async function searchCatalog(query: string, clientId: string): Promise<SearchCatalogResult> {
  let result: SearchCatalogResult;
  if (officialEnabled) {
    try {
      result = await searchCatalogOfficial(query, clientId);
      return {
        songs: sortByRelevance(result.songs, query),
        videos: sortByRelevance(result.videos, query),
      };
    } catch (err) {
      if (!youtubeiEnabled) {
        throw new SearchUnavailableError(
          err instanceof ClientBudgetExceededError
            ? "You've reached today's search limit. Try again tomorrow, or play something from Home."
            : err instanceof QuotaExceededError
              ? "Today's search limit has been reached. Try again tomorrow."
              : "Search is unavailable right now. Try again.",
        );
      }
      console.warn("official search failed, falling back to youtubei.js", err);
    }
  }
  if (!youtubeiEnabled) throw new SearchUnavailableError("Search isn't configured on this server.");
  result = await ytm.searchCatalog(query);
  return {
    songs: sortByRelevance(result.songs, query),
    videos: sortByRelevance(result.videos, query),
  };
}

/** Songs related to a track, for "Up next" and "Made for you". */
export async function getRadio(videoId: string, clientId: string, artist?: string): Promise<Track[]> {
  // YouTube Music's automix is free and truly "related"; the official API costs a search
  if (youtubeiEnabled) {
    try {
      return await ytm.getRadio(videoId);
    } catch (err) {
      if (!officialEnabled || !artist) throw err;
    }
  }
  if (officialEnabled && artist) {
    try {
      return await getRadioOfficial({ videoId, artist }, clientId);
    } catch (err) {
      if (err instanceof ClientBudgetExceededError || err instanceof QuotaExceededError) return [];
      throw err;
    }
  }
  return [];
}

export async function getHomeSections(): Promise<ytm.HomeSection[]> {
  return youtubeiEnabled ? ytm.getHomeSections() : [];
}

export async function getPlaylistTracks(id: string): Promise<Track[]> {
  return youtubeiEnabled ? ytm.getPlaylistTracks(id) : [];
}
