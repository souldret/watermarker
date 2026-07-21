import type { ProcessResult } from './types';

function downloadText(content: string, fileName: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function exportErrorsJson(result: ProcessResult, sourceLabel: string): void {
  const payload = {
    source: sourceLabel,
    exportedAt: new Date().toISOString(),
    summary: {
      totalChapters: result.totalChapters,
      totalImages: result.totalImages,
      success: result.success,
      failed: result.failed,
      skipped: result.skipped,
      elapsedMs: result.elapsedMs,
    },
    errors: result.errors,
  };
  downloadText(JSON.stringify(payload, null, 2), `${sourceLabel || 'watermark'}-errors.json`, 'application/json');
}

export function exportErrorsCsv(result: ProcessResult, sourceLabel: string): void {
  const rows = [['path', 'message']];
  for (const e of result.errors) {
    rows.push([csvEscape(e.path), csvEscape(e.message)]);
  }
  const body = rows.map((r) => r.join(',')).join('\r\n');
  downloadText(body, `${sourceLabel || 'watermark'}-errors.csv`, 'text/csv;charset=utf-8');
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
