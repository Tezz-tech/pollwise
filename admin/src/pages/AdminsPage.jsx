import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { api, ApiError, fieldErrors } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';
import { Button, Card, Field, Input, Pill, Skeleton } from '../components/ui.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const ROLE_LABEL = { content_admin: 'Content admin', super_admin: 'Super admin' };
const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Enter their name.').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  role: z.enum(['content_admin', 'super_admin']),
});

/** Admins (SPEC §4): invite by email, and revoke. A revoke ends that admin's sessions at once. */
export default function AdminsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState(null);
  const [serverErrors, setServerErrors] = useState({});
  const list = useQuery({ queryKey: ['admins'], queryFn: () => api('/admin/admins') });

  const invite = useMutation({
    mutationFn: (body) => api('/admin/admins', { method: 'POST', body }),
    onSuccess: (res) => {
      toast.success(`Invitation sent to ${res.email}.`);
      reset();
      setServerErrors({});
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerErrors(fieldErrors(err));
      toast.error(err instanceof ApiError ? err.message : 'The invitation could not be sent.');
    },
  });
  const revoke = useMutation({
    mutationFn: (id) => api(`/admin/admins/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Access revoked. Their sessions have ended.');
      setRevoking(null);
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (err) => {
      setRevoking(null);
      toast.error(err instanceof ApiError ? err.message : 'Access could not be revoked.');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ defaultValues: { name: '', email: '', role: 'content_admin' } });
  const onSubmit = (values) => {
    setServerErrors({});
    const parsed = inviteSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) setError(issue.path[0], { message: issue.message });
      return;
    }
    invite.mutate(parsed.data);
  };

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-2xl">
      <header>
        <h1 className="text-pw-display font-[900] text-ink900">Admins</h1>
        <p className="mt-xs text-pw-body text-ink600">
          Invite people to build courses, or to manage learners and settings too.
        </p>
      </header>

      <Card className="flex flex-col gap-lg">
        <h2 className="text-pw-h3 font-[800] text-ink900">Invite an admin</h2>
        <form
          className="grid gap-lg md:grid-cols-[1fr_1fr_200px_auto] md:items-end"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <Field label="Name" htmlFor="inv-name" error={errors.name?.message ?? serverErrors.name}>
            <Input id="inv-name" invalid={Boolean(errors.name)} {...register('name')} />
          </Field>
          <Field
            label="Email"
            htmlFor="inv-email"
            error={errors.email?.message ?? serverErrors.email}
          >
            <Input
              id="inv-email"
              type="email"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>
          <Field label="Role" htmlFor="inv-role">
            <select
              id="inv-role"
              className="h-11 w-full rounded-md border border-line bg-surface px-md text-pw-body text-ink900"
              {...register('role')}
            >
              <option value="content_admin">Content admin</option>
              <option value="super_admin">Super admin</option>
            </select>
          </Field>
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? 'Sending…' : 'Send invitation'}
          </Button>
        </form>
        <p className="text-pw-small text-ink600">
          They get a link that works once, for 48 hours, to choose their own password. Super admins
          also set up two-step sign-in.
        </p>
      </Card>

      <section aria-labelledby="list-h" className="flex flex-col gap-md">
        <h2 id="list-h" className="text-pw-h2 font-[800] text-ink900">
          Current admins
        </h2>
        {list.isPending && <Skeleton className="h-40" />}
        {list.data?.items.map((a) => (
          <Card key={a.id} className="flex flex-wrap items-center justify-between gap-md">
            <div className="min-w-0">
              <p className="text-pw-body font-[800] text-ink900">
                {a.name} {a.id === user.id && <span className="font-[700] text-ink600">(you)</span>}
              </p>
              <p className="text-pw-small text-ink600">
                {a.email} · last sign-in {formatDateTime(a.lastLoginAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-md">
              <Pill tone="info">{ROLE_LABEL[a.role]}</Pill>
              {a.role === 'super_admin' && (
                <Pill tone={a.totpEnabled ? 'published' : 'warn'}>
                  {a.totpEnabled ? 'Two-step on' : 'Two-step not set up'}
                </Pill>
              )}
              {a.status !== 'active' && <Pill tone="warn">{a.status}</Pill>}
              <Button
                tone="quiet"
                disabled={a.id === user.id || a.status !== 'active'}
                onClick={() => setRevoking(a)}
              >
                Revoke access
              </Button>
            </div>
          </Card>
        ))}
      </section>

      <ConfirmDialog
        open={Boolean(revoking)}
        title="Revoke this admin’s access?"
        body={`${revoking?.name ?? ''} will be signed out everywhere and cannot sign in again until invited anew. This is recorded in the audit log.`}
        confirmLabel="Revoke access"
        tone="danger"
        busy={revoke.isPending}
        onClose={() => setRevoking(null)}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
      />
    </div>
  );
}
