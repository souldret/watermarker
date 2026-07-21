import type { ChapterJob, ImageFile, ProcessMode } from './types';
import { sortByNameNatural } from './sortNatural';

const IMAGE_EXT = /\.(jpe?g|png|webp|bmp|gif)$/i;

export type DirectoryPickResult =
  | { status: 'ok'; handle: FileSystemDirectoryHandle }
  | { status: 'cancelled' }
  | { status: 'unsupported' };

export function isImageFile(name: string): boolean {
  return IMAGE_EXT.test(name);
}

function toImageFile(file: File, path: string): ImageFile {
  return { name: file.name, path, file };
}

/** File System Access API: dizin handle'ından görselleri oku (düz, recursive değil). */
export async function readImagesFromDir(
  dir: FileSystemDirectoryHandle,
  prefix = '',
): Promise<ImageFile[]> {
  const images: ImageFile[] = [];

  // entries() her tarayıcıda yoksa values() dene
  const iterable =
    typeof dir.entries === 'function'
      ? dir.entries()
      : (async function* () {
          for await (const handle of dir.values()) {
            yield [handle.name, handle] as [string, FileSystemHandle];
          }
        })();

  for await (const [name, handle] of iterable) {
    if (handle.kind !== 'file' || !isImageFile(name)) continue;
    try {
      const fileHandle = handle as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      const path = prefix ? `${prefix}/${name}` : name;
      images.push(toImageFile(file, path));
    } catch {
      // okunamayan dosyayı atla
    }
  }
  return sortByNameNatural(images);
}

/** Tekli: bir bölüm klasörü. Çoklu: her alt klasör bir bölüm. */
export async function scanFromDirectoryHandle(
  root: FileSystemDirectoryHandle,
  mode: ProcessMode,
): Promise<ChapterJob[]> {
  if (mode === 'single') {
    const images = await readImagesFromDir(root, root.name);
    return [{ name: root.name, images }];
  }

  const chapters: ChapterJob[] = [];
  const subdirs: FileSystemDirectoryHandle[] = [];

  const iterable =
    typeof root.entries === 'function'
      ? root.entries()
      : (async function* () {
          for await (const handle of root.values()) {
            yield [handle.name, handle] as [string, FileSystemHandle];
          }
        })();

  for await (const [name, handle] of iterable) {
    if (handle.kind === 'directory') {
      subdirs.push(handle as FileSystemDirectoryHandle);
    }
  }

  subdirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  for (const sub of subdirs) {
    const images = await readImagesFromDir(sub, `${root.name}/${sub.name}`);
    if (images.length > 0) {
      chapters.push({ name: sub.name, images });
    }
  }

  // Alt klasör yoksa kökteki görselleri tek bölüm say
  if (chapters.length === 0) {
    const rootImages = await readImagesFromDir(root, root.name);
    if (rootImages.length > 0) {
      chapters.push({ name: root.name, images: rootImages });
    }
  }

  return chapters;
}

/**
 * <input webkitdirectory> FileList yedeği.
 * single: tüm görseller tek bölüm
 * batch: Seri/Bölüm/dosya → bölüm adı
 */
export function scanFromFileList(files: FileList | File[], mode: ProcessMode): ChapterJob[] {
  const list = Array.from(files).filter((f) => isImageFile(f.name));
  if (list.length === 0) return [];

  if (mode === 'single') {
    // Sadece seçilen klasörün kök seviyesindeki görseller (alt klasördekiler hariç)
    // webkitRelativePath: "Bolum01/001.jpg" → depth 2
    // alt klasör: "Bolum01/extra/001.jpg" → depth 3 → tekli modda genelde istemeyiz
    // ama manga bazen nested olmaz; kök + bir seviye al
    const rootName =
      (list[0].webkitRelativePath || list[0].name).split('/').filter(Boolean)[0] || 'bolum';

    const rootLevel = list.filter((f) => {
      const parts = (f.webkitRelativePath || f.name).split('/').filter(Boolean);
      // "Bolum/file.jpg" veya "file.jpg"
      return parts.length <= 2;
    });

    const useList = rootLevel.length > 0 ? rootLevel : list;
    const images = sortByNameNatural(
      useList.map((f) => toImageFile(f, f.webkitRelativePath || f.name)),
    );
    return [{ name: rootName, images }];
  }

  // Çoklu: path "Seri/Bolum01/001.jpg" → chapter Bolum01
  // "Bolum01/001.jpg" → chapter Bolum01
  const map = new Map<string, ImageFile[]>();

  for (const f of list) {
    const rel = f.webkitRelativePath || f.name;
    const parts = rel.split('/').filter(Boolean);
    let chapterName: string;

    if (parts.length >= 3) {
      chapterName = parts[1];
    } else if (parts.length === 2) {
      chapterName = parts[0];
    } else {
      chapterName = 'kok';
    }

    // Daha derin yuvalanmış dosyaları da bölüm altına al
    const arr = map.get(chapterName) || [];
    arr.push(toImageFile(f, rel));
    map.set(chapterName, arr);
  }

  const chapters: ChapterJob[] = [];
  for (const [name, images] of map.entries()) {
    chapters.push({ name, images: sortByNameNatural(images) });
  }
  chapters.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return chapters;
}

export function countImages(chapters: ChapterJob[]): number {
  return chapters.reduce((n, c) => n + c.images.length, 0);
}

export async function pickDirectory(): Promise<DirectoryPickResult> {
  if (typeof window.showDirectoryPicker !== 'function') {
    return { status: 'unsupported' };
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    return { status: 'ok', handle };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'cancelled' };
    }
    // Güvenlik / izin hatası → yedek seçici
    return { status: 'unsupported' };
  }
}
