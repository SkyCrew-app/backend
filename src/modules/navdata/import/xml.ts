// A small XML reader for the SIA export: elements, attributes, text,
// entities and CDATA. No DTD, no namespaces handling beyond keeping the
// prefixed name. Enough for a flat data dump; not a general XML parser.

export interface XmlElement {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  text: string;
}

const ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
};

export const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (match, entity: string) => {
    if (entity.startsWith('#x'))
      return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith('#'))
      return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return ENTITIES[entity] ?? match;
  });

const ATTRIBUTE = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

const parseAttributes = (source: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  for (const match of source.matchAll(ATTRIBUTE)) {
    attributes[match[1]] = decodeEntities(match[3] ?? match[4] ?? '');
  }
  return attributes;
};

export class XmlError extends Error {}

// Calls `onElement` for every element closed at `depth` (root = 0), with its
// whole subtree, so that a large file is visited without keeping it all as a
// tree. `onOpen` sees every opening tag with its depth.
export function walkXml(
  xml: string,
  depth: number,
  onElement: (element: XmlElement, path: string[]) => void,
  onOpen?: (
    name: string,
    attributes: Record<string, string>,
    depth: number,
  ) => void,
): void {
  const stack: XmlElement[] = [];
  const path: string[] = [];
  let position = 0;
  const length = xml.length;
  while (position < length) {
    const lt = xml.indexOf('<', position);
    if (lt === -1) break;
    if (lt > position && stack.length > 0) {
      stack[stack.length - 1].text += decodeEntities(xml.slice(position, lt));
    }
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      if (end === -1) throw new XmlError('Unterminated comment');
      position = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt + 9);
      if (end === -1) throw new XmlError('Unterminated CDATA');
      if (stack.length > 0)
        stack[stack.length - 1].text += xml.slice(lt + 9, end);
      position = end + 3;
      continue;
    }
    if (xml.startsWith('<?', lt) || xml.startsWith('<!', lt)) {
      const end = xml.indexOf('>', lt + 2);
      if (end === -1) throw new XmlError('Unterminated declaration');
      position = end + 1;
      continue;
    }
    const gt = xml.indexOf('>', lt + 1);
    if (gt === -1) throw new XmlError('Unterminated tag');
    const tag = xml.slice(lt + 1, gt);
    position = gt + 1;
    if (tag.startsWith('/')) {
      const name = tag.slice(1).trim();
      const element = stack.pop();
      path.pop();
      if (!element || element.name !== name) {
        throw new XmlError(`Unexpected closing tag </${name}>`);
      }
      element.text = element.text.trim();
      if (stack.length === depth) {
        onElement(element, path);
      } else if (stack.length > depth) {
        stack[stack.length - 1].children.push(element);
      }
      continue;
    }
    const selfClosing = tag.endsWith('/');
    const body = selfClosing ? tag.slice(0, -1) : tag;
    const nameEnd = body.search(/\s|$/);
    const name = body.slice(0, nameEnd);
    const attributes = parseAttributes(body.slice(nameEnd));
    onOpen?.(name, attributes, stack.length);
    const element: XmlElement = { name, attributes, children: [], text: '' };
    if (selfClosing) {
      if (stack.length === depth) onElement(element, path);
      else if (stack.length > depth)
        stack[stack.length - 1].children.push(element);
    } else {
      stack.push(element);
      path.push(name);
    }
  }
  if (stack.length > 0)
    throw new XmlError(`Unclosed element <${stack[stack.length - 1].name}>`);
}

export const child = (
  element: XmlElement,
  name: string,
): XmlElement | undefined => element.children.find((c) => c.name === name);

export const childText = (element: XmlElement, name: string): string | null => {
  const found = child(element, name);
  if (!found) return null;
  return found.text === '' ? null : found.text;
};

// The text of an XML file in the encoding its declaration names (the SIA
// export is ISO-8859-1).
export function decodeXmlBuffer(buffer: Buffer): string {
  const head = buffer.subarray(0, 200).toString('latin1');
  const encoding = /encoding=["']([^"']+)["']/i.exec(head)?.[1]?.toLowerCase();
  if (
    encoding &&
    /^(iso-8859-1|latin-?1|windows-1252|cp1252)$/.test(encoding)
  ) {
    return buffer.toString('latin1');
  }
  return buffer.toString('utf8');
}
