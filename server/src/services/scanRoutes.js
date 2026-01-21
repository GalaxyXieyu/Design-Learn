const http = require('http');
const https = require('https');
const { URL } = require('url');

const { loadPlaywright } = require('../playwrightSupport');

async function scanWebsiteRoutes(baseUrl, maxRoutes = 10) {
  const playwright = await loadPlaywright({
    logger: (text) => process.stderr.write(text),
  });

  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);

    const routes = new Set();
    routes.add(new URL(baseUrl).pathname);

    const links = await page.$$eval('a[href]', (anchors) => anchors.map((a) => a.href));

    const baseUrlObj = new URL(baseUrl);
    links.forEach((href) => {
      try {
        const linkUrl = new URL(href, baseUrl);
        if (linkUrl.origin === baseUrlObj.origin) {
          const pathname = linkUrl.pathname;
          if (pathname && !routes.has(pathname)) {
            routes.add(pathname);
          }
        }
      } catch {
        // ignore invalid links
      }
    });

    const sitemapRoutes = await fetchSitemapRoutes(baseUrl, maxRoutes * 5);
    sitemapRoutes.forEach((route) => {
      if (route && !routes.has(route)) {
        routes.add(route);
      }
    });

    const sortedRoutes = Array.from(routes)
      .sort((a, b) => {
        const depthA = a.split('/').filter(Boolean).length;
        const depthB = b.split('/').filter(Boolean).length;
        if (depthA !== depthB) return depthA - depthB;
        return a.localeCompare(b);
      })
      .slice(0, maxRoutes);

    return sortedRoutes;
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

function fetchUrlText(targetUrl, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let urlObj;
    try {
      urlObj = new URL(targetUrl);
    } catch {
      resolve(null);
      return;
    }

    const lib = urlObj.protocol === 'https:' ? https : http;
    const req = lib.get(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        timeout: timeoutMs,
        headers: { 'User-Agent': 'design-learn-scan' },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, urlObj).toString();
          res.resume();
          resolve(fetchUrlText(redirectUrl, timeoutMs));
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }

        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      }
    );

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function extractSitemapLocs(xml, tagName) {
  const matches = xml.matchAll(
    new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<loc>([\\s\\S]*?)<\\/loc>[\\s\\S]*?<\\/${tagName}>`, 'gi')
  );
  const items = [];
  for (const match of matches) {
    const raw = match[1] || '';
    const cleaned = raw.replace(/<!\\[CDATA\\[(.*)\\]\\]>/, '$1').trim();
    if (cleaned) items.push(cleaned);
  }
  return items;
}

async function fetchRobotsSitemaps(baseUrl) {
  try {
    const base = new URL(baseUrl);
    const robotsUrl = new URL('/robots.txt', base.origin).toString();
    const text = await fetchUrlText(robotsUrl);
    if (!text) return [];
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^sitemap:/i.test(line))
      .map((line) => line.split(':').slice(1).join(':').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchSitemapRoutes(baseUrl, limit) {
  const base = new URL(baseUrl);
  const defaultSitemaps = ['/sitemap.xml', '/wp-sitemap.xml', '/sitemap_index.xml'].map((p) =>
    new URL(p, base.origin).toString()
  );
  const robotsSitemaps = await fetchRobotsSitemaps(baseUrl);
  const queue = Array.from(new Set([...robotsSitemaps, ...defaultSitemaps]));
  const visited = new Set();
  const routes = new Set();

  while (queue.length && routes.size < limit) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);

    const xml = await fetchUrlText(sitemapUrl);
    if (!xml) continue;

    const urlLocs = extractSitemapLocs(xml, 'url');
    for (const raw of urlLocs) {
      if (routes.size >= limit) break;
      try {
        const urlObj = new URL(raw, base.origin);
        if (urlObj.origin === base.origin) {
          routes.add(urlObj.pathname);
        }
      } catch {
        // ignore invalid
      }
    }

    const sitemapLocs = extractSitemapLocs(xml, 'sitemap');
    sitemapLocs.forEach((loc) => {
      try {
        const urlObj = new URL(loc, base.origin);
        if (!visited.has(urlObj.toString())) queue.push(urlObj.toString());
      } catch {
        // ignore invalid
      }
    });
  }

  return Array.from(routes);
}

module.exports = {
  scanWebsiteRoutes,
};
