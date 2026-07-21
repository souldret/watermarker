import { useAppStore } from '@/store/useAppStore';
import { countFiltered } from '@/lib/pageFilter';

export default function PageFilterPanel() {
  const pageFilter = useAppStore((s) => s.pageFilter);
  const chapters = useAppStore((s) => s.chapters);
  const patchPageFilter = useAppStore((s) => s.patchPageFilter);
  const counts = countFiltered(chapters, pageFilter);

  return (
    <section className="panel space-y-3">
      <div className="panel__head">
        <h2 className="panel__title">Sayfa filtreleri</h2>
        <label className="flex items-center gap-2 text-[11px] text-ink-muted">
          <input
            type="checkbox"
            checked={pageFilter.enabled}
            onChange={(e) => patchPageFilter({ enabled: e.target.checked })}
          />
          Aktif
        </label>
      </div>

      <div className={pageFilter.enabled ? 'space-y-3' : 'pointer-events-none space-y-3 opacity-40'}>
        <label className="flex items-center gap-2 text-xs text-ink-text">
          <input
            type="checkbox"
            checked={pageFilter.coverOnly}
            onChange={(e) => patchPageFilter({ coverOnly: e.target.checked })}
          />
          Sadece kapak (ilk sayfa)
        </label>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] text-ink-muted">İlk N sayfa</label>
            <input
              type="number"
              min={0}
              className="select"
              value={pageFilter.firstN || ''}
              placeholder="0"
              onChange={(e) => patchPageFilter({ firstN: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-muted">Son N sayfa</label>
            <input
              type="number"
              min={0}
              className="select"
              value={pageFilter.lastN || ''}
              placeholder="0"
              onChange={(e) => patchPageFilter({ lastN: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-muted">Aralık baş (1…)</label>
            <input
              type="number"
              min={0}
              className="select"
              value={pageFilter.rangeFrom || ''}
              placeholder="0"
              onChange={(e) => patchPageFilter({ rangeFrom: Number(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-muted">Aralık bit</label>
            <input
              type="number"
              min={0}
              className="select"
              value={pageFilter.rangeTo || ''}
              placeholder="0"
              onChange={(e) => patchPageFilter({ rangeTo: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] text-ink-muted">
            Atlanacak isimler (virgülle)
          </label>
          <input
            className="select"
            value={pageFilter.skipNames}
            onChange={(e) => patchPageFilter({ skipNames: e.target.value })}
            placeholder="credit,thanks"
          />
        </div>
      </div>

      {chapters.length > 0 && (
        <p className="text-[11px] text-ink-muted">
          Filtre sonucu: <span className="text-ink-text">{counts.after}</span> / {counts.before}{' '}
          görsel
        </p>
      )}
    </section>
  );
}
