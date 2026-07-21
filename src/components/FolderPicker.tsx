import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Layers } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import {
  countImages,
  pickDirectory,
  scanFromDirectoryHandle,
  scanFromFileList,
} from '@/lib/scanFolders';
import type { ChapterJob } from '@/lib/types';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';

export default function FolderPicker() {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const mode = useAppStore((s) => s.mode);
  const chapters = useAppStore((s) => s.chapters);
  const sourceLabel = useAppStore((s) => s.sourceLabel);
  const isProcessing = useAppStore((s) => s.isProcessing);
  const setChapters = useAppStore((s) => s.setChapters);
  const addLog = useAppStore((s) => s.addLog);
  const clearLogs = useAppStore((s) => s.clearLogs);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.setAttribute('webkitdirectory', '');
    el.setAttribute('directory', '');
  }, []);

  const applyScan = (scanned: ChapterJob[], label: string) => {
    const total = countImages(scanned);
    setChapters(scanned, label);
    clearLogs();
    if (total === 0) {
      addLog('warn', 'Klasörde desteklenen görsel bulunamadı.');
      return;
    }
    addLog('success', `${label}: ${scanned.length} bölüm, ${total} görsel tarandı.`);
  };

  const openFallbackPicker = () => inputRef.current?.click();

  const handlePick = async () => {
    if (isProcessing) return;
    const result = await pickDirectory();
    if (result.status === 'cancelled') return;
    if (result.status === 'unsupported') {
      openFallbackPicker();
      return;
    }
    try {
      const scanned = await scanFromDirectoryHandle(result.handle, mode);
      applyScan(scanned, result.handle.name);
    } catch {
      addLog('error', 'Klasör okunamadı, alternatif seçici açılıyor...');
      openFallbackPicker();
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const first = files[0];
    const root = first.webkitRelativePath?.split('/')[0] || 'klasor';
    applyScan(scanFromFileList(files, mode), root);
    e.target.value = '';
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (isProcessing) return;

    const items = e.dataTransfer.items;
    // File System Access drag (Chromium)
    if (items && items.length > 0) {
      const item = items[0] as DataTransferItem & {
        getAsFileSystemHandle?: () => Promise<FileSystemHandle>;
      };
      if (typeof item.getAsFileSystemHandle === 'function') {
        try {
          const handle = await item.getAsFileSystemHandle();
          if (handle && handle.kind === 'directory') {
            const scanned = await scanFromDirectoryHandle(
              handle as FileSystemDirectoryHandle,
              mode,
            );
            applyScan(scanned, handle.name);
            return;
          }
        } catch {
          // fallback below
        }
      }
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const first = files[0];
      const root = first.webkitRelativePath?.split('/')[0] || first.name || 'klasor';
      applyScan(scanFromFileList(files, mode), root);
    }
  };

  const total = countImages(chapters);

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{t('source_folder')}</h2>
      </div>

      <div
        className={cn(
          'mb-2 rounded-lg border border-dashed px-3 py-3 text-center transition',
          dragOver
            ? 'border-seal bg-seal/10'
            : 'border-ink-border bg-ink-deep hover:border-seal/40',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => void onDrop(e)}
        onClick={() => void handlePick()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') void handlePick();
        }}
      >
        <p className="text-sm font-medium text-ink-text">{t('drop_folder')}</p>
        <p className="mt-1 text-[11px] text-ink-muted">{t('or_click')}</p>
      </div>

      <button
        type="button"
        className="btn-secondary w-full justify-center gap-2"
        disabled={isProcessing}
        onClick={() => void handlePick()}
      >
        {mode === 'batch' ? <Layers className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
        {mode === 'batch' ? t('pick_series') : t('pick_chapter')}
      </button>

      <input ref={inputRef} type="file" className="hidden" multiple onChange={onInputChange} />

      {sourceLabel && (
        <div className="mt-3 rounded-lg border border-ink-border bg-ink-deep px-3 py-2.5">
          <p className="truncate text-sm font-medium text-ink-text" title={sourceLabel}>
            {sourceLabel}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {chapters.length} {t('chapters')} · {total} {t('images')}
          </p>
        </div>
      )}
    </section>
  );
}
