import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Button, Card, Field, Input, Logo } from '../components/ui.jsx';

const codeSchema = z
  .string()
  .trim()
  .regex(
    /^(\d{6}|[0-9A-Z]{4}-[0-9A-Z]{4})$/,
    'Enter the six-digit code from your app, or a recovery code.'
  );

/**
 * Second sign-in step (SECURITY §1). On first sign-in the super admin scans the setup key once, then
 * enters a code. The recovery codes appear once, after TOTP is switched on, and are never shown again.
 */
export default function TotpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { startSession } = useAuth();
  const { challengeToken, totpSetupRequired, from } = location.state ?? {};
  const [setup, setSetup] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFieldError,
  } = useForm({ mode: 'onBlur' });

  useEffect(() => {
    if (!challengeToken || !totpSetupRequired) return;
    api('/auth/admin/totp/setup', { method: 'POST', body: { challengeToken } })
      .then(setSetup)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Could not start set-up. Sign in again.')
      );
  }, [challengeToken, totpSetupRequired]);

  if (!challengeToken) return <Navigate to="/login" replace />;

  const onSubmit = async ({ code }) => {
    setError('');
    const parsed = codeSchema.safeParse(code);
    if (!parsed.success) {
      setFieldError('code', { message: parsed.error.issues[0].message });
      return;
    }
    try {
      const res = await api('/auth/admin/totp', {
        method: 'POST',
        body: { challengeToken, code: parsed.data.replace(/\s/g, '') },
      });
      if (res.recoveryCodes) {
        setRecovery(res.recoveryCodes);
        setSession(res);
        return;
      }
      startSession(res);
      navigate(from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work. Try again.');
    }
  };

  const copy = async (label, value) => {
    await navigator.clipboard?.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  };

  if (recovery) {
    return (
      <Shell title="Save your recovery codes">
        <p className="text-pw-body text-ink600">
          Each code works once if you lose your phone. They are shown only now. Store them somewhere
          safe.
        </p>
        <ul className="mt-lg grid grid-cols-2 gap-sm font-mono text-pw-body text-ink900">
          {recovery.map((c) => (
            <li key={c} className="rounded-md bg-bg px-md py-sm">
              {c}
            </li>
          ))}
        </ul>
        <Button
          className="mt-2xl w-full"
          onClick={() => {
            startSession(session);
            navigate(from ?? '/', { replace: true });
          }}
        >
          I have saved them
        </Button>
      </Shell>
    );
  }

  return (
    <Shell title={totpSetupRequired ? 'Set up two-step sign-in' : 'Enter your code'}>
      {totpSetupRequired && setup && (
        <Card className="mb-lg bg-bg">
          <p className="text-pw-small text-ink600">
            In your authenticator app, add a new account and enter this key. Then type the six-digit
            code below.
          </p>
          <p className="mt-md break-all font-mono text-pw-body text-ink900" aria-label="Setup key">
            {setup.secret}
          </p>
          <div className="mt-md flex flex-wrap gap-sm">
            <Button tone="quiet" onClick={() => copy('key', setup.secret)}>
              {copied === 'key' ? 'Copied' : 'Copy key'}
            </Button>
            <Button tone="quiet" onClick={() => copy('uri', setup.otpauthUri)}>
              {copied === 'uri' ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </Card>
      )}
      <form className="flex flex-col gap-lg" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field
          label="Code"
          htmlFor="code"
          error={errors.code?.message}
          hint="Six digits, or a recovery code."
        >
          <Input
            id="code"
            inputMode="text"
            autoComplete="one-time-code"
            invalid={Boolean(errors.code)}
            {...register('code')}
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
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Checking…' : 'Continue'}
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ title, children }) {
  return (
    <main className="flex min-h-full items-center justify-center bg-bg p-lg">
      <section className="w-full max-w-[460px] rounded-xl border border-line border-b-4 bg-surface p-2xl">
        <Logo />
        <h1 className="mt-2xl text-pw-h1 font-[800] text-ink900">{title}</h1>
        <div className="mt-lg">{children}</div>
      </section>
    </main>
  );
}
