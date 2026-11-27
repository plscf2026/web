import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import {
  CANONICAL_ORIGIN,
  getSeoMetadataForView,
  buildJsonLdGraphForRoute,
  syncDocumentSeo,
} from './seo';
import { VALID_VIEWS } from './navigation';

const ROOT = process.cwd();

test('1. SEO Utility: All public indexable routes have unique titles, descriptions, and www.plscf65.online canonicals', () => {
  const publicViews = ['home', 'register', 'donate', 'international-payment', 'notices', 'gallery', 'about', 'find-ticket'];
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  const canonicals = new Set<string>();

  for (const view of publicViews) {
    const meta = getSeoMetadataForView(view);
    assert.equal(meta.indexable, true, `Expected view "${view}" to be indexable`);
    assert.ok(meta.title.length >= 25 && meta.title.length <= 75, `Title length check for ${view}: ${meta.title}`);
    assert.ok(meta.description.length >= 70 && meta.description.length <= 210, `Description check for ${view}`);
    assert.ok(meta.canonicalPath && meta.canonicalPath.startsWith('/'), `Canonical path missing for ${view}`);

    titles.add(meta.title);
    descriptions.add(meta.description);
    canonicals.add(meta.canonicalPath!);
  }

  assert.equal(titles.size, publicViews.length, 'Every public route must have a unique SEO title');
  assert.equal(descriptions.size, publicViews.length, 'Every public route must have a unique meta description');
  assert.equal(canonicals.size, publicViews.length, 'Every public route must have a unique canonical URL');
});

test('2. SEO Utility: Private, operational, ticket, and 404 routes strictly fail closed to noindex', () => {
  const privateViews = ['ticket', 'profile', 'admin', 'dashboard', 'portal', 'scanner', '404', 'unknown-random-route'];

  for (const view of privateViews) {
    const meta = getSeoMetadataForView(view);
    assert.equal(meta.indexable, false, `Private view "${view}" MUST NOT be indexable`);
    assert.equal(buildJsonLdGraphForRoute(meta), null, `Private view "${view}" must not emit public JSON-LD`);
  }
});

test('3. SEO Utility: syncDocumentSeo updates DOM <head> metadata cleanly without leaking PII or obsolete domain', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html);
  const originalDoc = globalThis.document;
  (globalThis as any).document = dom.window.document;

  try {
    // Public route update (/register in English)
    syncDocumentSeo('register', 'en');
    assert.equal(dom.window.document.documentElement.lang, 'en');
    assert.equal(dom.window.document.title, 'Reunion Registration | Police Lines 65 Years Reunion – Faridpur');
    assert.equal(
      dom.window.document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      `${CANONICAL_ORIGIN}/register`
    );
    assert.ok(
      dom.window.document.head.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('index, follow')
    );
    const jsonLdRaw = dom.window.document.head.querySelector('#plscf-structured-data')?.textContent || '';
    const parsedGraph = JSON.parse(jsonLdRaw);
    assert.ok(Array.isArray(parsedGraph['@graph']) && parsedGraph['@graph'].length >= 4);

    // Private ticket view must strip canonical & JSON-LD and enforce noindex
    syncDocumentSeo('ticket', 'bn');
    assert.equal(dom.window.document.documentElement.lang, 'bn');
    assert.equal(dom.window.document.head.querySelector('link[rel="canonical"]'), null);
    assert.equal(dom.window.document.head.querySelector('#plscf-structured-data'), null);
    assert.ok(
      dom.window.document.head.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex, nofollow')
    );

    // Admin portal view must enforce noindex
    syncDocumentSeo('admin', 'bn');
    assert.ok(
      dom.window.document.head.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex, nofollow')
    );
  } finally {
    globalThis.document = originalDoc;
  }
});

test('4. Static SEO Files: index.html, robots.txt, sitemap.xml, llms.txt, and ai-catalog.json use www.plscf65.online with zero dead vercel.app URLs', () => {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const robotsTxt = fs.readFileSync(path.join(ROOT, 'public/robots.txt'), 'utf8');
  const sitemapXml = fs.readFileSync(path.join(ROOT, 'public/sitemap.xml'), 'utf8');
  const llmsTxt = fs.readFileSync(path.join(ROOT, 'public/llms.txt'), 'utf8');
  const aiCatalog = fs.readFileSync(path.join(ROOT, 'public/ai-catalog.json'), 'utf8');

  for (const [name, content] of [
    ['index.html', indexHtml],
    ['robots.txt', robotsTxt],
    ['sitemap.xml', sitemapXml],
    ['llms.txt', llmsTxt],
    ['ai-catalog.json', aiCatalog],
  ]) {
    assert.equal(content.includes('plscf65.vercel.app'), false, `${name} must not reference dead plscf65.vercel.app`);
    assert.ok(content.includes('https://www.plscf65.online'), `${name} must reference canonical https://www.plscf65.online`);
  }

  // Validate sitemap routes exist in VALID_VIEWS (specifically /notices, NOT 404 /notice)
  const locMatches = [...sitemapXml.matchAll(/<loc>(https:\/\/www\.plscf65\.online([^<]*))<\/loc>/g)];
  assert.ok(locMatches.length >= 6, 'Sitemap should contain core public routes');
  for (const match of locMatches) {
    const pathname = match[2];
    const slug = pathname === '/' ? 'home' : pathname.replace(/^\//, '');
    assert.ok((VALID_VIEWS as readonly string[]).includes(slug), `Sitemap route "${pathname}" must map to a valid route in VALID_VIEWS`);
  }
  assert.equal(sitemapXml.includes('/notice</loc>'), false, 'Sitemap must not include broken /notice route');

  // Verify robots.txt blocks private portals and references canonical sitemap
  for (const blocked of ['/admin', '/dashboard', '/portal', '/scanner', '/ticket', '/profile', '/api/']) {
    assert.ok(robotsTxt.includes(`Disallow: ${blocked}`), `robots.txt must disallow ${blocked}`);
  }
  assert.ok(robotsTxt.includes('Sitemap: https://www.plscf65.online/sitemap.xml'));

  // Validate JSON-LD in index.html parses cleanly and has Event startDate/endDate/location
  const scriptMatch = indexHtml.match(/<script id="plscf-structured-data" type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch && scriptMatch[1], 'index.html must include JSON-LD script block');
  const structured = JSON.parse(scriptMatch[1]);
  const eventNode = structured['@graph'].find((n: any) => n['@type'] === 'Event');
  assert.ok(eventNode, 'JSON-LD graph must include Event schema');
  assert.equal(eventNode.startDate, '2027-01-28T09:00:00+06:00');
  assert.equal(eventNode.endDate, '2027-01-29T22:00:00+06:00');
  assert.equal(eventNode.eventStatus, 'https://schema.org/EventScheduled');
  assert.equal(eventNode.location?.address?.addressLocality, 'Faridpur Sadar');

  // Validate Vercel JSON syntax and X-Robots-Tag protection
  const vercelJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const xRobotsHeaders = (vercelJson.headers || []).filter((h: any) =>
    (h.headers || []).some((kv: any) => kv.key === 'X-Robots-Tag' && String(kv.value).includes('noindex'))
  );
  assert.ok(xRobotsHeaders.length >= 2, 'vercel.json must apply X-Robots-Tag: noindex on private/API routes');
});
