import { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function PresetPanel() {
  const presets = useAppStore((s) => s.presets);
  const saveCurrentPreset = useAppStore((s) => s.saveCurrentPreset);
  const applyPreset = useAppStore((s) => s.applyPreset);
  const removePreset = useAppStore((s) => s.removePreset);
  const addLog = useAppStore((s) => s.addLog);
  const [name, setName] = useState('');

  const save = () => {
    if (!name.trim()) {
      addLog('warn', 'Preset adı girin.');
      return;
    }
    saveCurrentPreset(name.trim());
    addLog('success', `Preset kaydedildi: ${name.trim()}`);
    setName('');
  };

  return (
    <section className="panel space-y-3">
      <div className="panel__head">
        <h2 className="panel__title">Preset’ler</h2>
      </div>

      <div className="flex gap-2">
        <input
          className="select flex-1"
          placeholder="Preset adı (örn. Ekip A)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
        />
        <button type="button" className="btn-secondary shrink-0 gap-1 px-3" onClick={save}>
          <Save className="h-3.5 w-3.5" />
          Kaydet
        </button>
      </div>

      {presets.length === 0 ? (
        <p className="text-[11px] text-ink-muted">Kayıtlı preset yok. Ayarlarını kaydet.</p>
      ) : (
        <ul className="max-h-36 space-y-1.5 overflow-y-auto custom-scroll">
          {presets.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-lg border border-ink-border bg-ink-deep px-2 py-1.5"
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-xs font-medium text-ink-text hover:text-seal"
                onClick={() => {
                  applyPreset(p.id);
                  addLog('info', `Preset uygulandı: ${p.name}`);
                }}
                title="Uygula"
              >
                {p.name}
              </button>
              <button
                type="button"
                className="btn-icon h-7 w-7"
                aria-label="Sil"
                onClick={() => {
                  removePreset(p.id);
                  addLog('info', `Preset silindi: ${p.name}`);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
