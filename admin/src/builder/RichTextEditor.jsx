/** Rich text editor for lesson bodies. The allowed set lives in lib/richText.js. */
import { useEditor, EditorContent } from '@tiptap/react';
import { richTextExtensions } from '../lib/richText.js';
import { Bold, Heading2, Heading3, Italic, List, ListOrdered } from 'lucide-react';

export default function RichTextEditor({ value, onChange, label = 'Lesson text' }) {
  const editor = useEditor({
    extensions: richTextExtensions(),
    content: value ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
    editorProps: {
      attributes: {
        'aria-label': label,
        class:
          'min-h-[220px] rounded-b-md border border-t-0 border-line bg-surface p-lg text-pw-body text-ink900 focus:outline-none [&_h2]:text-pw-h2 [&_h2]:font-[800] [&_h3]:text-pw-h3 [&_h3]:font-[800] [&_ul]:list-disc [&_ul]:pl-lg [&_ol]:list-decimal [&_ol]:pl-lg',
      },
    },
  });

  if (!editor) return null;
  const tool = (active, onClick, label, Icon) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${active ? 'bg-jade100 text-jade700' : 'text-ink600 hover:bg-bg'}`}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );

  return (
    <div className="flex flex-col">
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex flex-wrap gap-xs rounded-t-md border border-line bg-bg p-xs"
      >
        {tool(
          editor.isActive('heading', { level: 2 }),
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          'Heading',
          Heading2
        )}
        {tool(
          editor.isActive('heading', { level: 3 }),
          () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          'Sub-heading',
          Heading3
        )}
        {tool(
          editor.isActive('bold'),
          () => editor.chain().focus().toggleBold().run(),
          'Bold',
          Bold
        )}
        {tool(
          editor.isActive('italic'),
          () => editor.chain().focus().toggleItalic().run(),
          'Italic',
          Italic
        )}
        {tool(
          editor.isActive('bulletList'),
          () => editor.chain().focus().toggleBulletList().run(),
          'Bulleted list',
          List
        )}
        {tool(
          editor.isActive('orderedList'),
          () => editor.chain().focus().toggleOrderedList().run(),
          'Numbered list',
          ListOrdered
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
