import { describe, expect, it } from 'vitest';
import { RICH_TEXT_LIMITS, validateRichText } from '../schemas/richText.js';

const para = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const doc = (...content) => ({ type: 'doc', content });

describe('validateRichText (SECURITY §4)', () => {
  it('accepts the allowed node and mark set', () => {
    const ok = doc(
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hi' }] },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] }],
      },
      {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [para('one')] }],
      },
      { type: 'callout', attrs: { kind: 'didYouKnow' }, content: [para('Fact')] },
      { type: 'image', attrs: { src: 'https://res.cloudinary.com/x/y.jpg', alt: 'x' } }
    );
    expect(validateRichText(ok)).toEqual({ valid: true, errors: [] });
  });

  it('refuses raw HTML and script nodes', () => {
    const result = validateRichText(doc({ type: 'html', attrs: { value: '<script>x</script>' } }));
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/"html" is not allowed/);
  });

  it('refuses links and other marks outside the allowlist', () => {
    const result = validateRichText(
      doc({ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link' }] }] })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/Mark type "link"/);
  });

  it('refuses images that are not https', () => {
    const result = validateRichText(doc({ type: 'image', attrs: { src: 'javascript:alert(1)' } }));
    expect(result.valid).toBe(false);
  });

  it('refuses documents nested deeper than the limit', () => {
    let node = para('deep');
    for (let i = 0; i < RICH_TEXT_LIMITS.maxDepth + 2; i += 1) {
      node = { type: 'bulletList', content: [{ type: 'listItem', content: [node] }] };
    }
    const result = validateRichText(doc(node));
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/nested too deeply/);
  });

  it('refuses something that is not a TipTap doc', () => {
    expect(validateRichText({ type: 'paragraph' }).valid).toBe(false);
    expect(validateRichText(null).valid).toBe(false);
  });
});
