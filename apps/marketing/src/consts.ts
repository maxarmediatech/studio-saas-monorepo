// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = "Stuwiz";
export const SITE_DESCRIPTION =
  "Studio management software for bookings, crews, deliverables, payments, and client communication.";

export const SITE_METADATA = {
  title: {
    default: SITE_TITLE,
    template: "%s | Stuwiz",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Studio Management",
    "Photography CRM",
    "Bookings",
    "Crew Management",
    "Payments",
    "Client Communication",
  ],
  authors: [{ name: "Stuwiz Team" }],
  creator: "Stuwiz Team",
  publisher: "Stuwiz",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "48x48" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon.ico" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: [{ url: "/favicon/favicon.ico" }],
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Stuwiz",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Stuwiz studio management dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.jpg"],
    creator: "@stuwiz",
  },
};
