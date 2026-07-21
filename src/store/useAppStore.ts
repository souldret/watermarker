import { create } from 'zustand';
import type {
  AppLocale,
  AppPreset,
  AppTheme,
  ChapterJob,
  GifPolicy,
  LogEntry,
  NamingPattern,
  OutputFormat,
  OutputTarget,
  PageFilter,
  ProcessCheckpoint,
  ProcessMode,
  ProcessProgress,
  ProcessResult,
  SizeMode,
  TextWatermark,
  UiPrefs,
  WatermarkPosition,
  WatermarkSettings,
} from '@/lib/types';
import { DEFAULT_PAGE_FILTER, DEFAULT_TEXT_WATERMARK } from '@/lib/types';
import type { LogoSource } from '@/lib/watermark';
import {
  createPreset,
  deletePreset,
  loadPresets,
  mergeFilter,
  mergeSettings,
  savePresets,
} from '@/lib/presets';
import { applyThemeToDom, loadUiPrefs, saveUiPrefs } from '@/lib/uiPrefs';

interface AppState {
  mode: ProcessMode;
  logoFile: File | null;
  logoUrl: string | null;
  logoSource: LogoSource | null;
  settings: WatermarkSettings;
  pageFilter: PageFilter;
  chapters: ChapterJob[];
  sourceLabel: string;
  isProcessing: boolean;
  cancelFlag: boolean;
  progress: ProcessProgress | null;
  result: ProcessResult | null;
  logs: LogEntry[];
  previewImageUrl: string | null;
  previewPath: string | null;
  presets: AppPreset[];
  checkpoint: ProcessCheckpoint | null;
  ui: UiPrefs;

  setMode: (mode: ProcessMode) => void;
  setLogo: (file: File | null, source: LogoSource | null) => void;
  patchSettings: (partial: Partial<WatermarkSettings>) => void;
  patchTextWatermark: (partial: Partial<TextWatermark>) => void;
  togglePosition: (position: WatermarkPosition) => void;
  setPositions: (positions: WatermarkPosition[]) => void;
  setSizeMode: (mode: SizeMode) => void;
  setSizePercent: (v: number) => void;
  setSizePx: (v: number) => void;
  setOpacity: (v: number) => void;
  setMarginPx: (v: number) => void;
  setRotation: (v: number) => void;
  setOutputQuality: (v: number) => void;
  setOutputFormat: (f: OutputFormat) => void;
  setNamingPattern: (p: NamingPattern) => void;
  setNamingCustom: (v: string) => void;
  setOutputTarget: (t: OutputTarget) => void;
  setGifPolicy: (p: GifPolicy) => void;
  setSmartPosition: (v: boolean) => void;
  setLargeFileMb: (v: number) => void;
  patchPageFilter: (partial: Partial<PageFilter>) => void;
  setChapters: (chapters: ChapterJob[], sourceLabel: string) => void;
  setPreviewByPath: (path: string | null) => void;
  setProcessing: (v: boolean) => void;
  requestCancel: () => void;
  resetCancel: () => void;
  setProgress: (p: ProcessProgress | null) => void;
  setResult: (r: ProcessResult | null) => void;
  addLog: (level: LogEntry['level'], message: string) => void;
  clearLogs: () => void;
  setCheckpoint: (cp: ProcessCheckpoint | null) => void;
  clearCheckpoint: () => void;
  reloadPresets: () => void;
  setPresets: (list: AppPreset[]) => void;
  saveCurrentPreset: (name: string) => void;
  applyPreset: (id: string) => void;
  removePreset: (id: string) => void;
  applyQualityPreset: (format: OutputFormat, quality: number) => void;
  setLocale: (locale: AppLocale) => void;
  setTheme: (theme: AppTheme) => void;
  setCompact: (compact: boolean) => void;
  setWizardDone: (done: boolean) => void;
  resetAll: () => void;
}

let logSeq = 0;

function findImageFile(chapters: ChapterJob[], path: string | null) {
  if (!path) return null;
  for (const ch of chapters) {
    const hit = ch.images.find((i) => i.path === path);
    if (hit) return hit;
  }
  return null;
}

const initialUi = loadUiPrefs();
if (typeof document !== 'undefined') {
  applyThemeToDom(initialUi.theme, initialUi.compact);
}

export const useAppStore = create<AppState>((set, get) => ({
  mode: 'single',
  logoFile: null,
  logoUrl: null,
  logoSource: null,
  settings: mergeSettings(),
  pageFilter: { ...DEFAULT_PAGE_FILTER },
  chapters: [],
  sourceLabel: '',
  isProcessing: false,
  cancelFlag: false,
  progress: null,
  result: null,
  logs: [],
  previewImageUrl: null,
  previewPath: null,
  presets: loadPresets(),
  checkpoint: null,
  ui: initialUi,

  setMode: (mode) =>
    set({
      mode,
      chapters: [],
      sourceLabel: '',
      result: null,
      progress: null,
      previewImageUrl: null,
      previewPath: null,
      checkpoint: null,
    }),

  setLogo: (file, source) => {
    const prev = get().logoUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({
      logoFile: file,
      logoSource: source,
      logoUrl: file ? URL.createObjectURL(file) : null,
    });
  },

  patchSettings: (partial) =>
    set((s) => ({
      settings: {
        ...s.settings,
        ...partial,
        positions: partial.positions ? [...partial.positions] : s.settings.positions,
        textWatermark: partial.textWatermark
          ? { ...s.settings.textWatermark, ...partial.textWatermark }
          : s.settings.textWatermark,
      },
    })),

  patchTextWatermark: (partial) =>
    set((s) => ({
      settings: {
        ...s.settings,
        textWatermark: {
          ...DEFAULT_TEXT_WATERMARK,
          ...s.settings.textWatermark,
          ...partial,
        },
      },
    })),

  togglePosition: (position) =>
    set((s) => {
      const has = s.settings.positions.includes(position);
      let next = has
        ? s.settings.positions.filter((p) => p !== position)
        : [...s.settings.positions, position];
      if (next.length === 0) next = [position];
      return { settings: { ...s.settings, positions: next } };
    }),

  setPositions: (positions) =>
    set((s) => ({
      settings: { ...s.settings, positions: positions.length ? positions : ['br'] },
    })),

  setSizeMode: (sizeMode) => set((s) => ({ settings: { ...s.settings, sizeMode } })),
  setSizePercent: (sizePercent) => set((s) => ({ settings: { ...s.settings, sizePercent } })),
  setSizePx: (sizePx) => set((s) => ({ settings: { ...s.settings, sizePx } })),
  setOpacity: (opacity) => set((s) => ({ settings: { ...s.settings, opacity } })),
  setMarginPx: (marginPx) => set((s) => ({ settings: { ...s.settings, marginPx } })),
  setRotation: (rotation) => set((s) => ({ settings: { ...s.settings, rotation } })),
  setOutputQuality: (outputQuality) =>
    set((s) => ({ settings: { ...s.settings, outputQuality } })),
  setOutputFormat: (outputFormat) => set((s) => ({ settings: { ...s.settings, outputFormat } })),
  setNamingPattern: (namingPattern) =>
    set((s) => ({ settings: { ...s.settings, namingPattern } })),
  setNamingCustom: (namingCustom) => set((s) => ({ settings: { ...s.settings, namingCustom } })),
  setOutputTarget: (outputTarget) => set((s) => ({ settings: { ...s.settings, outputTarget } })),
  setGifPolicy: (gifPolicy) => set((s) => ({ settings: { ...s.settings, gifPolicy } })),
  setSmartPosition: (smartPosition) =>
    set((s) => ({ settings: { ...s.settings, smartPosition } })),
  setLargeFileMb: (largeFileMb) => set((s) => ({ settings: { ...s.settings, largeFileMb } })),

  patchPageFilter: (partial) => set((s) => ({ pageFilter: { ...s.pageFilter, ...partial } })),

  setChapters: (chapters, sourceLabel) => {
    const prev = get().previewImageUrl;
    if (prev) URL.revokeObjectURL(prev);
    const first = chapters[0]?.images[0] ?? null;
    set({
      chapters,
      sourceLabel,
      result: null,
      progress: null,
      checkpoint: null,
      previewPath: first?.path ?? null,
      previewImageUrl: first ? URL.createObjectURL(first.file) : null,
    });
  },

  setPreviewByPath: (path) => {
    const { chapters, previewImageUrl } = get();
    const img = findImageFile(chapters, path);
    if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
    set({
      previewPath: path,
      previewImageUrl: img ? URL.createObjectURL(img.file) : null,
    });
  },

  setProcessing: (isProcessing) => set({ isProcessing }),
  requestCancel: () => set({ cancelFlag: true }),
  resetCancel: () => set({ cancelFlag: false }),
  setProgress: (progress) => set({ progress }),
  setResult: (result) => set({ result }),

  addLog: (level, message) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${logSeq++}`,
      time: new Date().toLocaleTimeString(get().ui.locale === 'en' ? 'en-US' : 'tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      level,
      message,
    };
    set((s) => ({ logs: [...s.logs.slice(-250), entry] }));
  },

  clearLogs: () => set({ logs: [] }),
  setCheckpoint: (checkpoint) => set({ checkpoint }),
  clearCheckpoint: () => set({ checkpoint: null }),
  reloadPresets: () => set({ presets: loadPresets() }),
  setPresets: (presets) => {
    savePresets(presets);
    set({ presets });
  },

  saveCurrentPreset: (name) => {
    const { settings, pageFilter, presets } = get();
    const p = createPreset(name, settings, pageFilter);
    const next = [p, ...presets].slice(0, 30);
    savePresets(next);
    set({ presets: next });
  },

  applyPreset: (id) => {
    const p = get().presets.find((x) => x.id === id);
    if (!p) return;
    set({
      settings: mergeSettings(p.settings),
      pageFilter: mergeFilter(p.pageFilter),
    });
  },

  removePreset: (id) => {
    const next = deletePreset(get().presets, id);
    savePresets(next);
    set({ presets: next });
  },

  applyQualityPreset: (format, quality) =>
    set((s) => ({
      settings: { ...s.settings, outputFormat: format, outputQuality: quality },
    })),

  setLocale: (locale) => {
    const ui = { ...get().ui, locale };
    saveUiPrefs(ui);
    set({ ui });
  },

  setTheme: (theme) => {
    const ui = { ...get().ui, theme };
    saveUiPrefs(ui);
    applyThemeToDom(theme, ui.compact);
    set({ ui });
  },

  setCompact: (compact) => {
    const ui = { ...get().ui, compact };
    saveUiPrefs(ui);
    applyThemeToDom(ui.theme, compact);
    set({ ui });
  },

  setWizardDone: (wizardDone) => {
    const ui = { ...get().ui, wizardDone };
    saveUiPrefs(ui);
    set({ ui });
  },

  resetAll: () => {
    const { logoUrl, previewImageUrl, ui } = get();
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
    set({
      mode: 'single',
      logoFile: null,
      logoUrl: null,
      logoSource: null,
      settings: mergeSettings(),
      pageFilter: { ...DEFAULT_PAGE_FILTER },
      chapters: [],
      sourceLabel: '',
      isProcessing: false,
      cancelFlag: false,
      progress: null,
      result: null,
      logs: [],
      previewImageUrl: null,
      previewPath: null,
      checkpoint: null,
      presets: loadPresets(),
      ui,
    });
  },
}));
