import { sanitizeLessonContent, sanitizeRichText } from '../sanitize-rich-text';

describe('sanitizeRichText', () => {
  it.each([
    '<h1>Titre</h1><h2>Sous-titre</h2><h3>Section</h3>',
    '<p>Un <strong>texte</strong> <em>mis</em> <u>en</u> <s>forme</s></p>',
    '<ul><li><p>un</p></li><li><p>deux</p></li></ul>',
    '<ol start="3"><li><p>trois</p></li></ol>',
    '<blockquote><p>Citation</p></blockquote>',
    '<pre><code class="language-ts">const a = 1;</code></pre>',
    '<p>ligne<br />suivante</p><hr />',
    '<p><span style="font-size:18px">Grand</span></p>',
    '<p><span style="color:rgb(255, 0, 0)">Rouge</span> <span style="color:#ff0000">rouge</span></p>',
    '<img src="https://exemple.fr/photo.jpg" alt="Image" class="rounded-md max-w-full h-auto my-4" />',
  ])('keeps what the editors produce: %s', (html) => {
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('keeps http, https and mailto links and closes the opener', () => {
    expect(
      sanitizeRichText(
        '<a target="_blank" rel="noopener noreferrer nofollow" class="text-info underline cursor-pointer" href="https://exemple.fr/page?a=1">lien</a>',
      ),
    ).toBe(
      '<a rel="noopener noreferrer" class="text-info underline cursor-pointer" href="https://exemple.fr/page?a=1" target="_blank">lien</a>',
    );
    expect(sanitizeRichText('<a href="http://exemple.fr">a</a>')).toBe(
      '<a href="http://exemple.fr" rel="noopener noreferrer">a</a>',
    );
    expect(sanitizeRichText('<a href="mailto:club@exemple.fr">a</a>')).toBe(
      '<a href="mailto:club@exemple.fr" rel="noopener noreferrer">a</a>',
    );
  });

  it('forces rel even when the author removed it, and refuses other targets', () => {
    expect(
      sanitizeRichText(
        '<a href="https://exemple.fr" target="_top" rel="opener">a</a>',
      ),
    ).toBe('<a href="https://exemple.fr" rel="noopener noreferrer">a</a>');
  });

  it.each([
    ['a script', '<p>a</p><script>alert(1)</script>', '<p>a</p>'],
    ['a style sheet', '<style>p{display:none}</style><p>a</p>', '<p>a</p>'],
    ['an event handler', '<p onclick="alert(1)">a</p>', '<p>a</p>'],
    [
      'an image error handler',
      '<img src="https://exemple.fr/a.png" onerror="alert(1)">',
      '<img src="https://exemple.fr/a.png" />',
    ],
    [
      'a frame',
      '<iframe src="https://exemple.fr"></iframe><p>a</p>',
      '<p>a</p>',
    ],
    [
      'a form',
      '<form action="https://exemple.fr"><input name="p"><button>ok</button></form>',
      'ok',
    ],
    [
      'an svg payload',
      '<svg onload="alert(1)"><circle /></svg><p>a</p>',
      '<p>a</p>',
    ],
    [
      'an arbitrary class',
      '<p class="fixed inset-0">a</p><a class="fixed text-info" href="https://exemple.fr">b</a>',
      '<p>a</p><a class="text-info" href="https://exemple.fr" rel="noopener noreferrer">b</a>',
    ],
    [
      'an arbitrary style',
      '<span style="position:fixed;background:url(https://exemple.fr/x);font-size:18px">a</span><p style="color:#fff">b</p>',
      '<span style="font-size:18px">a</span><p>b</p>',
    ],
    [
      'a style value that is not a plain colour or size',
      '<span style="color:expression(alert(1));font-size:calc(1px + 100vw)">a</span>',
      '<span>a</span>',
    ],
  ])('removes %s', (_label, html, expected) => {
    expect(sanitizeRichText(html)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    '&#106;avascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '//exemple.fr/page',
  ])('removes the link target %s', (href) => {
    expect(sanitizeRichText(`<a href="${href}">lien</a>`)).toBe(
      '<a rel="noopener noreferrer">lien</a>',
    );
  });

  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'mailto:club@exemple.fr',
    '//exemple.fr/a.png',
  ])('removes the image source %s', (src) => {
    expect(sanitizeRichText(`<img src="${src}" alt="x">`)).toBe(
      '<img alt="x" />',
    );
  });

  it('leaves plain text and entities as they are', () => {
    expect(sanitizeRichText('2 &lt; 3 &amp; 4 &gt; 1')).toBe(
      '2 &lt; 3 &amp; 4 &gt; 1',
    );
    expect(sanitizeRichText('')).toBe('');
  });
});

describe('sanitizeLessonContent', () => {
  it('sanitises a lesson written as rich text', () => {
    expect(
      sanitizeLessonContent('<p>a</p><img src=x onerror="alert(1)">'),
    ).toBe('<p>a</p><img src="x" />');
  });

  it('keeps titled sections, given as JSON text or as an object', () => {
    const sections = { sections: [{ heading: 'A', body: 'B <b>c</b>' }] };

    expect(sanitizeLessonContent(JSON.stringify(sections))).toBe(
      JSON.stringify(sections),
    );
    expect(sanitizeLessonContent(sections)).toBe(sections);
    expect(sanitizeLessonContent(null)).toBeNull();
  });

  it('treats text that only looks like JSON as rich text', () => {
    expect(sanitizeLessonContent('{<script>alert(1)</script>')).toBe('{');
  });
});
