/**
 * The learner's view of lessons and questions, as the app shows them (DESIGN §6). These components read
 * the same shapes the learner API returns, so the preview cannot show something the app would not.
 * Answers are not revealed here: options are shown in stored order, and no key is ever rendered.
 */
import { Check } from 'lucide-react';

const card = 'rounded-lg border border-line border-b-4 bg-surface p-md';
const tile =
  'flex w-full items-center gap-sm rounded-lg border border-line border-b-4 bg-surface p-md text-left text-pw-body text-ink900';

export function LearnerLesson({ lesson }) {
  if (!lesson) return null;
  if (lesson.type === 'video') {
    return (
      <div className="flex flex-col gap-md">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-ink900">
          {lesson.video?.thumbnailUrl && (
            <img
              src={lesson.video.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover opacity-80"
            />
          )}
        </div>
        <h3 className="text-pw-h3 font-[800] text-ink900">{lesson.title}</h3>
        {lesson.video?.keyPoints?.length > 0 && (
          <ol className="flex flex-col gap-sm">
            {lesson.video.keyPoints.map((k, i) => (
              <li key={i} className={`${card} text-pw-small text-ink900`}>
                <span className="mr-sm font-[800] text-jade700">{i + 1}.</span>
                {k}
              </li>
            ))}
          </ol>
        )}
        <button
          type="button"
          className="h-13 w-full rounded-md border-b-4 border-line bg-line text-pw-label font-[800] uppercase text-ink400"
        >
          Watch to continue
        </button>
      </div>
    );
  }
  if (lesson.type === 'text') {
    return (
      <article className="flex flex-col gap-md">
        <h3 className="text-pw-h3 font-[800] text-ink900">{lesson.title}</h3>
        <TipTapDoc doc={lesson.text?.doc} />
      </article>
    );
  }
  if (lesson.type === 'document') {
    return (
      <div className={`${card} flex flex-col gap-sm`}>
        <h3 className="text-pw-h3 font-[800] text-ink900">{lesson.title}</h3>
        <p className="text-pw-small text-ink600">
          {lesson.document?.fileName} ·{' '}
          {lesson.document?.pages ? `${lesson.document.pages} pages` : 'PDF'}
        </p>
        <button
          type="button"
          className="h-13 rounded-md border-b-4 border-jade700 bg-jade600 text-pw-label font-[800] uppercase text-white"
        >
          Open document
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-md">
      <h3 className="text-pw-h3 font-[800] text-ink900">{lesson.title}</h3>
      {(lesson.questions ?? []).map((q) => (
        <LearnerQuestion key={q.id} question={q} />
      ))}
    </div>
  );
}

/** Minimal TipTap JSON renderer for the allowed nodes (paragraph, headings, lists, text marks). */
export function TipTapDoc({ doc }) {
  const render = (node, key) => {
    if (!node) return null;
    const children = (node.content ?? []).map((c, i) => render(c, `${key}-${i}`));
    switch (node.type) {
      case 'doc':
        return (
          <div key={key} className="flex flex-col gap-md">
            {children}
          </div>
        );
      case 'paragraph':
        return (
          <p key={key} className="text-pw-body text-ink900">
            {children}
          </p>
        );
      case 'heading':
        return node.attrs?.level === 2 ? (
          <h4 key={key} className="text-pw-h3 font-[800] text-ink900">
            {children}
          </h4>
        ) : (
          <h5 key={key} className="text-pw-body font-[800] text-ink900">
            {children}
          </h5>
        );
      case 'bulletList':
        return (
          <ul key={key} className="list-disc pl-lg text-pw-body text-ink900">
            {children}
          </ul>
        );
      case 'orderedList':
        return (
          <ol key={key} className="list-decimal pl-lg text-pw-body text-ink900">
            {children}
          </ol>
        );
      case 'listItem':
        return <li key={key}>{children}</li>;
      case 'text': {
        let el = node.text;
        for (const m of node.marks ?? []) {
          if (m.type === 'bold') el = <strong key={`${key}-b`}>{el}</strong>;
          if (m.type === 'italic') el = <em key={`${key}-i`}>{el}</em>;
        }
        return <span key={key}>{el}</span>;
      }
      default:
        return null;
    }
  };
  return render(doc, 'doc');
}

/** One question as a learner sees it. Options keep their stored order; the answer is never shown. */
export function LearnerQuestion({ question: q }) {
  const options = q.options ?? [];
  return (
    <section className="flex flex-col gap-sm" aria-label="Question">
      <p className="text-pw-h3 font-[800] text-ink900">{q.prompt}</p>
      {(q.type === 'single_choice' || q.type === 'multi_choice') &&
        options.map((o) => (
          <div key={o.id} className={tile}>
            <span
              className={`h-5 w-5 shrink-0 border-2 border-line ${q.type === 'single_choice' ? 'rounded-pill' : 'rounded-sm'}`}
            />
            {o.text}
          </div>
        ))}
      {q.type === 'true_false' && (
        <div className="grid grid-cols-2 gap-sm">
          <div className={`${tile} justify-center`}>
            <Check size={16} aria-hidden="true" /> True
          </div>
          <div className={`${tile} justify-center`}>False</div>
        </div>
      )}
      {q.type === 'matching' && (
        <div className="grid grid-cols-2 gap-sm">
          <div className="flex flex-col gap-sm">
            {(q.pairs ?? []).map((p) => (
              <div key={p.id} className="rounded-md bg-jade100 p-sm text-pw-small text-ink900">
                {p.left}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-sm">
            {(q.pairs ?? []).map((p) => (
              <div
                key={p.rightId}
                className="rounded-md bg-amber100 p-sm text-pw-small text-ink900"
              >
                {p.right}
              </div>
            ))}
          </div>
        </div>
      )}
      {q.type === 'ordering' && (
        <div className="flex flex-col gap-sm">
          {(q.items ?? []).map((it, i) => (
            <div key={it.id} className={tile}>
              <span className="font-[800] text-jade700">{i + 1}</span>
              {it.text}
            </div>
          ))}
        </div>
      )}
      {q.type === 'fill_blank' && (
        <p className="rounded-lg border border-line bg-surface p-md text-pw-body text-ink900">
          {q.template.split('___').map((part, i, all) => (
            <span key={i}>
              {part}
              {i < all.length - 1 && (
                <span className="mx-xs inline-block min-w-[80px] border-b-2 border-jade600 align-middle" />
              )}
            </span>
          ))}
        </p>
      )}
      {q.type === 'reflection' && (
        <div className={`${card} text-pw-small text-ink600`}>
          Write a short reflection. This one is not marked.
        </div>
      )}
    </section>
  );
}
