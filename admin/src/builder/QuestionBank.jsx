import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  CircleDot,
  ArrowDownUp,
  Link2,
  ListChecks,
  MessageSquareText,
  Plus,
  TextCursorInput,
  ToggleLeft,
  Trash2,
} from 'lucide-react';
import { Button, Card, Modal, Pill } from '../components/ui.jsx';
import { QUESTION_TYPE_LABELS } from '../lib/labels.js';
import { newDraft, QUESTION_TYPES, validateDraft } from '../lib/questionDraft.js';
import QuestionEditor from './QuestionEditor.jsx';

const ICONS = {
  single_choice: CircleDot,
  multi_choice: ListChecks,
  true_false: ToggleLeft,
  matching: Link2,
  ordering: ArrowDownUp,
  fill_blank: TextCursorInput,
  reflection: MessageSquareText,
};

const BLURBS = {
  single_choice: 'One correct option out of several.',
  multi_choice: 'Every correct option must be picked, and nothing else.',
  true_false: 'A statement that is true or false.',
  matching: 'Pair each item on the left with its match on the right.',
  ordering: 'Put steps into the right order.',
  fill_blank: 'Complete a sentence with the missing word or words.',
  reflection: 'An open question. Stored, never marked.',
};

/** Type picker: an icon card for every question type (SPEC §6.8, DESIGN §7). */
export function TypePicker({ open, onClose, onPick }) {
  return (
    <Modal open={open} onClose={onClose} title="What kind of question?" wide>
      <div className="grid gap-sm sm:grid-cols-2">
        {QUESTION_TYPES.map((t) => {
          const Icon = ICONS[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => onPick(t)}
              className="flex items-start gap-md rounded-lg border border-line border-b-4 bg-surface p-md text-left transition-colors hover:border-jade600"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-jade100 text-jade700">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-pw-body font-[800] text-ink900">
                  {QUESTION_TYPE_LABELS[t]}
                </span>
                <span className="block text-pw-small text-ink600">{BLURBS[t]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/**
 * The question bank: a list of questions, each expandable into its editor. Shows which ones are not ready
 * yet, so the admin sees what to fix before saving (DESIGN §7: red dot for anything failing).
 */
export default function QuestionBank({
  drafts,
  onChange,
  serverErrors = {},
  onSelect,
  selectedKey,
}) {
  const [picking, setPicking] = useState(false);
  const [openKey, setOpenKey] = useState(null);

  const update = (key, next) => onChange(drafts.map((d) => (d.key === key ? next : d)));
  const move = (index, delta) => {
    const copy = [...drafts];
    const j = index + delta;
    if (j < 0 || j >= copy.length) return;
    [copy[index], copy[j]] = [copy[j], copy[index]];
    onChange(copy);
  };
  const remove = (key) => {
    if (
      !window.confirm(
        'Remove this question from the bank? Learners who already started an attempt keep their version.'
      )
    )
      return;
    onChange(drafts.filter((d) => d.key !== key));
  };

  return (
    <div className="flex flex-col gap-md">
      {drafts.length === 0 && (
        <Card className="text-center">
          <p className="text-pw-body text-ink600">
            This bank is empty. Add a question to get started.
          </p>
        </Card>
      )}
      {drafts.map((d, i) => {
        const errors = validateDraft(d);
        const ready = Object.keys(errors).length === 0;
        const open = openKey === d.key;
        const Icon = ICONS[d.type];
        const selected = selectedKey === d.key;
        return (
          <Card key={d.key} className={`p-0 ${selected ? 'border-jade600' : ''}`}>
            <div className="flex items-center gap-md p-md">
              <span className="w-7 text-center text-pw-body font-[800] text-ink600">{i + 1}</span>
              <Icon size={18} className="shrink-0 text-jade700" aria-hidden="true" />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  setOpenKey(open ? null : d.key);
                  onSelect?.(d.key);
                }}
                aria-expanded={open}
              >
                <span className="block truncate text-pw-body font-[800] text-ink900">
                  {d.prompt.trim() || 'Untitled question'}
                </span>
                <span className="block text-pw-small text-ink600">
                  {QUESTION_TYPE_LABELS[d.type]} ·{' '}
                  {d.type === 'reflection'
                    ? 'not marked'
                    : `${d.points} point${d.points === 1 ? '' : 's'}`}
                </span>
              </button>
              <Pill tone={ready && !serverErrors[d.key] ? 'published' : 'warn'}>
                {ready && !serverErrors[d.key] ? 'Ready' : 'Needs work'}
              </Pill>
              <button
                type="button"
                aria-label="Move question up"
                className="rounded-md p-xs text-ink600 hover:bg-bg disabled:opacity-30"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                aria-label="Move question down"
                className="rounded-md p-xs text-ink600 hover:bg-bg disabled:opacity-30"
                disabled={i === drafts.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                aria-label="Remove question"
                className="rounded-md p-xs text-coral700 hover:bg-coral100"
                onClick={() => remove(d.key)}
              >
                <Trash2 size={16} />
              </button>
              <ChevronDown
                size={18}
                className={`text-ink600 transition-transform ${open ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </div>
            {open && (
              <div className="border-t border-line p-lg">
                {serverErrors[d.key] && (
                  <p role="alert" className="mb-md text-pw-small font-[700] text-coral700">
                    {serverErrors[d.key]}
                  </p>
                )}
                <QuestionEditor
                  draft={d}
                  onChange={(next) => update(d.key, next)}
                  errors={errors}
                />
              </div>
            )}
          </Card>
        );
      })}
      <div>
        <Button tone="quiet" onClick={() => setPicking(true)}>
          <Plus size={16} /> Add question
        </Button>
      </div>
      <TypePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(type) => {
          const draft = newDraft(type);
          onChange([...drafts, draft]);
          setOpenKey(draft.key);
          setPicking(false);
        }}
      />
    </div>
  );
}
