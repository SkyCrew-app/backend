import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PDFContext,
  PDFDocument,
  PDFFont,
  PDFName,
  PDFRef,
  StandardFontEmbedder,
  StandardFonts,
} from 'pdf-lib';

// A TrueType font embedded in the PDF (FontFile2) as a simple font with the
// WinAnsi encoding: every viewer and printer then draws the text with the
// same glyphs, whatever fonts it has. pdf-lib only embeds TrueType fonts
// through fontkit; this embedder reads the few tables a simple font needs
// (head, hhea, hmtx, cmap, OS/2, post) and reuses pdf-lib's WinAnsi encoder,
// so the text given to it must stay within WinAnsi (see `printable`).

export const FONT_DIR = join(__dirname, 'fonts');
export const REGULAR_FONT_FILE = 'LiberationSans-Regular.ttf';
export const BOLD_FONT_FILE = 'LiberationSans-Bold.ttf';

export interface TrueTypeMetrics {
  postScriptName: string;
  unitsPerEm: number;
  bbox: [number, number, number, number];
  ascender: number;
  descender: number;
  capHeight: number;
  italicAngle: number;
  bold: boolean;
  // Advance width (font units) of the glyph of a Unicode code point.
  advanceOf: (codePoint: number) => number | null;
}

export function readTrueType(bytes: Buffer): TrueTypeMetrics {
  const tables = new Map<string, number>();
  const count = bytes.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const at = 12 + 16 * i;
    tables.set(
      bytes.toString('latin1', at, at + 4),
      bytes.readUInt32BE(at + 8),
    );
  }
  const table = (tag: string) => {
    const offset = tables.get(tag);
    if (offset === undefined) throw new Error(`TrueType table ${tag} missing`);
    return offset;
  };
  const head = table('head');
  const hhea = table('hhea');
  const hmtx = table('hmtx');
  const os2 = table('OS/2');
  const post = table('post');
  const unitsPerEm = bytes.readUInt16BE(head + 18);
  const metricsCount = bytes.readUInt16BE(hhea + 34);
  const advance = (glyph: number) =>
    bytes.readUInt16BE(hmtx + 4 * Math.min(glyph, metricsCount - 1));

  // cmap: the Windows Unicode BMP subtable, format 4.
  const cmap = table('cmap');
  let format4 = -1;
  for (let i = 0; i < bytes.readUInt16BE(cmap + 2); i++) {
    const at = cmap + 4 + 8 * i;
    if (bytes.readUInt16BE(at) === 3 && bytes.readUInt16BE(at + 2) === 1) {
      format4 = cmap + bytes.readUInt32BE(at + 4);
    }
  }
  if (format4 < 0 || bytes.readUInt16BE(format4) !== 4)
    throw new Error('TrueType cmap (3,1) format 4 missing');
  const segments = bytes.readUInt16BE(format4 + 6) / 2;
  const ends = format4 + 14;
  const starts = ends + 2 * segments + 2;
  const deltas = starts + 2 * segments;
  const rangeOffsets = deltas + 2 * segments;
  const glyphOf = (codePoint: number): number => {
    for (let s = 0; s < segments; s++) {
      if (codePoint > bytes.readUInt16BE(ends + 2 * s)) continue;
      const start = bytes.readUInt16BE(starts + 2 * s);
      if (codePoint < start) return 0;
      const delta = bytes.readInt16BE(deltas + 2 * s);
      const rangeOffset = bytes.readUInt16BE(rangeOffsets + 2 * s);
      if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
      const glyph = bytes.readUInt16BE(
        rangeOffsets + 2 * s + rangeOffset + 2 * (codePoint - start),
      );
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };

  const name = table('name');
  let postScriptName = 'EmbeddedFont';
  const records = bytes.readUInt16BE(name + 2);
  const strings = name + bytes.readUInt16BE(name + 4);
  for (let i = 0; i < records; i++) {
    const at = name + 6 + 12 * i;
    if (
      bytes.readUInt16BE(at) === 3 &&
      bytes.readUInt16BE(at + 6) === 6 // PostScript name
    ) {
      const length = bytes.readUInt16BE(at + 8);
      const offset = strings + bytes.readUInt16BE(at + 10);
      postScriptName = '';
      for (let c = 0; c < length; c += 2)
        postScriptName += String.fromCharCode(bytes.readUInt16BE(offset + c));
      break;
    }
  }

  const os2Version = bytes.readUInt16BE(os2);
  const ascender = bytes.readInt16BE(hhea + 4);
  return {
    postScriptName: postScriptName.replace(/[^A-Za-z0-9-]/g, ''),
    unitsPerEm,
    bbox: [
      bytes.readInt16BE(head + 36),
      bytes.readInt16BE(head + 38),
      bytes.readInt16BE(head + 40),
      bytes.readInt16BE(head + 42),
    ],
    ascender,
    descender: bytes.readInt16BE(hhea + 6),
    capHeight: os2Version >= 2 ? bytes.readInt16BE(os2 + 88) : ascender,
    italicAngle: bytes.readInt32BE(post + 4) / 65536,
    bold: bytes.readUInt16BE(os2 + 4) >= 600,
    advanceOf: (codePoint) => {
      const glyph = glyphOf(codePoint);
      return glyph === 0 ? null : advance(glyph);
    },
  };
}

/** Embeds a TrueType file as a WinAnsi simple font and returns a pdf-lib font. */
export function embedTrueType(doc: PDFDocument, bytes: Buffer): PDFFont {
  const metrics = readTrueType(bytes);
  const scale = 1000 / metrics.unitsPerEm;
  // pdf-lib's own embedder gives the WinAnsi encoding of the text; the
  // widths, the height and the PDF objects are those of the TrueType file.
  const embedder = StandardFontEmbedder.for(
    StandardFonts.Helvetica as unknown as Parameters<
      typeof StandardFontEmbedder.for
    >[0],
  );
  const encoding = embedder.encoding;
  const widthOf = (codePoint: number) =>
    (metrics.advanceOf(codePoint) ?? metrics.advanceOf(0x3f) ?? 0) * scale;
  const height = metrics.ascender - metrics.descender;

  Object.assign(embedder, {
    fontName: metrics.postScriptName,
    widthOfTextAtSize: (text: string, size: number) =>
      (Array.from(text).reduce(
        (sum, c) => sum + widthOf(c.codePointAt(0) ?? 0x3f),
        0,
      ) *
        size) /
      1000,
    heightOfFontAtSize: (size: number, options?: { descender?: boolean }) =>
      (((options?.descender ?? true) ? height : height + metrics.descender) /
        metrics.unitsPerEm) *
      size,
    sizeOfFontAtHeight: (value: number) =>
      (value * metrics.unitsPerEm) / height,
    embedIntoContext: (context: PDFContext, ref?: PDFRef) => {
      const widths: number[] = [];
      for (let code = 32; code <= 255; code++) {
        const point = encoding.supportedCodePoints.find(
          (p) => encoding.encodeUnicodeCodePoint(p).code === code,
        );
        widths.push(Math.round(point === undefined ? 0 : widthOf(point)));
      }
      const file = context.flateStream(bytes, { Length1: bytes.length });
      const descriptor = context.obj({
        Type: 'FontDescriptor',
        FontName: metrics.postScriptName,
        // Nonsymbolic (32), plus ForceBold for a bold face.
        Flags: 32 + (metrics.bold ? 262144 : 0),
        FontBBox: metrics.bbox.map((v) => Math.round(v * scale)),
        ItalicAngle: metrics.italicAngle,
        Ascent: Math.round(metrics.ascender * scale),
        Descent: Math.round(metrics.descender * scale),
        CapHeight: Math.round(metrics.capHeight * scale),
        StemV: metrics.bold ? 120 : 80,
        FontFile2: context.register(file),
      });
      const dict = context.obj({
        Type: 'Font',
        Subtype: 'TrueType',
        BaseFont: metrics.postScriptName,
        FirstChar: 32,
        LastChar: 255,
        Widths: widths,
        Encoding: PDFName.of('WinAnsiEncoding'),
        FontDescriptor: context.register(descriptor),
      });
      if (ref) {
        context.assign(ref, dict);
        return Promise.resolve(ref);
      }
      return Promise.resolve(context.register(dict));
    },
  });
  return PDFFont.of(doc.context.nextRef(), doc, embedder);
}

/** The regular and bold faces of the flight file, embedded in `doc`. */
export function embedDossierFonts(doc: PDFDocument): {
  regular: PDFFont;
  bold: PDFFont;
} {
  return {
    regular: embedTrueType(
      doc,
      readFileSync(join(FONT_DIR, REGULAR_FONT_FILE)),
    ),
    bold: embedTrueType(doc, readFileSync(join(FONT_DIR, BOLD_FONT_FILE))),
  };
}
