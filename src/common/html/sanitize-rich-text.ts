import * as sanitizeHtml from 'sanitize-html';

// Rich text comes from the Tiptap editors of the administration (articles,
// e-learning lessons). Only what those editors produce is kept; everything
// else (scripts, event handlers, frames, forms, arbitrary styles…) is
// dropped before the text is stored. The frontend filters again when it
// renders: keep the two lists in step.
const COLOR_VALUES = [
  /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i,
];
const FONT_SIZE_VALUES = [/^\d{1,3}(?:\.\d{1,2})?(?:px|pt|em|rem|%)$/i];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'hr',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'del',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'span',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'class'],
    img: ['src', 'alt', 'title', 'width', 'height', 'class'],
    ol: ['start'],
    span: ['style'],
    code: ['class'],
  },
  // The classes the editors put on their own output.
  allowedClasses: {
    a: ['text-info', 'underline', 'cursor-pointer'],
    img: ['rounded-md', 'max-w-full', 'h-auto', 'my-4'],
    code: ['language-*'],
  },
  allowedStyles: {
    span: {
      color: COLOR_VALUES,
      'font-size': FONT_SIZE_VALUES,
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  transformTags: {
    // A link never hands the opener to the page it leads to.
    a: (tagName, attribs) => {
      const { target, ...rest } = attribs;
      return {
        tagName,
        attribs: {
          ...rest,
          ...(target === '_blank' ? { target } : {}),
          rel: 'noopener noreferrer',
        },
      };
    },
  },
};

export const sanitizeRichText = (html: string): string =>
  sanitizeHtml(html, OPTIONS);

// A lesson is stored either as rich text or as titled sections (an object,
// or its JSON text), which the frontend renders as plain text.
export const sanitizeLessonContent = <T>(content: T): T => {
  if (typeof content !== 'string') {
    return content;
  }

  if (content.trim().startsWith('{')) {
    try {
      JSON.parse(content);
      return content;
    } catch {
      // Not JSON after all: treated as rich text below.
    }
  }

  return sanitizeRichText(content) as T;
};
