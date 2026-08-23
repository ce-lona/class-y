import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "class-y",
    short_name: "class-y",
    description: "Kurstracking für Trainer:innen und Studios",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAF9",
    theme_color: "#1F5F5C",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
