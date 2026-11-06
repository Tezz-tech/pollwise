/**
 * Shared admin primitives (DESIGN §2, §3, §7). Colours and sizes come from the theme generated from
 * shared/tokens.js, so nothing here hard-codes a value. Solid lips give depth, and no blur is used.
 */
import { forwardRef, useEffect, useId, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

const TONES = {
  primary: 'border-jade700 bg-jade600 text-white hover:bg-jade700',
  quiet: 'border-line bg-surface text-ink900 hover:bg-bg',
  danger: 'border-coral700 bg-coral600 text-white hover:opacity-95',
  amber: 'border-amber700 bg-amber500 text-ink900 hover:opacity-95',
};

/** A chunky button with a solid lip that presses down (DESIGN §3, interaction 1). */
export const Button = forwardRef(function Button(
  { tone = 'primary', className = '', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex h-11 select-none items-center justify-center gap-sm rounded-md border-b-4 px-lg text-pw-label font-[800] uppercase tracking-[0.6px] transition-[transform,border-width] duration-100 active:translate-y-[4px] active:border-b-0 disabled:translate-y-0 disabled:border-line disabled:bg-line disabled:text-ink400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade600 ${TONES[tone]} ${className}`}
      {...props}
    />
  );
});

export function Card({
  as: Tag = 'section',
  interactive = false,
  className = '',
  children,
  ...props
}) {
  return (
    <Tag
      className={`rounded-lg border border-line bg-surface p-lg ${interactive ? 'border-b-4 transition-colors hover:border-jade600' : ''} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

const PILL_TONES = {
  draft: 'bg-amber100 text-amber700',
  published: 'bg-jade100 text-jade700',
  archived: 'bg-line text-ink600',
  info: 'bg-sky100 text-sky600',
  warn: 'bg-coral100 text-coral700',
};

export function Pill({ tone = 'info', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-md py-xs text-pw-label font-[800] uppercase tracking-[0.6px] ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export const STATUS_TONE = { draft: 'draft', published: 'published', archived: 'archived' };

export const Input = forwardRef(function Input({ invalid, className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`h-11 w-full rounded-md border bg-surface px-md text-pw-body text-ink900 placeholder:text-ink400 focus:border-jade600 focus:outline-none ${invalid ? 'border-coral600' : 'border-line'} ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ invalid, className = '', ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={3}
      className={`w-full rounded-md border bg-surface p-md text-pw-body text-ink900 placeholder:text-ink400 focus:border-jade600 focus:outline-none ${invalid ? 'border-coral600' : 'border-line'} ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

/** A labelled field with an inline message. Errors pair colour with words (DESIGN §2). */
export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className="flex flex-col gap-xs">
      <label
        htmlFor={htmlFor}
        className="text-pw-label font-[800] uppercase tracking-[0.6px] text-ink600"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-pw-small font-[700] text-coral700">
          {error}
        </p>
      ) : hint ? (
        <p className="text-pw-small text-ink600">{hint}</p>
      ) : null}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-line ${className}`} aria-hidden="true" />;
}

export function Modal({ open, onClose, title, children, wide = false }) {
  const titleId = useId();
  const reduce = useReducedMotion();
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink900/40 p-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.01 : 0.12 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`max-h-[90vh] w-full overflow-y-auto rounded-xl border border-line bg-surface p-2xl outline-none ${wide ? 'max-w-[640px]' : 'max-w-[460px]'}`}
            initial={reduce ? false : { y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 140 }}
          >
            <div className="mb-lg flex items-start justify-between gap-md">
              <h2 id={titleId} className="text-pw-h2 font-[800] text-ink900">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-xs text-ink600 hover:bg-bg"
              >
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Logo({ variant = 'dark', className = '' }) {
  return (
    <img
      src={variant === 'white' ? '/brand/pollwise-logo-white.svg' : '/brand/pollwise-logo.svg'}
      alt="PollWise"
      className={`h-8 w-auto ${className}`}
    />
  );
}

/** Tally, the mascot. Static here; the animated version is part of the learner app (DESIGN §3). */
export function Tally({ size = 96, label = 'Tally the ballot box' }) {
  return (
    <img src="/brand/tally-happy.svg" alt={label} width={size} height={size} className="shrink-0" />
  );
}
