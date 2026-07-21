import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/hooks/useI18n';

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function SummaryCard() {
  const { t } = useI18n();
  const result = useAppStore((s) => s.result);
  const isProcessing = useAppStore((s) => s.isProcessing);

  if (!result || isProcessing) return null;

  const sec = Math.max(0.001, result.elapsedMs / 1000);
  const ips = result.success / sec;
  const bytesIn = result.bytesIn || 0;
  const bytesOut = result.bytesOut || 0;

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">{t('summary')}</h2>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg border border-ink-border bg-ink-deep px-2.5 py-2">
          <div className="text-ink-muted">{t('duration')}</div>
          <div className="mt-0.5 font-semibold tabular-nums text-ink-text">{sec.toFixed(1)}s</div>
        </div>
        <div className="rounded-lg border border-ink-border bg-ink-deep px-2.5 py-2">
          <div className="text-ink-muted">{t('throughput')}</div>
          <div className="mt-0.5 font-semibold tabular-nums text-ink-text">
            {ips.toFixed(1)} img/s
          </div>
        </div>
        <div className="rounded-lg border border-ink-border bg-ink-deep px-2.5 py-2">
          <div className="text-ink-muted">{t('success')}</div>
          <div className="mt-0.5 font-semibold tabular-nums text-emerald-400">{result.success}</div>
        </div>
        <div className="rounded-lg border border-ink-border bg-ink-deep px-2.5 py-2">
          <div className="text-ink-muted">{t('size_io')}</div>
          <div className="mt-0.5 font-semibold tabular-nums text-ink-text">
            {fmtBytes(bytesIn)} / {fmtBytes(bytesOut)}
          </div>
        </div>
      </div>
    </section>
  );
}
