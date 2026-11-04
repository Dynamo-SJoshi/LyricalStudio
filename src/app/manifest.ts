import type { MetadataRoute } from "next";

/** Web app manifest: name, colors and icons when the site is installed or pinned. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LyricalStudio",
    short_name: "LyricalStudio",
    description: "An open-source music player with kinetic lyric animations.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // full-bleed square: Android crops it to its own shape (the mark sits inside the safe zone)
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
