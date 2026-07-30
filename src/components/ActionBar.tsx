import { Eraser, Play, Stamp, Square } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { countImages } from '@/lib/scanFolders';
import { countFiltered } from '@/lib/pageFilter';
import { runProcessPipeline } from '@/lib/processPipeline';
import { useI18n } from '@/hooks/useI18n';

export default function ActionBar() {
  const { t } = useI18n();
  const logoSource = useAppStore((s) => s.logoSource);
  const chapters = useAppStore((s) => s.chapters);
  const pageFilter = useAppStore((s) => s.pageFilter);
  const isProcessing = useAppStore((s) => s.isProcessing);
  const checkpoint = useAppStore((s) => s.checkpoint);
  const sourceLabel = useAppStore((s) => s.sourceLabel);
  const textEnabled = useAppStore((s) => Boolean(s.settings.textWatermark?.enabled));
  const setProcessing = useAppStore((s) => s.setProcessing);
  const resetCancel = useAppStore((s) => s.resetCancel);
  const requestCancel = useAppStore((s) => s.requestCancel);
  const setProgress = useAppStore((s) => s.setProgress);
  const setResult = useAppStore((s) => s.setResult);
  const addLog = useAppStore((s) => s.addLog);
  const clearLogs = useAppStore((s) => s.clearLogs);
  const resetAll = useAppStore((s) => s.resetAll);
  const setCheckpoint = useAppStore((s) => s.setCheckpoint);

  const totalRaw = countImages(chapters);
  const filtered = countFiltered(chapters, pageFilter);
  const total = pageFilter.enabled ? filtered.after : totalRaw;
  // Metin tek başına da yeterli; logo opsiyonel
  const hasMark = Boolean(logoSource) || textEnabled;
  const canRun = hasMark && total > 0 && !isProcessing;
  const canResume =
    hasMark &&
    Boolean(checkpoint) &&
    total > 0 &&
    !isProcessing &&
    checkpoint?.sourceLabel === sourceLabel &&
    checkpoint.nextGlobalIndex > 0 &&
    checkpoint.nextGlobalIndex < total;

  const run = async (resume: boolean) => {
    const state = useAppStore.getState();
    const currentLogo = state.logoSource;
    const currentLogo2 = state.logo2Source;
    const currentChapters = state.chapters;
    const currentSettings = state.settings;
    const currentFilter = state.pageFilter;
    const counts = countFiltered(currentChapters, currentFilter);
    const currentTotal = currentFilter.enabled ? counts.after : countImages(currentChapters);
    const markOk = Boolean(currentLogo) || Boolean(currentSettings.textWatermark?.enabled);

    if (!markOk || currentTotal === 0) {
      addLog('warn', !markOk ? t('load_logo_first') : t('no_images'));
      return;
    }

    resetCancel();
    setProcessing(true);
    if (!resume) {
      setResult(null);
      setCheckpoint(null);
      clearLogs();
    }
    setProgress({
      current: 0,
      total: currentTotal,
      chapterName: '',
      fileName: '',
      percent: 0,
      phase: 'process',
    });
    addLog(
      'info',
      `${resume ? 'Devam' : 'Başladı'} · ${currentChapters.length} bölüm · ${currentTotal} görsel · ${currentSettings.outputTarget === 'folder' ? 'klasör' : 'ZIP'}${currentLogo2 && currentSettings.logo2?.enabled ? ' · 2 logo' : ''}`,
    );

    try {
      const result = await runProcessPipeline({
        chapters: currentChapters,
        logo: currentLogo,
        logo2: currentLogo2,
        settings: currentSettings,
        pageFilter: currentFilter,
        sourceLabel: state.sourceLabel || 'watermarked',
        mode: state.mode,
        resumeFrom: resume ? state.checkpoint : null,
        onProgress: (p) => setProgress(p),
        onLog: (level, message) => addLog(level, message),
        onCheckpoint: (cp) => setCheckpoint(cp),
        shouldCancel: () => useAppStore.getState().cancelFlag,
      });
      setResult(result);
    } catch (err) {
      addLog('error', err instanceof Error ? err.message : 'İşlem hatası');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {!isProcessing ? (
        <>
          <button
            type="button"
            className="btn-primary w-full justify-center gap-2"
            disabled={!canRun}
            onClick={() => void run(false)}
          >
            <Stamp className="h-4 w-4" />
            {t('stamp')}
          </button>
          {canResume && (
            <button
              type="button"
              className="btn-secondary w-full justify-center gap-2"
              onClick={() => void run(true)}
            >
              <Play className="h-4 w-4" />
              {t('resume')}
            </button>
          )}
        </>
      ) : (
        <button type="button" className="btn-danger w-full justify-center gap-2" onClick={requestCancel}>
          <Square className="h-3.5 w-3.5 fill-current" />
          {t('cancel_save')}
        </button>
      )}
      <button
        type="button"
        className="btn-ghost w-full justify-center gap-2"
        disabled={isProcessing}
        onClick={resetAll}
      >
        <Eraser className="h-4 w-4" />
        {t('clear')}
      </button>
    </div>
  );
}
