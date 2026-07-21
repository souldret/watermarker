import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/hooks/useI18n';

const STEPS = ['wizard_1', 'wizard_2', 'wizard_3', 'wizard_4'] as const;

export default function Wizard() {
  const { t } = useI18n();
  const wizardDone = useAppStore((s) => s.ui.wizardDone);
  const setWizardDone = useAppStore((s) => s.setWizardDone);
  const [step, setStep] = useState(0);

  if (wizardDone) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-ink-border bg-ink-panel p-5 shadow-2xl">
        <h2 className="font-display text-lg font-bold text-ink-text">{t('wizard_title')}</h2>
        <ol className="mt-4 space-y-2">
          {STEPS.map((key, i) => (
            <li
              key={key}
              className={`rounded-lg border px-3 py-2 text-sm ${
                i === step
                  ? 'border-seal/40 bg-seal/10 text-ink-text'
                  : i < step
                    ? 'border-ink-border bg-ink-deep text-ink-muted'
                    : 'border-ink-border/50 text-ink-muted/70'
              }`}
            >
              <span className="mr-2 font-semibold text-seal">{i + 1}.</span>
              {t(key)}
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => setWizardDone(true)}>
            {t('wizard_skip')}
          </button>
          <div className="ml-auto flex gap-2">
            {step > 0 && (
              <button type="button" className="btn-secondary" onClick={() => setStep((s) => s - 1)}>
                {t('wizard_back')}
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)}>
                {t('wizard_next')}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => setWizardDone(true)}>
                {t('wizard_finish')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
