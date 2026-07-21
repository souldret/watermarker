import { useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { t, type I18nKey } from '@/lib/i18n';

export function useI18n() {
  const locale = useAppStore((s) => s.ui.locale);
  const tr = useCallback((key: I18nKey) => t(locale, key), [locale]);
  return { locale, t: tr };
}
