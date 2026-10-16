import { inflateRawSync } from 'zlib';

// Reads the entries of a ZIP archive (stored or deflated, as the SIA
// download is), from its central directory.

export interface ZipEntry {
  name: string;
  read: () => Buffer;
}

export class ZipError extends Error {}

export function readZip(buffer: Buffer): ZipEntry[] {
  // End of central directory record, searched from the end (comment ≤ 64 KB).
  let eocd = -1;
  for (
    let i = buffer.length - 22;
    i >= Math.max(0, buffer.length - 65_557);
    i--
  ) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new ZipError('Not a ZIP archive');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50)
      throw new ZipError('Bad central directory');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString('utf8');
    offset += 46 + nameLength + extraLength + commentLength;
    entries.push({
      name,
      read: () => {
        if (buffer.readUInt32LE(localOffset) !== 0x04034b50)
          throw new ZipError('Bad local header');
        const localName = buffer.readUInt16LE(localOffset + 26);
        const localExtra = buffer.readUInt16LE(localOffset + 28);
        const start = localOffset + 30 + localName + localExtra;
        const data = buffer.subarray(start, start + compressedSize);
        if (method === 0) return Buffer.from(data);
        if (method === 8) return inflateRawSync(data);
        throw new ZipError(
          `Unsupported compression method ${method} for ${name}`,
        );
      },
    });
  }
  return entries;
}
