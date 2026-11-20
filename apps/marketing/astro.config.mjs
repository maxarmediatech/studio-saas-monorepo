// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://stuwiz.com",
  integrations: [
    mdx(),
    // The login and signup pages only forward to app.stuwiz.com.
    sitemap({ filter: (page) => !/\/(login|signup)\/$/.test(page) }),
    react(),
  ],
  output: "static",

  fonts: [
    {
      provider: fontProviders.google(),
      name: "Inter",
      cssVariable: "--font-inter",
      weights: ["400", "500", "600", "700"],
    },
    {
      provider: fontProviders.google(),
      name: "Geist",
      cssVariable: "--font-geist",
      weights: ["400", "500", "600"],
    },
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
