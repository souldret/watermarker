import type { WatermarkPosition } from '@/lib/types';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

const CELLS: { pos: WatermarkPosition; label: string }[] = [
  { pos: 'tl', label: 'Sol üst' },
  { pos: 'tc', label: 'Üst orta' },
  { pos: 'tr', label: 'Sağ üst' },
  { pos: 'ml', label: 'Sol orta' },
  { pos: 'mc', label: 'Merkez' },
  { pos: 'mr', label: 'Sağ orta' },
  { pos: 'bl', label: 'Sol alt' },
  { pos: 'bc', label: 'Alt orta' },
  { pos: 'br', label: 'Sağ alt' },
];

export default function PositionGrid() {
  const positions = useAppStore((s) => s.settings.positions);
  const togglePosition = useAppStore((s) => s.togglePosition);

  const labels = CELLS.filter((c) => positions.includes(c.pos)).map((c) => c.label);

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">Konum (çoklu)</h2>
        <span className="max-w-[55%] truncate text-[11px] text-ink-muted" title={labels.join(', ')}>
          {labels.join(' · ') || 'Seç'}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-ink-muted">Birden fazla nokta seçebilirsin.</p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Watermark konumları">
        {CELLS.map(({ pos, label }) => {
          const active = positions.includes(pos);
          return (
            <button
              key={pos}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={active}
              onClick={() => togglePosition(pos)}
              className={cn(
                'flex h-9 items-center justify-center rounded-md border transition',
                active
                  ? 'border-seal bg-seal/15 shadow-[0_0_0_1px_rgb(var(--seal)/0.35)]'
                  : 'border-ink-border bg-ink-deep hover:border-ink-muted/50 hover:bg-ink-elevated',
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  active ? 'bg-seal shadow-[0_0_8px_rgba(255,77,77,0.8)]' : 'bg-ink-muted/50',
                )}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
