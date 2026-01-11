import { Snapshot } from '../../types';

export function toAnalyzerSnapshot(snapshot: any): Snapshot {
  const meta = snapshot?.metadata || {};
  const viewport = meta.viewport || { width: 1280, height: 720, devicePixelRatio: 1 };
  const stats = meta.stats || {
    totalElements: 0,
    totalImages: 0,
    totalLinks: 0,
    totalScripts: 0,
    totalStyles: 0,
  };

  return {
    id: String(snapshot.id || ''),
    url: snapshot.url || '',
    title: snapshot.title || snapshot.url || 'Untitled',
    html: snapshot.html || '',
    css: snapshot.css || '',
    assets: { images: [], fonts: [] },
    metadata: {
      viewport,
      userAgent: meta.userAgent || '',
      language: meta.language || '',
      charset: meta.charset || '',
      meta: meta.meta || {},
      performance: meta.performance,
      stats,
    },
    extractedAt: snapshot.createdAt || new Date().toISOString(),
    extractionTime: snapshot.extractionTime || 0,
  };
}
