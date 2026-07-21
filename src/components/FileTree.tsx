import { useAppStore } from '@/store/useAppStore';
import { Folder, FileImage } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyFilterToChapters } from '@/lib/pageFilter';
import { useI18n } from '@/hooks/useI18n';

export default function FileTree() {
  const { t } = useI18n();
  const chapters = useAppStore((s) => s.chapters);
  const pageFilter = useAppStore((s) => s.pageFilter);
  const previewPath = useAppStore((s) => s.previewPath);
  const setPreviewByPath = useAppStore((s) => s.setPreviewByPath);

  const displayChapters = pageFilter.enabled
    ? applyFilterToChapters(chapters, pageFilter)
    : chapters;

  if (chapters.length === 0) {
    return (
      <section className="panel flex min-h-[200px] flex-col">
        <div className="panel__head">
          <h2 className="panel__title">{t('file_list')}</h2>
        </div>
        <p className="text-xs text-ink-muted">{t('no_folder')}</p>
      </section>
    );
  }

  return (
    <section className="panel flex min-h-0 flex-col">
      <div className="panel__head">
        <h2 className="panel__title">{t('file_list')}</h2>
        <span className="text-[10px] text-ink-muted">
          {displayChapters.length} {t('chapters')} · {t('click_preview')}
        </span>
      </div>
      <div className="custom-scroll max-h-[220px] space-y-1.5 overflow-y-auto pr-0.5 sm:max-h-[260px]">
        {displayChapters.map((ch) => (
          <div key={ch.name} className="rounded-lg border border-ink-border bg-ink-deep">
            <div className="flex items-center gap-1.5 border-b border-ink-border/60 px-2 py-1">
              <Folder className="h-3 w-3 shrink-0 text-seal" />
              <span className="truncate text-[11px] font-medium text-ink-text">{ch.name}</span>
              <span className="ml-auto shrink-0 text-[10px] tabular-nums text-ink-muted">
                {ch.images.length}
              </span>
            </div>
            <ul className="custom-scroll max-h-24 overflow-y-auto px-1 py-0.5">
              {ch.images.slice(0, 60).map((img) => (
                <li key={img.path}>
                  <button
                    type="button"
                    onClick={() => setPreviewByPath(img.path)}
                    className={cn(
                      'flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] transition',
                      previewPath === img.path
                        ? 'bg-seal/15 text-seal'
                        : 'text-ink-muted hover:bg-ink-elevated hover:text-ink-text',
                    )}
                  >
                    <FileImage className="h-3 w-3 shrink-0 opacity-60" />
                    <span className="truncate">{img.name}</span>
                  </button>
                </li>
              ))}
              {ch.images.length > 60 && (
                <li className="px-1 py-0.5 text-[10px] text-ink-muted/70">
                  +{ch.images.length - 60}…
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
