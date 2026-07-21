import type { AppPreset, TemplatePack } from './types';
import { createPreset, loadPresets, mergeFilter, mergeSettings, savePresets } from './presets';

export function buildTemplatePack(opts: {
  name: string;
  presets: AppPreset[];
  logoDataUrl?: string;
  logoFileName?: string;
}): TemplatePack {
  return {
    version: 1,
    name: opts.name.trim() || 'Watermarker Pack',
    exportedAt: new Date().toISOString(),
    presets: opts.presets,
    logoDataUrl: opts.logoDataUrl,
    logoFileName: opts.logoFileName,
  };
}

export function downloadTemplatePack(pack: TemplatePack): void {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pack.name.replace(/[^\w\- ]+/g, '').trim() || 'pack'}.watermarker.json`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function parseTemplatePack(text: string): TemplatePack {
  const data = JSON.parse(text) as TemplatePack;
  if (!data || data.version !== 1 || !Array.isArray(data.presets)) {
    throw new Error('Geçersiz şablon paketi');
  }
  return data;
}

export function mergePresetsFromPack(pack: TemplatePack): AppPreset[] {
  const current = loadPresets();
  const incoming = pack.presets.map((p, idx) => {
    const base = createPreset(
      p.name || `Pack ${idx + 1}`,
      mergeSettings(p.settings),
      mergeFilter(p.pageFilter),
    );
    return base;
  });
  const next = [...incoming, ...current].slice(0, 40);
  savePresets(next);
  return next;
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Logo okunamadı'));
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], fileName || 'logo.png', { type: blob.type || 'image/png' });
}
