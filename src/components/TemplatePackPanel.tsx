import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/hooks/useI18n';
import {
  buildTemplatePack,
  dataUrlToFile,
  downloadTemplatePack,
  fileToDataUrl,
  mergePresetsFromPack,
  parseTemplatePack,
} from '@/lib/templatePack';
import { loadLogo } from '@/lib/watermark';

export default function TemplatePackPanel() {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const presets = useAppStore((s) => s.presets);
  const logoFile = useAppStore((s) => s.logoFile);
  const setPresets = useAppStore((s) => s.setPresets);
  const setLogo = useAppStore((s) => s.setLogo);
  const addLog = useAppStore((s) => s.addLog);

  const exportPack = async () => {
    let logoDataUrl: string | undefined;
    let logoFileName: string | undefined;
    if (logoFile) {
      logoDataUrl = await fileToDataUrl(logoFile);
      logoFileName = logoFile.name;
    }
    const pack = buildTemplatePack({
      name: 'Team Watermark Pack',
      presets,
      logoDataUrl,
      logoFileName,
    });
    downloadTemplatePack(pack);
    addLog('success', 'Şablon paketi indirildi.');
  };

  const onImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const pack = parseTemplatePack(text);
      const next = mergePresetsFromPack(pack);
      setPresets(next);
      if (pack.logoDataUrl) {
        const logo = await dataUrlToFile(pack.logoDataUrl, pack.logoFileName || 'logo.png');
        const source = await loadLogo(logo);
        setLogo(logo, source);
      }
      addLog('success', `Paket içe aktarıldı: ${pack.presets.length} preset`);
    } catch (err) {
      addLog('error', err instanceof Error ? err.message : 'Paket okunamadı');
    }
  };

  return (
    <section className="panel space-y-3">
      <div className="panel__head">
        <h2 className="panel__title">{t('template_pack')}</h2>
      </div>
      <p className="text-[11px] text-ink-muted">{t('pack_hint')}</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary justify-center gap-1.5" onClick={() => void exportPack()}>
          <Download className="h-3.5 w-3.5" />
          {t('export_pack')}
        </button>
        <button
          type="button"
          className="btn-secondary justify-center gap-1.5"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          {t('import_pack')}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void onImport(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
    </section>
  );
}
