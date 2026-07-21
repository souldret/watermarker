import type { ChapterJob, FlatJob, ImageFile, PageFilter } from './types';

function parseSkipKeywords(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function matchesSkip(name: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false;
  const lower = name.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

/** Bölüm içindeki görselleri filtre kurallarına göre süz */
export function filterChapterImages(images: ImageFile[], filter: PageFilter): ImageFile[] {
  if (!filter.enabled) return images;
  if (images.length === 0) return [];

  if (filter.coverOnly) {
    return images.slice(0, 1);
  }

  const total = images.length;
  const include = new Array<boolean>(total).fill(false);
  let anyRule = false;

  if (filter.firstN > 0) {
    anyRule = true;
    for (let i = 0; i < Math.min(filter.firstN, total); i++) include[i] = true;
  }
  if (filter.lastN > 0) {
    anyRule = true;
    for (let i = Math.max(0, total - filter.lastN); i < total; i++) include[i] = true;
  }
  if (filter.rangeFrom > 0 || filter.rangeTo > 0) {
    anyRule = true;
    const from = filter.rangeFrom > 0 ? filter.rangeFrom : 1;
    const to = filter.rangeTo > 0 ? filter.rangeTo : total;
    for (let i = 0; i < total; i++) {
      const page = i + 1;
      if (page >= from && page <= to) include[i] = true;
    }
  }

  // Hiç aralık/first/last yoksa hepsini aday al, sadece skip uygula
  let candidates = anyRule ? images.filter((_, i) => include[i]) : [...images];

  const keywords = parseSkipKeywords(filter.skipNames);
  if (keywords.length > 0) {
    candidates = candidates.filter((img) => !matchesSkip(img.name, keywords));
  }

  return candidates;
}

export function applyFilterToChapters(chapters: ChapterJob[], filter: PageFilter): ChapterJob[] {
  return chapters
    .map((ch) => ({
      name: ch.name,
      images: filterChapterImages(ch.images, filter),
    }))
    .filter((ch) => ch.images.length > 0);
}

export function flattenJobs(chapters: ChapterJob[]): FlatJob[] {
  const jobs: FlatJob[] = [];
  let globalIndex = 0;
  for (const ch of chapters) {
    ch.images.forEach((image, imageIndexInChapter) => {
      jobs.push({
        globalIndex,
        chapterName: ch.name,
        image,
        imageIndexInChapter,
        chapterImageCount: ch.images.length,
      });
      globalIndex += 1;
    });
  }
  return jobs;
}

export function countFiltered(chapters: ChapterJob[], filter: PageFilter): {
  before: number;
  after: number;
} {
  const before = chapters.reduce((n, c) => n + c.images.length, 0);
  const filtered = applyFilterToChapters(chapters, filter);
  const after = filtered.reduce((n, c) => n + c.images.length, 0);
  return { before, after };
}
