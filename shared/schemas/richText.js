/**
 * Rich text is stored as TipTap JSON (SPEC §5, SECURITY §4). Only the node and mark types below are
 * allowed. Anything else is rejected, so no raw HTML can ever be stored or rendered.
 *
 * The admin editor and the server both call validateRichText(); the mobile app renders the same
 * allowlist natively.
 */

export const RICH_TEXT_NODE_TYPES = Object.freeze([
  'doc',
  'paragraph',
  'heading',
  'text',
  'bulletList',
  'orderedList',
  'listItem',
  'hardBreak',
  'callout',
  'image',
]);

export const RICH_TEXT_MARK_TYPES = Object.freeze(['bold', 'italic']);
export const CALLOUT_KINDS = Object.freeze(['didYouKnow', 'remember']);

/** Limits that stop a huge or deeply nested document from reaching the database. */
export const RICH_TEXT_LIMITS = Object.freeze({
  maxDepth: 12,
  maxNodes: 2000,
  maxTextLength: 5000,
  maxBytes: 200 * 1024,
});

const HTTPS_URL = /^https:\/\/[^\s"'<>]+$/;

/**
 * @typedef {{ type: string, attrs?: Record<string, unknown>, content?: RichTextNode[], text?: string, marks?: { type: string }[] }} RichTextNode
 */

/**
 * Check a TipTap document against the allowlist, depth, size and node count limits.
 * @param {unknown} doc
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRichText(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object' || doc.type !== 'doc') {
    return { valid: false, errors: ['Rich text must be a TipTap doc node'] };
  }
  if (JSON.stringify(doc).length > RICH_TEXT_LIMITS.maxBytes) {
    return { valid: false, errors: ['Rich text is too large'] };
  }

  let nodeCount = 0;
  const visit = (node, depth) => {
    if (depth > RICH_TEXT_LIMITS.maxDepth) {
      errors.push('Rich text is nested too deeply');
      return;
    }
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') {
      errors.push('Rich text contains a malformed node');
      return;
    }
    nodeCount += 1;
    if (nodeCount > RICH_TEXT_LIMITS.maxNodes) {
      errors.push('Rich text has too many nodes');
      return;
    }
    if (!RICH_TEXT_NODE_TYPES.includes(node.type)) {
      errors.push(`Node type "${node.type}" is not allowed`);
      return;
    }

    if (node.type === 'text') {
      if (typeof node.text !== 'string' || node.text.length > RICH_TEXT_LIMITS.maxTextLength) {
        errors.push('Text node is missing or too long');
      }
    }
    if (node.type === 'heading') {
      const level = node.attrs?.level;
      if (![1, 2, 3].includes(level)) errors.push('Heading level must be 1, 2 or 3');
    }
    if (node.type === 'callout') {
      if (!CALLOUT_KINDS.includes(node.attrs?.kind)) errors.push('Callout kind is not allowed');
    }
    if (node.type === 'image') {
      const src = node.attrs?.src;
      if (typeof src !== 'string' || !HTTPS_URL.test(src)) {
        errors.push('Images must use an https URL');
      }
    }
    for (const mark of node.marks ?? []) {
      if (!RICH_TEXT_MARK_TYPES.includes(mark.type)) {
        errors.push(`Mark type "${mark.type}" is not allowed`);
      }
    }
    for (const child of node.content ?? []) visit(child, depth + 1);
  };

  visit(doc, 0);
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
