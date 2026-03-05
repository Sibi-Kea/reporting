import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CRC Reporting",
    short_name: "CRC Reporting",
    description: "Enterprise-grade, multi-tenant Church Management System",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f8f6",
    theme_color: "#0d5a4c",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
