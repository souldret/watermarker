export async function pickOutputDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (typeof window.showDirectoryPicker !== 'function') return null;
  try {
    return await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch {
    return null;
  }
}

async function ensureDir(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(name, { create: true });
}

/** chapter/fileName altına blob yazar */
export async function writeBlobToTree(
  root: FileSystemDirectoryHandle,
  chapterName: string,
  fileName: string,
  blob: Blob,
): Promise<void> {
  const safeChapter = chapterName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'bolum';
  const safeFile =
    fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'image.jpg';
  const chapterDir = await ensureDir(root, safeChapter);
  const fileHandle = await chapterDir.getFileHandle(safeFile, { create: true });
  if (typeof fileHandle.createWritable !== 'function') {
    throw new Error('Bu tarayıcı klasöre yazmayı desteklemiyor');
  }
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

export async function writeErrorsReport(
  root: FileSystemDirectoryHandle,
  content: string,
  fileName: string,
): Promise<void> {
  const fileHandle = await root.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
