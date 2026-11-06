import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { api, ApiError } from '../lib/api.js';
import { Button, Field, Input, Logo } from '../components/ui.jsx';

const schema = z
  .object({
    password: z
      .string()
      .min(10, 'Use at least 10 characters.')
      .max(128, 'Use no more than 128 characters.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'The two passwords do not match.',
  });

/** Invitation acceptance (SECURITY §1): the invitee chooses their own password through the one-time link. */
export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onBlur' });

  const onSubmit = async (values) => {
    setError('');
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        setFieldError(issue.path[0], { message: issue.message });
      return;
    }
    try {
      const res = await api('/auth/admin/accept-invite', {
        method: 'POST',
        body: { token, password: parsed.data.password },
      });
      setDone(res);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'We could not save your password. Try again.'
      );
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center bg-bg p-lg">
      <section className="w-full max-w-[420px] rounded-xl border border-line border-b-4 bg-surface p-2xl">
        <Logo />
        <h1 className="mt-2xl text-pw-h1 font-[800] text-ink900">Welcome to PollWise</h1>
        {!token && (
          <p role="alert" className="mt-lg text-pw-body text-coral700">
            This link is incomplete. Ask for a new invitation.
          </p>
        )}
        {done ? (
          <div className="mt-lg flex flex-col gap-lg">
            <p className="text-pw-body text-ink600">
              Your password is saved for {done.email}. Sign in to finish setting up two-step
              sign-in.
            </p>
            <Link to="/login" className="text-pw-body font-[800] text-jade700 underline">
              Go to sign in
            </Link>
          </div>
        ) : (
          <form className="mt-lg flex flex-col gap-lg" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Field
              label="New password"
              htmlFor="password"
              error={errors.password?.message}
              hint="At least 10 characters."
            >
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                invalid={Boolean(errors.password)}
                {...register('password')}
              />
            </Field>
            <Field label="Repeat password" htmlFor="confirm" error={errors.confirm?.message}>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                invalid={Boolean(errors.confirm)}
                {...register('confirm')}
              />
            </Field>
            {error && (
              <p
                role="alert"
                className="rounded-md bg-coral100 p-md text-pw-small font-[700] text-coral700"
              >
                {error}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting || !token}>
              {isSubmitting ? 'Saving…' : 'Save password'}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
