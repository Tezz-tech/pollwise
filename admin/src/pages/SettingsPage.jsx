import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, fieldErrors } from '../lib/api.js';
import { Button, Card, Field, Input, Pill, Skeleton, Textarea } from '../components/ui.jsx';

/** Platform settings (SPEC §9): pass mark, registration, election date, contacts, about text, access codes. */
export default function SettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['settings'], queryFn: () => api('/admin/settings') });

  if (query.isPending) return <Skeleton className="h-[480px]" />;
  if (query.isError)
    return (
      <Card>
        <p className="text-pw-body text-ink900">The settings could not be loaded.</p>
      </Card>
    );

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-2xl">
      <header>
        <h1 className="text-pw-display font-[900] text-ink900">Settings</h1>
        <p className="mt-xs text-pw-body text-ink600">
          These apply across the app. Changes are recorded in the audit log.
        </p>
      </header>
      <SettingsForm
        key={query.dataUpdatedAt}
        settings={query.data}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['settings'] })}
      />
      <AccessCodes
        codes={query.data.accessCodes}
        mode={query.data.registrationMode}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ['settings'] })}
      />
    </div>
  );
}

function SettingsForm({ settings, onSaved }) {
  const [serverErrors, setServerErrors] = useState({});
  const {
    register,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = useForm({
    defaultValues: {
      defaultPassMark: settings.defaultPassMark,
      registrationMode: settings.registrationMode,
      nextElectionDate: settings.nextElectionDate ? settings.nextElectionDate.slice(0, 10) : '',
      nextElectionLabel: settings.nextElectionLabel ?? '',
      supportEmail: settings.supportEmail ?? '',
      privacyPolicyUrl: settings.privacyPolicyUrl ?? '',
      aboutText: settings.aboutText ?? '',
    },
  });

  const save = useMutation({
    mutationFn: (body) => api('/admin/settings', { method: 'PATCH', body }),
    onSuccess: () => {
      toast.success('Settings saved.');
      setServerErrors({});
      onSaved();
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerErrors(fieldErrors(err));
      toast.error(err instanceof ApiError ? err.message : 'Settings could not be saved.');
    },
  });

  const onSubmit = (v) =>
    save.mutate({
      defaultPassMark: Number(v.defaultPassMark),
      registrationMode: v.registrationMode,
      nextElectionDate: v.nextElectionDate ? new Date(v.nextElectionDate).toISOString() : null,
      nextElectionLabel: v.nextElectionLabel || null,
      supportEmail: v.supportEmail || null,
      privacyPolicyUrl: v.privacyPolicyUrl || null,
      aboutText: v.aboutText || null,
    });

  return (
    <Card as="form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-lg">
      <div className="grid gap-lg md:grid-cols-2">
        <Field
          label="Default pass mark (%)"
          htmlFor="pm"
          error={serverErrors.defaultPassMark}
          hint="Used when a check has no pass mark of its own."
        >
          <Input
            id="pm"
            type="number"
            min={1}
            max={100}
            invalid={Boolean(serverErrors.defaultPassMark)}
            {...register('defaultPassMark', { valueAsNumber: true })}
          />
        </Field>
        <Field label="Who can join" htmlFor="rm" error={serverErrors.registrationMode}>
          <select
            id="rm"
            className="h-11 w-full rounded-md border border-line bg-surface px-md text-pw-body text-ink900"
            {...register('registrationMode')}
          >
            <option value="open">Anyone can sign up</option>
            <option value="access_code">Only with an access code</option>
          </select>
        </Field>
        <Field
          label="Next election date"
          htmlFor="ed"
          hint="Shows a countdown on the learner’s home screen."
        >
          <Input id="ed" type="date" {...register('nextElectionDate')} />
        </Field>
        <Field label="Election label" htmlFor="el" hint="For example: General election, 2027">
          <Input id="el" {...register('nextElectionLabel')} />
        </Field>
        <Field label="Support email" htmlFor="se" error={serverErrors.supportEmail}>
          <Input
            id="se"
            type="email"
            invalid={Boolean(serverErrors.supportEmail)}
            {...register('supportEmail')}
          />
        </Field>
        <Field label="Privacy policy link" htmlFor="pp" error={serverErrors.privacyPolicyUrl}>
          <Input
            id="pp"
            type="url"
            invalid={Boolean(serverErrors.privacyPolicyUrl)}
            {...register('privacyPolicyUrl')}
          />
        </Field>
      </div>
      <Field
        label="About PollWise"
        htmlFor="ab"
        hint="Shown on the About screen of the app."
        error={serverErrors.aboutText}
      >
        <Textarea
          id="ab"
          rows={5}
          invalid={Boolean(serverErrors.aboutText)}
          {...register('aboutText')}
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={!isDirty || isSubmitting || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </Card>
  );
}

/** Access codes: added once, stored only as hashes, and switched off rather than deleted. */
function AccessCodes({ codes, mode, onChanged }) {
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const add = useMutation({
    mutationFn: (body) => api('/admin/settings/access-codes', { method: 'POST', body }),
    onSuccess: () => {
      toast.success('Access code added. It cannot be shown again, so keep it somewhere safe.');
      setLabel('');
      setCode('');
      setError('');
      onChanged();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'The code could not be added.'),
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }) =>
      api(`/admin/settings/access-codes/${id}`, { method: 'PATCH', body: { active } }),
    onSuccess: onChanged,
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'That did not work.'),
  });

  useEffect(() => setError(''), [label, code]);

  return (
    <Card className="flex flex-col gap-lg">
      <div className="flex items-center justify-between gap-md">
        <h2 className="text-pw-h3 font-[800] text-ink900">Access codes</h2>
        <Pill tone={mode === 'access_code' ? 'published' : 'info'}>
          {mode === 'access_code' ? 'Codes are required' : 'Codes are not required'}
        </Pill>
      </div>
      <p className="text-pw-small text-ink600">
        Give a code to an organisation so its people can join. A code can be switched off at any
        time.
      </p>
      {codes.length === 0 && <p className="text-pw-body text-ink600">No codes yet.</p>}
      <ul className="flex flex-col gap-sm">
        {codes.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-md rounded-md bg-bg p-md"
          >
            <span className="text-pw-body text-ink900">
              {c.label || 'Unlabelled'} · used {c.uses} time{c.uses === 1 ? '' : 's'}
            </span>
            <Button
              tone="quiet"
              onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
              disabled={toggle.isPending}
            >
              {c.active ? 'Switch off' : 'Switch on'}
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-md md:grid-cols-[1fr_1fr_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate({ label, code });
        }}
      >
        <Field label="Label" htmlFor="ac-label" hint="For example: District office">
          <Input id="ac-label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Code (at least 8 characters)" htmlFor="ac-code" error={error || undefined}>
          <Input
            id="ac-code"
            type="password"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            invalid={Boolean(error)}
          />
        </Field>
        <Button type="submit" disabled={add.isPending || code.length < 8 || !label.trim()}>
          {add.isPending ? 'Adding…' : 'Add code'}
        </Button>
      </form>
    </Card>
  );
}
