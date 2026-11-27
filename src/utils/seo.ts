/**
 * Technical SEO & Structured Data Utility
 * Police Lines School & College, Faridpur — 65 Years Grand Reunion 2027
 *
 * Updates non-visual HTML <head> metadata (title, description, canonical, robots directives,
 * Open Graph, Twitter Card, and JSON-LD structured data) per active view without altering UI.
 */

import { Language } from '../types';

export const CANONICAL_ORIGIN = 'https://www.plscf65.online';
export const DEFAULT_OG_IMAGE_URL = `${CANONICAL_ORIGIN}/assets/homepage/hero_panorama.jpg`;
export const SCHOOL_LOGO_URL = `${CANONICAL_ORIGIN}/assets/school_logo.png`;

export interface RouteSeoMetadata {
  view: string;
  title: string;
  description: string;
  canonicalPath?: string;
  indexable: boolean;
  breadcrumbLabel?: string;
  includeEventSchema?: boolean;
}

const INDEX_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const NOINDEX_ROBOTS = 'noindex, nofollow, noarchive';

const PUBLIC_ROUTE_METADATA: Record<string, RouteSeoMetadata> = {
  home: {
    view: 'home',
    title: 'Police Lines 65 Years Reunion | Official Registration – Faridpur',
    description:
      'Police Lines School and College, Faridpur 65 Years Reunion. Explore alumni registration, reunion information, event updates and participation details.',
    canonicalPath: '/',
    indexable: true,
    breadcrumbLabel: 'Home',
    includeEventSchema: true,
  },
  register: {
    view: 'register',
    title: 'Reunion Registration | Police Lines 65 Years Reunion – Faridpur',
    description:
      'Online registration for Police Lines School and College, Faridpur 65 Years Reunion (পুলিশ লাইনস পুনর্মিলনী রেজিস্ট্রেশন). Complete alumni or current student registration details.',
    canonicalPath: '/register',
    indexable: true,
    breadcrumbLabel: 'Registration',
    includeEventSchema: true,
  },
  donate: {
    view: 'donate',
    title: 'Contribute & Donate | Police Lines 65 Years Reunion – Faridpur',
    description:
      'Contribute to the Police Lines School and College, Faridpur 65 Years Reunion 2027 patronage, student welfare, and campus celebration fund.',
    canonicalPath: '/donate',
    indexable: true,
    breadcrumbLabel: 'Contribute / Donate',
  },
  'international-payment': {
    view: 'international-payment',
    title: 'International Alumni Support | Police Lines 65 Years Reunion',
    description:
      'Official remittance instructions for international alumni participating in the Police Lines School and College, Faridpur 65 Years Grand Reunion 2027.',
    canonicalPath: '/international-payment',
    indexable: true,
    breadcrumbLabel: 'International Alumni Support',
  },
  notices: {
    view: 'notices',
    title: 'Notices & Announcements | Police Lines 65 Years Reunion – Faridpur',
    description:
      'Official reunion notices, event schedules, registration updates, and campus advisories from Police Lines School and College, Faridpur.',
    canonicalPath: '/notices',
    indexable: true,
    breadcrumbLabel: 'Notices',
  },
  gallery: {
    view: 'gallery',
    title: 'Photo & Video Archive | Police Lines 65 Years Reunion – Faridpur',
    description:
      'Explore campus photos, alumni memories, and heritage video archives of Police Lines School and College, Faridpur (Est. 1962).',
    canonicalPath: '/gallery',
    indexable: true,
    breadcrumbLabel: 'Gallery',
  },
  about: {
    view: 'about',
    title: 'About & Contact | Police Lines School & College Faridpur Reunion',
    description:
      'About Police Lines School and College, Faridpur (পুলিশ লাইনস স্কুল এন্ড কলেজ ফরিদপুর, Est. 1962), 65th anniversary objectives, campus address, and reunion helpdesk.',
    canonicalPath: '/about',
    indexable: true,
    breadcrumbLabel: 'About & Contact',
    includeEventSchema: true,
  },
  'find-ticket': {
    view: 'find-ticket',
    title: 'Find My Ticket | Police Lines 65 Years Reunion – Faridpur',
    description:
      'Look up your confirmed registration status or contribution card for Police Lines School and College, Faridpur Grand Reunion 2027.',
    canonicalPath: '/find-ticket',
    indexable: true,
    breadcrumbLabel: 'Find My Ticket',
  },
};

const PRIVATE_ROUTE_METADATA: Record<string, RouteSeoMetadata> = {
  ticket: {
    view: 'ticket',
    title: 'Digital Pass | Police Lines 65 Years Reunion',
    description: 'Private participant pass view.',
    indexable: false,
  },
  profile: {
    view: 'profile',
    title: 'Participant Pass | Police Lines 65 Years Reunion',
    description: 'Private participant pass view.',
    indexable: false,
  },
  admin: {
    view: 'admin',
    title: 'Administrative Portal | Police Lines 65 Years Reunion',
    description: 'Restricted event administration portal.',
    indexable: false,
  },
  dashboard: {
    view: 'dashboard',
    title: 'Operations Dashboard | Police Lines 65 Years Reunion',
    description: 'Restricted event operations dashboard.',
    indexable: false,
  },
  portal: {
    view: 'portal',
    title: 'Committee Portal | Police Lines 65 Years Reunion',
    description: 'Restricted operations portal.',
    indexable: false,
  },
  scanner: {
    view: 'scanner',
    title: 'Verification Station | Police Lines 65 Years Reunion',
    description: 'Restricted gate and distribution verification station.',
    indexable: false,
  },
  '404': {
    view: '404',
    title: 'Page Not Found | Police Lines 65 Years Reunion – Faridpur',
    description: 'The requested page could not be found.',
    indexable: false,
  },
};

/**
 * Returns authoritative SEO metadata configuration for a given application view.
 * Private operational routes, individual ticket views, and 404 views always fail closed to noindex.
 */
export function getSeoMetadataForView(view: string): RouteSeoMetadata {
  const normalized = (view || 'home').trim().toLowerCase();
  if (PUBLIC_ROUTE_METADATA[normalized]) {
    return PUBLIC_ROUTE_METADATA[normalized];
  }
  if (PRIVATE_ROUTE_METADATA[normalized]) {
    return PRIVATE_ROUTE_METADATA[normalized];
  }
  return PRIVATE_ROUTE_METADATA['404'];
}

/**
 * Builds valid JSON-LD structured data for public indexable pages.
 * Returns null for private/noindex routes so search engines do not emit rich cards for private views.
 */
export function buildJsonLdGraphForRoute(meta: RouteSeoMetadata): Record<string, unknown> | null {
  if (!meta.indexable || !meta.canonicalPath) {
    return null;
  }

  const pageUrl = `${CANONICAL_ORIGIN}${meta.canonicalPath === '/' ? '/' : meta.canonicalPath}`;

  const websiteNode = {
    '@type': 'WebSite',
    '@id': `${CANONICAL_ORIGIN}/#website`,
    url: `${CANONICAL_ORIGIN}/`,
    name: 'Police Lines 65 Years Reunion | Official Registration – Faridpur',
    alternateName: [
      'PLSCF Grand Reunion 2027',
      'পুলিশ লাইনস স্কুল এন্ড কলেজ ফরিদপুর — ৬৫ বছর পূর্তি পুনর্মিলনী ২০২৭',
    ],
    inLanguage: ['bn', 'en'],
  };

  const organizationNode = {
    '@type': 'Organization',
    '@id': `${CANONICAL_ORIGIN}/#organization`,
    name: 'Reunion 2027 Organizing Committee — Police Lines School and College, Faridpur',
    alternateName: 'পুলিশ লাইনস পুনর্মিলনী ২০২৭ পরিচালনা পরিষদ',
    url: `${CANONICAL_ORIGIN}/about`,
    logo: {
      '@type': 'ImageObject',
      url: SCHOOL_LOGO_URL,
      width: 448,
      height: 446,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Police Lines Area, Kamlapur',
      addressLocality: 'Faridpur Sadar',
      addressRegion: 'Faridpur',
      postalCode: '7800',
      addressCountry: 'BD',
    },
  };

  const breadcrumbItems: Array<Record<string, unknown>> = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: `${CANONICAL_ORIGIN}/`,
    },
  ];

  if (meta.canonicalPath !== '/' && meta.breadcrumbLabel) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: meta.breadcrumbLabel,
      item: pageUrl,
    });
  }

  const breadcrumbNode = {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: breadcrumbItems,
  };

  const webPageNode = {
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: meta.title,
    description: meta.description,
    isPartOf: { '@id': `${CANONICAL_ORIGIN}/#website` },
    breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
    inLanguage: ['bn', 'en'],
  };

  const graph: Array<Record<string, unknown>> = [websiteNode, organizationNode, webPageNode, breadcrumbNode];

  if (meta.includeEventSchema) {
    graph.push({
      '@type': 'Event',
      '@id': `${CANONICAL_ORIGIN}/#event`,
      name: 'Police Lines School & College, Faridpur — 65 Years Grand Reunion 2027',
      alternateName: [
        'Police Lines 65 Years Reunion',
        'পুলিশ লাইনস ৬৫ বছর পূর্তি পুনর্মিলনী ২০২৭',
      ],
      description:
        '65th Anniversary Grand Reunion of Police Lines School and College, Faridpur (Est. 1962), bringing together alumni and current students at the school campus in Faridpur.',
      startDate: '2027-01-28T09:00:00+06:00',
      endDate: '2027-01-29T22:00:00+06:00',
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      url: `${CANONICAL_ORIGIN}/`,
      image: [DEFAULT_OG_IMAGE_URL, SCHOOL_LOGO_URL],
      location: {
        '@type': 'Place',
        name: 'Police Lines School and College Campus & Police Lines Large Field, Faridpur',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Police Lines Area, Kamlapur',
          addressLocality: 'Faridpur Sadar',
          addressRegion: 'Faridpur',
          postalCode: '7800',
          addressCountry: 'BD',
        },
      },
      organizer: { '@id': `${CANONICAL_ORIGIN}/#organization` },
      inLanguage: ['bn', 'en'],
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

function upsertMetaTag(attrName: 'name' | 'property', attrValue: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Synchronizes `<head>` metadata for the currently active view and language without altering visible DOM/UI.
 */
export function syncDocumentSeo(view: string, language: Language = 'bn'): void {
  if (typeof document === 'undefined') return;

  const meta = getSeoMetadataForView(view);

  // Sync HTML document language attribute accurately for screen readers & crawlers
  document.documentElement.lang = language === 'en' ? 'en' : 'bn';
  document.title = meta.title;

  upsertMetaTag('name', 'description', meta.description);
  upsertMetaTag('name', 'robots', meta.indexable ? INDEX_ROBOTS : NOINDEX_ROBOTS);
  upsertMetaTag('name', 'googlebot', meta.indexable ? 'index, follow' : 'noindex, nofollow');

  const existingCanonical = document.head.querySelector('link[rel="canonical"]');
  if (meta.indexable && meta.canonicalPath) {
    const canonicalUrl = `${CANONICAL_ORIGIN}${meta.canonicalPath === '/' ? '/' : meta.canonicalPath}`;
    if (existingCanonical) {
      existingCanonical.setAttribute('href', canonicalUrl);
    } else {
      const link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      link.setAttribute('href', canonicalUrl);
      document.head.appendChild(link);
    }
    upsertMetaTag('property', 'og:url', canonicalUrl);
  } else if (existingCanonical) {
    // Avoid combining noindex with a conflicting canonical tag
    existingCanonical.remove();
  }

  upsertMetaTag('property', 'og:title', meta.title);
  upsertMetaTag('property', 'og:description', meta.description);
  upsertMetaTag('name', 'twitter:title', meta.title);
  upsertMetaTag('name', 'twitter:description', meta.description);

  const jsonLd = buildJsonLdGraphForRoute(meta);
  const existingJsonLd = document.head.querySelector('#plscf-structured-data');
  if (jsonLd) {
    const serialized = JSON.stringify(jsonLd);
    if (existingJsonLd) {
      existingJsonLd.textContent = serialized;
    } else {
      const script = document.createElement('script');
      script.id = 'plscf-structured-data';
      script.type = 'application/ld+json';
      script.textContent = serialized;
      document.head.appendChild(script);
    }
  } else if (existingJsonLd) {
    existingJsonLd.remove();
  }
}
