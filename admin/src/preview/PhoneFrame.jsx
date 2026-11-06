/** A phone outline around the learner view. Width and radii come from the theme. */
export default function PhoneFrame({ children, label = 'Learner preview' }) {
  return (
    <div className="mx-auto w-[300px]" role="region" aria-label={label}>
      <div className="rounded-[36px] border-[10px] border-ink900 bg-bg p-sm shadow-none">
        <div className="mx-auto mb-sm h-4 w-24 rounded-pill bg-ink900" aria-hidden="true" />
        <div
          tabIndex={0}
          aria-label={`${label}, scrollable`}
          className="h-[520px] overflow-y-auto rounded-[24px] bg-bg p-md"
        >
          {children}
        </div>
      </div>
      <p className="mt-md text-center text-pw-small text-ink600">
        What a learner sees on their phone
      </p>
    </div>
  );
}
