export type WatermarkPosition =
  | 'tl'
  | 'tc'
  | 'tr'
  | 'ml'
  | 'mc'
  | 'mr'
  | 'bl'
  | 'bc'
  | 'br';

export type ProcessMode = 'single' | 'batch';
export type OutputFormat = 'same' | 'jpeg' | 'png' | 'webp';
export type SizeMode = 'percent' | 'px';
export type OutputTarget = 'zip' | 'folder';
export type NamingPattern = 'original' | 'suffix' | 'prefix' | 'chapter_index' | 'custom';
export type GifPolicy = 'skip' | 'first_frame' | 'warn';
export type AppLocale = 'tr' | 'en';
export type AppTheme = 'dark' | 'light';

export interface ImageFile {
  name: string;
  path: string;
  file: File;
}

export interface ChapterJob {
  name: string;
  images: ImageFile[];
}

export interface PageFilter {
  enabled: boolean;
  firstN: number;
  lastN: number;
  coverOnly: boolean;
  rangeFrom: number;
  rangeTo: number;
  skipNames: string;
}

export interface TextWatermark {
  enabled: boolean;
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: WatermarkPosition;
}

/** Serbest piksel konum (interaktif önizlemeden sürükle/tıkla) */
export interface CustomXY {
  /** 0–1 oranı (görsel genişliğine göre) */
  x: number;
  /** 0–1 oranı (görsel yüksekliğine göre) */
  y: number;
}

/** İkinci logo ayarları */
export interface Logo2Settings {
  /** Aktif mi */
  enabled: boolean;
  positions: WatermarkPosition[];
  /** Serbest koordinat (null = ızgara konumu kullan) */
  customXY: CustomXY | null;
  sizeMode: SizeMode;
  sizePercent: number;
  sizePx: number;
  opacity: number;
  rotation: number;
}

export interface WatermarkSettings {
  positions: WatermarkPosition[];
  /** Logo 1 için serbest koordinat (null = ızgara kullan) */
  logo1CustomXY: CustomXY | null;
  sizeMode: SizeMode;
  sizePercent: number;
  sizePx: number;
  opacity: number;
  marginPx: number;
  rotation: number;
  outputQuality: number;
  outputFormat: OutputFormat;
  namingPattern: NamingPattern;
  namingCustom: string;
  outputTarget: OutputTarget;
  /** Boş kenar tespiti ile konum öner / uygula */
  smartPosition: boolean;
  gifPolicy: GifPolicy;
  textWatermark: TextWatermark;
  /** MB cinsinden uyarı eşiği */
  largeFileMb: number;
  /** İkinci logo ayarları */
  logo2: Logo2Settings;
}

export interface AppPreset {
  id: string;
  name: string;
  settings: WatermarkSettings;
  pageFilter: PageFilter;
  createdAt: number;
}

/** Ekip şablon paketi (logo base64 opsiyonel + preset listesi) */
export interface TemplatePack {
  version: 1;
  name: string;
  exportedAt: string;
  presets: AppPreset[];
  /** data URL veya boş */
  logoDataUrl?: string;
  logoFileName?: string;
}

export interface ProcessResult {
  totalChapters: number;
  totalImages: number;
  success: number;
  failed: number;
  skipped: number;
  errors: { path: string; message: string }[];
  elapsedMs: number;
  bytesIn: number;
  bytesOut: number;
}

export interface ProcessProgress {
  current: number;
  total: number;
  chapterName: string;
  fileName: string;
  percent: number;
  phase: 'process' | 'zip' | 'write';
}

export interface LogEntry {
  id: string;
  time: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface ProcessCheckpoint {
  sourceLabel: string;
  mode: ProcessMode;
  nextGlobalIndex: number;
  success: number;
  failed: number;
  skipped: number;
  errors: { path: string; message: string }[];
  startedAt: number;
  bytesIn: number;
  bytesOut: number;
}

export interface FlatJob {
  globalIndex: number;
  chapterName: string;
  image: ImageFile;
  imageIndexInChapter: number;
  chapterImageCount: number;
}

export interface UiPrefs {
  locale: AppLocale;
  theme: AppTheme;
  compact: boolean;
  wizardDone: boolean;
}

export const DEFAULT_PAGE_FILTER: PageFilter = {
  enabled: false,
  firstN: 0,
  lastN: 0,
  coverOnly: false,
  rangeFrom: 0,
  rangeTo: 0,
  skipNames: 'credit,thanks,teşekkür,tesekkur',
};

export const DEFAULT_TEXT_WATERMARK: TextWatermark = {
  enabled: false,
  text: '@team',
  fontSize: 28,
  color: '#FFFFFF',
  opacity: 0.65,
  position: 'bl',
};

export const DEFAULT_LOGO2: Logo2Settings = {
  enabled: false,
  positions: ['bl'],
  customXY: null,
  sizeMode: 'percent',
  sizePercent: 10,
  sizePx: 150,
  opacity: 0.55,
  rotation: 0,
};

export const DEFAULT_SETTINGS: WatermarkSettings = {
  positions: ['br'],
  logo1CustomXY: null,
  sizeMode: 'percent',
  sizePercent: 12,
  sizePx: 180,
  opacity: 0.55,
  marginPx: 24,
  rotation: 0,
  outputQuality: 0.92,
  outputFormat: 'same',
  namingPattern: 'original',
  namingCustom: '{chapter}_{index}_{name}',
  outputTarget: 'zip',
  smartPosition: false,
  gifPolicy: 'first_frame',
  textWatermark: { ...DEFAULT_TEXT_WATERMARK },
  largeFileMb: 25,
  logo2: { ...DEFAULT_LOGO2 },
};

export const DEFAULT_UI_PREFS: UiPrefs = {
  locale: 'tr',
  theme: 'dark',
  compact: false,
  wizardDone: false,
};

export const QUALITY_PRESETS: {
  id: string;
  labelKey: 'qp_publish' | 'qp_archive' | 'qp_fast' | 'qp_same';
  format: OutputFormat;
  quality: number;
}[] = [
  { id: 'publish', labelKey: 'qp_publish', format: 'webp', quality: 0.85 },
  { id: 'archive', labelKey: 'qp_archive', format: 'png', quality: 1 },
  { id: 'fast', labelKey: 'qp_fast', format: 'jpeg', quality: 0.9 },
  { id: 'same', labelKey: 'qp_same', format: 'same', quality: 0.92 },
];
