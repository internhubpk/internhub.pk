/**
 * ============================================================================
 * OLE Package Builder — embeds real files inside a Word (.docx) document
 * ----------------------------------------------------------------------------
 * Word's native "Insert > Object > Create from File" stores the file inside
 * `word/embeddings/oleObjectN.bin` — an OLE2 Compound File (CFB) that wraps
 * the original bytes in an "Ole10Native" stream. Double-clicking the object
 * in Word opens the ORIGINAL file.
 *
 * This module builds that structure with zero runtime dependencies:
 *
 *   oleObjectN.bin (CFB v3, 512-byte sectors)
 *   ├── Root Entry
 *   │     ├── "\u0001CompObj"      — legacy display-name cache (optional but
 *   │     │                          included for maximum reader compat)
 *   │     ├── "\u0001Ole"          — 20-byte OLE version header
 *   │     └── "\u0001Ole10Native"  — [size][0x0002][label\0][path\0]
 *   │                                 [00 00 03 00][len\0][fileLen][bytes]
 *
 * The Ole10Native payload layout is crafted to be readable by BOTH common
 * parser families found in the wild (OfficeExtractor-style readers and
 * oletools-style readers) — see comments in buildOle10NativeStream().
 *
 * CFB writer notes:
 *   - All streams are padded to ≥ 4096 bytes so everything lives in regular
 *     FAT sectors — no mini-FAT is needed (padding is invisible to readers:
 *     they parse by declared stream size and internal length fields).
 *   - DIFAT chaining is implemented, so files larger than ~6.8 MB (the
 *     109-FAT-sector header limit) are supported up to the 10 MB evidence cap.
 *   - Directory entries form a valid sorted binary tree (CFB name order:
 *     length first, then UTF-16 code units).
 */

// ---------------------------------------------------------------------------
// Ole10Native stream
// ---------------------------------------------------------------------------

/**
 * Build the "\u0001Ole10Native" stream bytes for an embedded file.
 *
 * Layout (offsets after the leading DWORD):
 *
 *   DWORD  totalSize          size of everything that follows this field
 *   WORD   0x0002             signature (embedded file)
 *   ASCIZ  label              display filename
 *   ASCIZ  filePath           original path (readers take basename anyway)
 *   WORD   0x0000             ┐ OfficeExtractor: 2 unused bytes + WORD 0x0003
 *   WORD   0x0003             ┘ (same 4 bytes = "unknown_long_1" for oletools)
 *   DWORD  1                  ┐ OfficeExtractor: length-prefixed temp path
 *   BYTE   0x00               ┘ (oletools: zero-terminated empty temp path)
 *   DWORD  fileLength
 *   BYTE[] fileData           the ORIGINAL file bytes, verbatim
 *
 * Readers recover the exact original file from [fileLength][fileData].
 */
export function buildOle10NativeStream(fileName: string, fileBuffer: Buffer): Buffer {
  // ANSI-safe label (filenames come from user uploads — keep ASCII-safe bytes,
  // replacing anything outside printable ASCII with '_').
  const ansiName = fileName.replace(/[^\x20-\x7E]/g, "_").slice(0, 200) || "attachment";
  const label = Buffer.from(ansiName + "\0", "latin1");
  const path = Buffer.from(ansiName + "\0", "latin1");

  // [WORD 0x0002][label][path][00 00 03 00][DWORD 1][0x00][DWORD len][data]
  const head = Buffer.alloc(2);
  head.writeUInt16LE(0x0002, 0);

  const mid = Buffer.alloc(4);
  mid.writeUInt16LE(0x0000, 0); // OfficeExtractor: 2 unused bytes
  mid.writeUInt16LE(0x0003, 2); // format = embedded file / oletools: part of unknown_long_1

  const tempPath = Buffer.alloc(5); // DWORD length=1 + single NUL byte
  tempPath.writeUInt32LE(1, 0);
  tempPath.writeUInt8(0x00, 4);

  const sizeField = Buffer.alloc(4);
  sizeField.writeUInt32LE(fileBuffer.length, 0);

  const payload = Buffer.concat([head, label, path, mid, tempPath, sizeField, fileBuffer]);

  const sizePrefix = Buffer.alloc(4);
  sizePrefix.writeUInt32LE(payload.length, 0);
  return Buffer.concat([sizePrefix, payload]);
}

/**
 * Build the "\u0001CompObj" stream (legacy display-name cache).
 * Layout: 28-byte header (all values "MUST be ignored on processing" per
 * MS-OLEDS) + LengthPrefixedAnsiString AnsiUserType + MarkerOrLength=0.
 */
export function buildCompObjStream(): Buffer {
  const header = Buffer.alloc(28); // Reserved1 + Version + Reserved2 — zeros are legal
  const userType = Buffer.from("OLE Package\0", "latin1"); // what OfficeExtractor switches on
  const lenPrefix = Buffer.alloc(4);
  lenPrefix.writeUInt32LE(userType.length, 0);
  const marker = Buffer.alloc(4); // 0x00000000 → no FormatOrAnsiString field
  return Buffer.concat([header, lenPrefix, userType, marker]);
}

/**
 * Build the "\u0001Ole" stream (20-byte OLE version header).
 * 0x02000001 little-endian followed by 16 zero bytes — the standard header
 * Word itself writes.
 */
export function buildOleStream(): Buffer {
  const buf = Buffer.alloc(20);
  buf.writeUInt32LE(0x02000001, 0);
  return buf;
}

// ---------------------------------------------------------------------------
// Minimal CFB (Compound File Binary) writer
// ---------------------------------------------------------------------------

const SECTOR_SIZE = 512;
const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;
const FATSECT = 0xfffffffd;
const NOSTREAM = 0xffffffff;

interface CfbStream {
  name: string; // e.g. "\u0001Ole10Native"
  data: Buffer; // raw data (will be padded to ≥4096 + sector-aligned)
}

/** CFB name comparison: length first, then UTF-16 code units (per spec). */
function cfbNameLess(a: string, b: string): boolean {
  if (a.length !== b.length) return a.length < b.length;
  for (let i = 0; i < a.length; i++) {
    const ca = a.charCodeAt(i);
    const cb = b.charCodeAt(i);
    if (ca !== cb) return ca < cb;
  }
  return false;
}

/**
 * Build a CFB v3 file containing the given streams under the Root Entry.
 * All streams are stored in the regular FAT (each padded to ≥ 4096 bytes and
 * to a whole number of sectors), so no mini-FAT is required.
 */
export function buildCfb(streams: Array<{ name: string; data: Buffer }>): Buffer {
  // -- 1. Pad every stream to ≥ 4096 bytes (avoids the mini stream) and to a
  //       whole number of sectors.
  const padded = streams.map((s) => {
    let data = s.data;
    if (data.length < 4096) {
      data = Buffer.concat([data, Buffer.alloc(4096 - data.length)]);
    }
    const rem = data.length % SECTOR_SIZE;
    if (rem !== 0) {
      data = Buffer.concat([data, Buffer.alloc(SECTOR_SIZE - rem)]);
    }
    return { name: s.name, data };
  });

  // -- 2. Lay out stream sectors.
  //       Sector N of the file holds the data starting at byte N*512+512.
  //       We simply place streams back-to-back starting at sector 0.
  let nextSector = 0;
  const entries = padded.map((s) => {
    const sectorCount = s.data.length / SECTOR_SIZE;
    const startSector = nextSector;
    nextSector += sectorCount;
    return { name: s.name, data: s.data, startSector, sectorCount };
  });

  // -- 3. Reserve FAT sectors after the stream sectors.
  //       Iterate: number of FAT sectors needed depends on total sectors
  //       including the FAT sectors themselves.
  let totalDataSectors = nextSector;
  let fatSectorCount = 0;
  for (;;) {
    const totalSectors = totalDataSectors + fatSectorCount;
    const needed = Math.ceil(totalSectors / (SECTOR_SIZE / 4));
    if (needed <= fatSectorCount) break;
    fatSectorCount = needed;
  }
  const totalSectors = totalDataSectors + fatSectorCount;
  const fatStartSector = totalDataSectors;

  // -- 4. Build the FAT.
  const fatEntries = new Uint32Array(fatSectorCount * (SECTOR_SIZE / 4));
  for (const e of entries) {
    for (let i = 0; i < e.sectorCount; i++) {
      const sec = e.startSector + i;
      fatEntries[sec] = i === e.sectorCount - 1 ? ENDOFCHAIN : sec + 1;
    }
  }
  for (let i = 0; i < fatSectorCount; i++) {
    fatEntries[fatStartSector + i] = FATSECT;
  }
  for (let i = totalSectors; i < fatEntries.length; i++) {
    fatEntries[i] = FREESECT;
  }

  // -- 5. Build the directory (128-byte entries).
  //       id 0 = Root Entry (mini stream unused: size 0, start ENDOFCHAIN).
  //       Children sorted by CFB name order into a balanced BST.
  const sorted = [...entries].sort((a, b) => (cfbNameLess(a.name, b.name) ? -1 : cfbNameLess(b.name, a.name) ? 1 : 0));
  const dirCount = 1 + sorted.length;
  const dirSectors = Math.ceil((dirCount * 128) / SECTOR_SIZE);
  const dirStartSector = fatStartSector + fatSectorCount;

  // Assign directory entry ids: root = 0, sorted streams = 1..n.
  const idOf = new Map<string, number>();
  sorted.forEach((e, i) => idOf.set(e.name, i + 1));

  // Balanced BST over sorted order: children point into the id space which
  // matches sorted order (id i+1 ↔ sorted[i]).
  function buildTree(lo: number, hi: number): { id: number | null; roots: Map<number, { left: number | null; right: number | null }> } {
    const roots = new Map<number, { left: number | null; right: number | null }>();
    function rec(l: number, r: number): number | null {
      if (l > r) return null;
      const mid = (l + r) >> 1;
      const id = mid + 1; // sorted[mid] ↔ directory id mid+1
      const left = rec(l, mid - 1);
      const right = rec(mid + 1, r);
      roots.set(id, { left: left === null ? null : left, right: right === null ? null : right });
      return id;
    }
    const root = rec(lo, hi);
    return { id: root, roots };
  }
  const { id: childRootId, roots } = buildTree(0, sorted.length - 1);

  const dir = Buffer.alloc(dirSectors * SECTOR_SIZE);
  function writeDirEntry(
    id: number,
    name: string,
    type: 1 | 2 | 5,
    left: number | null,
    right: number | null,
    child: number | null,
    startSector: number,
    streamSize: number
  ) {
    const off = id * 128;
    // name: UTF-16LE + NUL, max 64 bytes
    const nameBuf = Buffer.from(name + "\0", "utf16le");
    nameBuf.copy(dir, off, 0, Math.min(nameBuf.length, 64));
    dir.writeUInt16LE(Math.min(nameBuf.length, 64), off + 64); // name length incl. NUL, in bytes
    dir.writeUInt8(type, off + 66); // 1=storage 2=stream 5=root
    dir.writeUInt8(1, off + 67); // black
    dir.writeUInt32LE(left === null ? NOSTREAM : left, off + 68);
    dir.writeUInt32LE(right === null ? NOSTREAM : right, off + 72);
    dir.writeUInt32LE(child === null ? NOSTREAM : child, off + 76);
    // CLSID (16 bytes zero) at off+80
    // state bits + times zero
    dir.writeUInt32LE(startSector, off + 116);
    dir.writeUInt32LE(streamSize % 4294967296, off + 120);
    dir.writeUInt32LE(Math.floor(streamSize / 4294967296), off + 124);
  }
  // Root Entry: mini stream empty (size 0, start ENDOFCHAIN).
  writeDirEntry(0, "Root Entry", 5, null, null, childRootId, ENDOFCHAIN, 0);
  sorted.forEach((e, i) => {
    const id = i + 1;
    const links = roots.get(id)!;
    // NOTE: the stream SIZE is the padded size (≥4096) so no reader ever
    // routes it through the mini-FAT. Readers parse contents by the internal
    // length fields, so trailing zeros are ignored.
    writeDirEntry(id, e.name, 2, links.left, links.right, null, e.startSector, e.data.length);
  });
  // Chain directory sectors in the FAT.
  for (let i = 0; i < dirSectors; i++) {
    fatEntries[dirStartSector + i] = i === dirSectors - 1 ? ENDOFCHAIN : dirStartSector + i + 1;
  }

  // -- 6. DIFAT: first 109 FAT sector ids in the header; the rest chained
  //       through extra DIFAT sectors (each holds 128 ids + next pointer).
  const fatIds: number[] = [];
  for (let i = 0; i < fatSectorCount; i++) fatIds.push(fatStartSector + i);
  const headerFatIds = fatIds.slice(0, 109);
  const extraFatIds = fatIds.slice(109);

  const difatSectors: Buffer[] = [];
  let remaining = [...extraFatIds];
  const perDifat = 127; // 128 slots − 1 for the next-DIFAT pointer
  const difatCount = remaining.length === 0 ? 0 : Math.ceil(remaining.length / perDifat);
  const difatStartSector = dirStartSector + dirSectors;
  for (let i = 0; i < difatCount; i++) {
    const chunk = remaining.slice(0, perDifat);
    remaining = remaining.slice(perDifat);
    const sec = Buffer.alloc(SECTOR_SIZE);
    chunk.forEach((id, j) => sec.writeUInt32LE(id, j * 4));
    for (let j = chunk.length; j < perDifat; j++) sec.writeUInt32LE(FREESECT, j * 4);
    sec.writeUInt32LE(i === difatCount - 1 ? ENDOFCHAIN : difatStartSector + i + 1, 127 * 4);
    difatSectors.push(sec);
  }

  // -- 7. Assemble the file.
  const parts: Buffer[] = [];

  const header = Buffer.alloc(SECTOR_SIZE);
  header.write("\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1", 0, "binary"); // signature
  header.writeUInt16LE(0x003e, 24); // minor version
  header.writeUInt16LE(0x0003, 26); // major version (3)
  header.writeUInt16LE(0xfffe, 28); // little endian
  header.writeUInt16LE(9, 30); // sector shift → 512
  header.writeUInt16LE(6, 32); // mini sector shift → 64
  header.writeUInt32LE(0, 44); // number of FAT sectors (patched below)
  header.writeUInt32LE(dirStartSector, 48); // first directory sector
  header.writeUInt32LE(0, 56); // mini stream cutoff = 4096
  header.writeUInt32LE(ENDOFCHAIN, 60); // first mini FAT sector (none)
  header.writeUInt32LE(0, 64); // number of mini FAT sectors
  header.writeUInt32LE(difatCount === 0 ? ENDOFCHAIN : difatStartSector, 68); // first DIFAT sector
  header.writeUInt32LE(difatCount, 72); // number of DIFAT sectors
  header.writeUInt32LE(fatSectorCount, 44); // number of FAT sectors
  for (let i = 0; i < 109; i++) {
    header.writeUInt32LE(i < headerFatIds.length ? headerFatIds[i] : FREESECT, 76 + i * 4);
  }
  parts.push(header);

  // Stream sectors.
  for (const e of entries) parts.push(e.data);
  // FAT sectors.
  const fatBuf = Buffer.from(fatEntries.buffer, fatEntries.byteOffset, fatEntries.byteLength);
  parts.push(fatBuf);
  // Directory sectors.
  parts.push(dir);
  // Extra DIFAT sectors.
  for (const s of difatSectors) parts.push(s);

  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the complete `word/embeddings/oleObjectN.bin` payload that embeds
 * `fileName` (with its verbatim bytes) as a Word OLE package object.
 */
export function buildOleObjectBin(fileName: string, fileBuffer: Buffer): Buffer {
  return buildCfb([
    { name: "\u0001CompObj", data: buildCompObjStream() },
    { name: "\u0001Ole", data: buildOleStream() },
    { name: "\u0001Ole10Native", data: buildOle10NativeStream(fileName, fileBuffer) },
  ]);
}
