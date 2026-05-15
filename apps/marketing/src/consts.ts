// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Stuwiz';
export const SITE_DESCRIPTION =
  'Studio management software for modern creative and production teams.';

export const SITE_METADATA = {
  title: {
    default: SITE_TITLE,
    template: '%s | Stuwiz',
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'Studio management',
    'Creative operations',
    'Production management',
    'Project management',
    'SaaS',
  ],
  authors: [{ name: 'Stuwiz' }],
  creator: 'Stuwiz',
  publisher: 'Stuwiz',
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/favicon/favicon.ico', sizes: '48x48' },
      { url: '/favicon/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon/favicon.ico' },
    ],
    apple: [{ url: '/favicon/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: [{ url: '/favicon/favicon.ico' }],
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: 'Stuwiz',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Stuwiz',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/images/og-image.jpg'],
    creator: '@stuwiz',
  },
};
