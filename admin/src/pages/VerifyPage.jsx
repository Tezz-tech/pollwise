import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Check, X } from 'lucide-react';
import { formatDate } from '../lib/format.js';
import { Card, Logo } from '../components/ui.jsx';

/**
 * Public certificate check (SPEC §6, §8.6). No sign-in. It shows only whether the certificate is valid,
 * the learner's name, the course and the date. The visible tick or cross also carries words.
 */
export default function VerifyPage() {
  const { code } = useParams();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/verify/${encodeURIComponent(code ?? '')}`)
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled)
          setState(body.data?.valid ? { status: 'valid', ...body.data } : { status: 'invalid' });
      })
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <main className="flex min-h-full items-center justify-center bg-bg p-lg">
      <Card as="section" className="w-full max-w-[480px] p-2xl text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        {state.status === 'loading' && (
          <p className="mt-2xl text-pw-body text-ink600" role="status">
            Checking this certificate…
          </p>
        )}
        {state.status === 'valid' && (
          <div className="mt-2xl flex flex-col items-center gap-md">
            <span className="flex h-16 w-16 items-center justify-center rounded-pill bg-jade100 text-jade700">
              <Check size={32} aria-hidden="true" />
            </span>
            <h1 className="text-pw-h1 font-[800] text-ink900">This certificate is valid</h1>
            <p className="text-pw-h3 font-[800] text-ink900">{state.learnerName}</p>
            <p className="text-pw-body text-ink900">{state.courseTitle}</p>
            <p className="text-pw-small text-ink600">Issued {formatDate(state.issuedAt)}</p>
          </div>
        )}
        {state.status === 'invalid' && (
          <div className="mt-2xl flex flex-col items-center gap-md">
            <span className="flex h-16 w-16 items-center justify-center rounded-pill bg-coral100 text-coral700">
              <X size={32} aria-hidden="true" />
            </span>
            <h1 className="text-pw-h1 font-[800] text-ink900">
              We could not verify this certificate
            </h1>
            <p className="text-pw-body text-ink600">
              Check the code and try again. If it still fails, contact the course provider.
            </p>
          </div>
        )}
        {state.status === 'error' && (
          <p className="mt-2xl text-pw-body text-ink900">
            The check could not be made. Try again in a moment.
          </p>
        )}
      </Card>
    </main>
  );
}
