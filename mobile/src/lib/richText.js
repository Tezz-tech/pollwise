/**
 * Turns a stored TipTap document into swipeable cards (DESIGN §6.7). Pure, so the card breaks are tested in Node.
 *
 * A new card starts at each level-2 heading, and when the current card passes about 60 words (DESIGN §1). Only the
 * node types the admin editor allows are rendered; anything else is shown as plain text, never as markup.
 */

export const CARD_WORDS = 60;

/**
 * @typedef {{ text: string, bold?: boolean, italic?: boolean }} Run
 * @typedef {{ kind: 'heading' | 'paragraph' | 'callout' | 'list', level?: number, ordered?: boolean, runs?: Run[], items?: Run[][] }} Block
 */

/**
 * @param {{ content?: object[] } | null | undefined} doc
 * @returns {Block[][]} cards, each an array of blocks
 */
export function toCards(doc) {
  const cards = [];
  let current = [];
  let words = 0;
  for (const node of doc?.content ?? []) {
    const block = blockFor(node);
    if (!block) continue;
    const blockWords = countWords(block);
    const startsCard = block.kind === 'heading' && block.level === 2;
    if (current.length && (startsCard || words + blockWords > CARD_WORDS)) {
      cards.push(current);
      current = [];
      words = 0;
    }
    current.push(block);
    words += blockWords;
  }
  if (current.length) cards.push(current);
  return cards;
}

/** @param {object} node */
function blockFor(node) {
  switch (node.type) {
    case 'heading':
      return { kind: 'heading', level: node.attrs?.level === 2 ? 2 : 3, runs: runsOf(node) };
    case 'paragraph': {
      const runs = runsOf(node);
      return runs.length ? { kind: 'paragraph', runs } : null;
    }
    case 'blockquote':
      return { kind: 'callout', runs: runsOf(node) };
    case 'bulletList':
    case 'orderedList':
      return {
        kind: 'list',
        ordered: node.type === 'orderedList',
        items: (node.content ?? []).map((item) => runsOf(item)),
      };
    default:
      return null;
  }
}

/**
 * Text runs with bold and italic marks, gathered from every nested text node.
 * @param {object} node
 * @returns {Run[]}
 */
export function runsOf(node) {
  const runs = [];
  const visit = (child) => {
    if (child.type === 'text' && typeof child.text === 'string') {
      const marks = child.marks ?? [];
      runs.push({
        text: child.text,
        bold: marks.some((m) => m.type === 'bold'),
        italic: marks.some((m) => m.type === 'italic'),
      });
      return;
    }
    for (const inner of child.content ?? []) visit(inner);
  };
  for (const inner of node.content ?? []) visit(inner);
  return runs;
}

/** @param {Block} block */
export function countWords(block) {
  const text =
    block.kind === 'list'
      ? block.items
          .flat()
          .map((r) => r.text)
          .join(' ')
      : (block.runs ?? []).map((r) => r.text).join(' ');
  return text.split(/\s+/).filter(Boolean).length;
}
