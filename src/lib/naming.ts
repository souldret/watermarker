import type { NamingPattern, OutputFormat } from './types';

function stripExt(name: string): { base: string; ext: string } {
  const i = name.lastIndexOf('.');
  if (i <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, i), ext: name.slice(i) };
}

function extForFormat(format: OutputFormat, originalName: string): string {
  if (format === 'jpeg') return '.jpg';
  if (format === 'png') return '.png';
  if (format === 'webp') return '.webp';
  const { ext } = stripExt(originalName);
  const lower = ext.toLowerCase();
  if (lower === '.bmp' || lower === '.gif') return '.png';
  return ext || '.jpg';
}

export function buildOutputFileName(opts: {
  originalName: string;
  chapterName: string;
  indexInChapter: number; // 0-based
  pattern: NamingPattern;
  customTemplate: string;
  outputFormat: OutputFormat;
}): string {
  const { base } = stripExt(opts.originalName);
  const ext = extForFormat(opts.outputFormat, opts.originalName);
  const index1 = String(opts.indexInChapter + 1).padStart(3, '0');
  const chapter = opts.chapterName.replace(/[<>:"/\\|?*]/g, '_');

  switch (opts.pattern) {
    case 'suffix':
      return `${base}_wm${ext}`;
    case 'prefix':
      return `wm_${base}${ext}`;
    case 'chapter_index':
      return `${chapter}_${index1}${ext}`;
    case 'custom': {
      const tpl = opts.customTemplate || '{name}';
      const rendered = tpl
        .replace(/\{chapter\}/gi, chapter)
        .replace(/\{index\}/gi, index1)
        .replace(/\{name\}/gi, base)
        .replace(/\{ext\}/gi, ext.replace(/^\./, ''));
      return rendered.includes('.') ? rendered : `${rendered}${ext}`;
    }
    case 'original':
    default:
      return `${base}${ext}`;
  }
}
