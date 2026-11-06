import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, Field, Input, Textarea } from '../components/ui.jsx';
import { QUESTION_TYPE_LABELS } from '../lib/labels.js';
import { blankCount } from '../lib/courseSchemas.js';
import { tempId } from '../lib/questionDraft.js';

const ROW = 'flex items-center gap-sm';
const ICON_BTN =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-ink600 hover:text-ink900 disabled:opacity-40';

/**
 * One question's editor. Every type has the same top (prompt, explanation, points) and its own body.
 * Errors come from validateDraft() and show beside the field they concern.
 */
export default function QuestionEditor({ draft, onChange, errors = {} }) {
  const set = (patch) => onChange({ ...draft, ...patch });
  const type = draft.type;

  return (
    <div className="flex flex-col gap-lg">
      <Field
        label={`${QUESTION_TYPE_LABELS[type]} · the question`}
        htmlFor={`${draft.key}-prompt`}
        error={errors.prompt}
      >
        <Textarea
          id={`${draft.key}-prompt`}
          invalid={Boolean(errors.prompt)}
          value={draft.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
        />
      </Field>

      {type === 'single_choice' && <OptionList draft={draft} set={set} errors={errors} single />}
      {type === 'multi_choice' && <OptionList draft={draft} set={set} errors={errors} />}

      {type === 'true_false' && (
        <fieldset className="flex flex-col gap-sm">
          <legend className="text-pw-label font-[800] uppercase tracking-[0.6px] text-ink600">
            The correct answer
          </legend>
          <div className="grid grid-cols-2 gap-sm">
            {[true, false].map((v) => (
              <label
                key={String(v)}
                className={`flex cursor-pointer items-center justify-center gap-sm rounded-lg border border-b-4 p-lg text-pw-body font-[800] ${draft.correct === v ? 'border-jade600 bg-jade100 text-jade700' : 'border-line bg-surface text-ink900'}`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name={`${draft.key}-tf`}
                  checked={draft.correct === v}
                  onChange={() => set({ correct: v })}
                />
                {v ? 'True' : 'False'}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {type === 'matching' && (
        <div className="flex flex-col gap-sm">
          <p className="text-pw-small text-ink600">
            Each left item matches the right item on the same row. Learners see the right side
            shuffled.
          </p>
          {draft.pairs.map((p, i) => (
            <div key={p.id} className={`${ROW} flex-wrap sm:flex-nowrap`}>
              <Input
                aria-label={`Left item ${i + 1}`}
                placeholder="Left item"
                value={p.left}
                onChange={(e) =>
                  set({
                    pairs: draft.pairs.map((x) => (x === p ? { ...x, left: e.target.value } : x)),
                  })
                }
              />
              <span className="text-ink400" aria-hidden="true">
                →
              </span>
              <Input
                aria-label={`Right item ${i + 1}`}
                placeholder="Matching item"
                value={p.right}
                onChange={(e) =>
                  set({
                    pairs: draft.pairs.map((x) => (x === p ? { ...x, right: e.target.value } : x)),
                  })
                }
              />
              <button
                type="button"
                aria-label={`Remove pair ${i + 1}`}
                className={ICON_BTN}
                disabled={draft.pairs.length <= 3}
                onClick={() => set({ pairs: draft.pairs.filter((x) => x !== p) })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {errors.pairs && (
            <p role="alert" className="text-pw-small font-[700] text-coral700">
              {errors.pairs}
            </p>
          )}
          <div>
            <Button
              tone="quiet"
              disabled={draft.pairs.length >= 6}
              onClick={() =>
                set({
                  pairs: [
                    ...draft.pairs,
                    { id: tempId('p'), rightId: tempId('r'), left: '', right: '' },
                  ],
                })
              }
            >
              <Plus size={16} /> Add pair
            </Button>
          </div>
        </div>
      )}

      {type === 'ordering' && (
        <div className="flex flex-col gap-sm">
          <p className="text-pw-small text-ink600">
            List the steps in their correct order. Learners see them shuffled.
          </p>
          {draft.items.map((it, i) => (
            <div key={it.id} className={ROW}>
              <span className="w-6 text-center text-pw-body font-[800] text-jade700">{i + 1}</span>
              <Input
                aria-label={`Step ${i + 1}`}
                value={it.text}
                onChange={(e) =>
                  set({
                    items: draft.items.map((x) => (x === it ? { ...x, text: e.target.value } : x)),
                  })
                }
              />
              <button
                type="button"
                aria-label={`Move step ${i + 1} up`}
                className={ICON_BTN}
                disabled={i === 0}
                onClick={() => set({ items: swap(draft.items, i, i - 1) })}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                aria-label={`Move step ${i + 1} down`}
                className={ICON_BTN}
                disabled={i === draft.items.length - 1}
                onClick={() => set({ items: swap(draft.items, i, i + 1) })}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                aria-label={`Remove step ${i + 1}`}
                className={ICON_BTN}
                disabled={draft.items.length <= 3}
                onClick={() => set({ items: draft.items.filter((x) => x !== it) })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {errors.items && (
            <p role="alert" className="text-pw-small font-[700] text-coral700">
              {errors.items}
            </p>
          )}
          <div>
            <Button
              tone="quiet"
              disabled={draft.items.length >= 8}
              onClick={() => set({ items: [...draft.items, { id: tempId('i'), text: '' }] })}
            >
              <Plus size={16} /> Add step
            </Button>
          </div>
        </div>
      )}

      {type === 'fill_blank' && <FillBlank draft={draft} set={set} errors={errors} />}

      {type === 'reflection' && (
        <p className="rounded-md bg-sky100 p-md text-pw-small text-sky600">
          Reflection questions are saved for the learner to think about. They are never marked and
          do not count toward a score.
        </p>
      )}

      {type !== 'reflection' && (
        <Field
          label="Points"
          htmlFor={`${draft.key}-points`}
          hint="Each question is all or nothing. Most questions are worth 1."
          error={errors.points}
        >
          <Input
            id={`${draft.key}-points`}
            type="number"
            min={0}
            max={10}
            className="w-32"
            value={draft.points}
            onChange={(e) => set({ points: Number(e.target.value) })}
          />
        </Field>
      )}

      <Field
        label="Explanation shown after answering (optional)"
        htmlFor={`${draft.key}-explanation`}
        error={errors.explanation}
      >
        <Textarea
          id={`${draft.key}-explanation`}
          value={draft.explanation ?? ''}
          onChange={(e) => set({ explanation: e.target.value })}
        />
      </Field>
    </div>
  );
}

function swap(list, a, b) {
  const copy = [...list];
  [copy[a], copy[b]] = [copy[b], copy[a]];
  return copy;
}

/** Options with a correct marker: a radio for single choice, a checkbox for multiple. */
function OptionList({ draft, set, errors, single = false }) {
  const toggle = (id) => {
    if (single) return set({ correctOptionId: id });
    const has = draft.correctOptionIds.includes(id);
    set({
      correctOptionIds: has
        ? draft.correctOptionIds.filter((x) => x !== id)
        : [...draft.correctOptionIds, id],
    });
  };
  const isCorrect = (id) =>
    single ? draft.correctOptionId === id : draft.correctOptionIds.includes(id);
  return (
    <fieldset className="flex flex-col gap-sm">
      <legend className="text-pw-label font-[800] uppercase tracking-[0.6px] text-ink600">
        {single ? 'Options (mark the one correct answer)' : 'Options (mark every correct answer)'}
      </legend>
      {draft.options.map((o, i) => (
        <div key={o.id} className={ROW}>
          <label className="flex shrink-0 cursor-pointer items-center gap-xs">
            <input
              type={single ? 'radio' : 'checkbox'}
              name={`${draft.key}-correct`}
              className="h-5 w-5 accent-jade600"
              checked={isCorrect(o.id)}
              onChange={() => toggle(o.id)}
              aria-label={`Option ${i + 1} is correct`}
            />
          </label>
          <Input
            aria-label={`Option ${i + 1} text`}
            placeholder={`Option ${i + 1}`}
            value={o.text}
            onChange={(e) =>
              set({
                options: draft.options.map((x) => (x === o ? { ...x, text: e.target.value } : x)),
              })
            }
          />
          <button
            type="button"
            aria-label={`Remove option ${i + 1}`}
            className={ICON_BTN}
            disabled={draft.options.length <= 2}
            onClick={() =>
              set({
                options: draft.options.filter((x) => x !== o),
                correctOptionId: draft.correctOptionId === o.id ? null : draft.correctOptionId,
                correctOptionIds: draft.correctOptionIds.filter((x) => x !== o.id),
              })
            }
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      {(errors.options || errors.correctOptionId || errors.correctOptionIds) && (
        <p role="alert" className="text-pw-small font-[700] text-coral700">
          {errors.options ?? errors.correctOptionId ?? errors.correctOptionIds}
        </p>
      )}
      <div>
        <Button
          tone="quiet"
          disabled={draft.options.length >= 8}
          onClick={() => set({ options: [...draft.options, { id: tempId('o'), text: '' }] })}
        >
          <Plus size={16} /> Add option
        </Button>
      </div>
    </fieldset>
  );
}

/** Fill-in-the-blank: the sentence with ___ marks, and one list of accepted answers per blank. */
function FillBlank({ draft, set, errors }) {
  const blanks = blankCount(draft.template);
  const lists = Array.from(
    { length: Math.max(blanks, 1) },
    (_, i) => draft.acceptedAnswers[i] ?? ['']
  );
  const setList = (i, values) =>
    set({ acceptedAnswers: lists.map((l, j) => (j === i ? values : l)) });
  return (
    <div className="flex flex-col gap-lg">
      <Field
        label="Sentence (use ___ for each blank)"
        htmlFor={`${draft.key}-template`}
        error={errors.template}
        hint={`Currently ${blanks} blank(s).`}
      >
        <Input
          id={`${draft.key}-template`}
          invalid={Boolean(errors.template)}
          value={draft.template}
          onChange={(e) => set({ template: e.target.value, acceptedAnswers: lists })}
        />
      </Field>
      {lists.map((answers, i) => (
        <div key={i} className="flex flex-col gap-sm rounded-lg border border-line bg-bg p-md">
          <p className="text-pw-small font-[800] text-ink900">Blank {i + 1}: accepted answers</p>
          {answers.map((a, j) => (
            <div key={j} className={ROW}>
              <Input
                aria-label={`Blank ${i + 1} answer ${j + 1}`}
                value={a}
                onChange={(e) =>
                  setList(
                    i,
                    answers.map((x, k) => (k === j ? e.target.value : x))
                  )
                }
              />
              <button
                type="button"
                aria-label={`Remove answer ${j + 1} of blank ${i + 1}`}
                className={ICON_BTN}
                disabled={answers.length <= 1}
                onClick={() =>
                  setList(
                    i,
                    answers.filter((_, k) => k !== j)
                  )
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <div>
            <Button
              tone="quiet"
              disabled={answers.length >= 10}
              onClick={() => setList(i, [...answers, ''])}
            >
              <Plus size={16} /> Add accepted answer
            </Button>
          </div>
        </div>
      ))}
      {errors.acceptedAnswers && (
        <p role="alert" className="text-pw-small font-[700] text-coral700">
          {errors.acceptedAnswers}
        </p>
      )}
      <p className="text-pw-small text-ink600">
        Answers ignore capitals, extra spaces and a full stop at the end.
      </p>
    </div>
  );
}
