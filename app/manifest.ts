import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CVSD Go",
    short_name: "CVSD Go",
    description: "Official Cedar Valley School District link directory.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1b263b",
    icons: [
      {
        src: "/cvsd-logo.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}

