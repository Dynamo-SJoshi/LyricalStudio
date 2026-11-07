import "server-only";
import { findLyricsAnySource } from "@/lib/lyrics/sources";
import { parseLrc } from "@/lib/lyrics/parse";
import { clientIp, hit } from "@/lib/rate-limit";

const MAX_CACHE = 500;
const memoryCache = new Map<string, string[]>();

const COMPLEX_REGEX = /[\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;

function containsComplexScript(lines: string[]): boolean {
  return lines.some((l) => COMPLEX_REGEX.test(l));
}

const SYSTEM_PROMPT = `You are an expert romanizer / transliterator for music lyrics.
Your task is to transcribe (NOT translate) lyrics into Latin alphabet characters.
- Hindi / Devanagari -> Hinglish
- Gujarati -> Roman Gujarati (Gujlish)
- Urdu -> Roman Urdu (e.g., 'dil', 'jaise', 'badal', restoring natural unwritten short vowels in poetic context)
- Japanese -> Rōmaji (Hepburn)
- Chinese -> Pinyin
- Korean -> Revised Romanization

Rules:
1. Preserve line breaks exactly. The output MUST have the EXACT SAME number of lines as input.
2. Transcribe word-for-word so word count corresponds closely to original lines.
3. Preserve punctuation and English words as-is.
4. Output ONLY the romanized text lines, without any notes, markdown code fences, explanations, or quotes.`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title")?.trim().slice(0, 200);
  const artist = searchParams.get("artist")?.trim().slice(0, 200);
  if (!title || !artist) {
    return Response.json({ error: "title and artist are required" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "Romanization not configured" }, { status: 503 });
  }

  const cacheKey = `${artist}|${title}`.toLowerCase();
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    return Response.json(
      { romanized: cached },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
    );
  }

  // Daily per-IP budget check (30 romanizations per day per IP)
  const ip = clientIp(request.headers);
  const { count } = await hit(`romanize-daily:${ip}`, 86400);
  if (count > 30) {
    return Response.json(
      { error: "Daily romanization limit reached. Try again tomorrow." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const album = searchParams.get("album")?.trim().slice(0, 200) || undefined;
  const durationParam = Number(searchParams.get("duration"));
  const duration = Number.isFinite(durationParam) && durationParam > 0 ? durationParam : undefined;

  // Fetch lyrics server-side so arbitrary text cannot be sent to the AI
  const { lyrics, unavailable } = await findLyricsAnySource({ title, artist, album, duration });
  if (unavailable || !lyrics || !lyrics.raw) {
    return Response.json({ romanized: [] }, { status: 200 });
  }

  // Extract lyrics lines from LRC or plain text
  let lines: string[] = [];
  if (lyrics.synced) {
    lines = parseLrc(lyrics.raw).map((l) => l.text).filter(Boolean);
  } else {
    lines = lyrics.raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }

  if (!lines.length || !containsComplexScript(lines)) {
    return Response.json({ romanized: [] }, { status: 200 });
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: lines.join("\n") }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (response.status === 429) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!response.ok) {
      return Response.json({ error: "Failed to process romanization." }, { status: 502 });
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const outText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!outText) {
      return Response.json({ romanized: [] });
    }

    const romanized = outText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    // Bounded in-memory LRU-like cache
    if (memoryCache.size >= MAX_CACHE) {
      const oldestKey = memoryCache.keys().next().value;
      if (oldestKey) memoryCache.delete(oldestKey);
    }
    memoryCache.set(cacheKey, romanized);

    return Response.json(
      { romanized },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    console.error("romanize request failed", err);
    return Response.json({ error: "Romanization service unavailable." }, { status: 502 });
  }
}
