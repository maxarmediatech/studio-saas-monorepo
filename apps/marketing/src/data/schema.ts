import { faqs, links } from './site';

const SITE = 'https://stuwiz.com';

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: 'Stuwiz',
  url: SITE,
  logo: `${SITE}/images/brand/stuwiz-mark.png`,
  email: links.email,
};

export const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${SITE}/#software`,
  name: 'Stuwiz',
  url: SITE,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Studio management software for wedding and photography studios: quotations, bookings, shoots, deliverables, crew, clients and payments in one place.',
  publisher: { '@id': `${SITE}/#organization` },
};

export const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};
