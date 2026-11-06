import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../lib/api.js';
import { Button, Modal } from '../components/ui.jsx';

/**
 * Publish checklist (SPEC §8.5, DESIGN §7). The server returns every problem at once; each one here is a
 * button that takes the admin to the item to fix. Success gets one small confetti burst.
 */
export default function PublishModal({ courseId, open, onClose, onJump, onPublished }) {
  const [problems, setProblems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const publish = async () => {
    setBusy(true);
    setMessage('');
    try {
      await api(`/admin/courses/${courseId}/publish`, { method: 'POST' });
      setProblems([]);
      onPublished();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PUBLISH_CHECKLIST_FAILED') {
        setProblems(err.details ?? []);
        setMessage(err.message);
      } else {
        setMessage(
          err instanceof ApiError ? err.message : 'The course could not be published. Try again.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setProblems(null);
    setMessage('');
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Publish this course" wide>
      <div className="flex flex-col gap-lg">
        {problems === null && (
          <>
            <p className="text-pw-body text-ink600">
              We will check the course first. Learners see it as soon as it is published.
            </p>
            <Button onClick={publish} disabled={busy}>
              {busy ? 'Checking…' : 'Check and publish'}
            </Button>
          </>
        )}

        {problems && problems.length > 0 && (
          <>
            <p
              role="alert"
              className="flex items-start gap-sm text-pw-body font-[800] text-coral700"
            >
              <AlertTriangle size={18} className="mt-xs shrink-0" aria-hidden="true" />
              {message}
            </p>
            <ul className="flex flex-col gap-sm">
              {problems.map((p, i) => (
                <li key={`${p.path}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onJump(p.path);
                      close();
                    }}
                    className="flex w-full items-start gap-md rounded-md border border-line bg-surface p-md text-left text-pw-body text-ink900 hover:border-jade600"
                  >
                    <span
                      className="mt-[6px] h-2.5 w-2.5 shrink-0 rounded-pill bg-coral600"
                      aria-hidden="true"
                    />
                    <span>{p.message}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button tone="quiet" onClick={publish} disabled={busy}>
                Check again
              </Button>
            </div>
          </>
        )}

        {problems && problems.length === 0 && (
          <div className="flex flex-col items-center gap-md py-lg text-center">
            <CheckCircle2 size={40} className="text-jade600" aria-hidden="true" />
            <p className="text-pw-h3 font-[800] text-ink900">
              Published. Learners can find it now.
            </p>
            <Button onClick={close}>Back to the builder</Button>
          </div>
        )}

        {!problems && message && (
          <p role="alert" className="text-pw-small font-[700] text-coral700">
            {message}
          </p>
        )}
      </div>
    </Modal>
  );
}
