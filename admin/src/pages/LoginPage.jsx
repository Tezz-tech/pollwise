import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Button, Field, Input, Logo } from '../components/ui.jsx';

const schema = z.object({
  email: z.string().trim().email('Enter the email address for your admin account.'),
  password: z.string().min(1, 'Enter your password.'),
});

export default function LoginPage() {
  const { startSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: undefined, mode: 'onBlur' });

  const onSubmit = async (values) => {
    setServerError('');
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) setError(issue.path[0], { message: issue.message });
      return;
    }
    try {
      const res = await api('/auth/admin/login', { method: 'POST', body: parsed.data });
      if (res.needsTotp) {
        navigate('/login/totp', {
          state: {
            challengeToken: res.challengeToken,
            totpSetupRequired: res.totpSetupRequired,
            from: location.state?.from,
          },
        });
        return;
      }
      startSession(res);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setServerError(
        err instanceof ApiError
          ? err.message
          : 'We could not sign you in. Check your connection and try again.'
      );
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center bg-bg p-lg">
      <section className="w-full max-w-[420px] rounded-xl border border-line border-b-4 bg-surface p-2xl">
        <Logo />
        <h1 className="mt-2xl text-pw-h1 font-[800] text-ink900">Sign in</h1>
        <p className="mt-sm text-pw-small text-ink600">
          Admin access for PollWise content and learners.
        </p>

        <form className="mt-2xl flex flex-col gap-lg" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              invalid={Boolean(errors.password)}
              {...register('password')}
            />
          </Field>
          {serverError && (
            <p
              role="alert"
              className="rounded-md bg-coral100 p-md text-pw-small font-[700] text-coral700"
            >
              {serverError}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Signing in…' : 'Continue'}
          </Button>
        </form>
      </section>
    </main>
  );
}
