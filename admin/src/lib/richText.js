/**
 * The text editor's extension list (SECURITY §4). Kept apart from the React component so it can be tested
 * without a browser: only headings 2 and 3, paragraphs, bold, italic and lists are on. Links, code, quotes,
 * strike-through and rules are off, so pasting cannot bring them in.
 */
import StarterKit from '@tiptap/starter-kit';

export const ALLOWED_NODES = Object.freeze([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'text',
  'doc',
  'hardBreak',
]);
export const ALLOWED_MARKS = Object.freeze(['bold', 'italic']);

export function richTextExtensions() {
  return StarterKit.configure({
    heading: { levels: [2, 3] },
    link: false,
    underline: false,
    strike: false,
    code: false,
    codeBlock: false,
    blockquote: false,
    horizontalRule: false,
  });
}
