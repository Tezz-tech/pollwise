/**
 * Placeholder sign-in page for Phase 0. The real admin sign-in, including TOTP for super admins, is
 * built in Phase 1 (server) and Phase 5 (admin). Nothing here sends credentials anywhere.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-full items-center justify-center p-lg">
      <section className="w-full max-w-[420px] rounded-lg border border-line border-b-4 bg-surface p-2xl">
        <img src="/brand/pollwise-logo.svg" alt="PollWise" className="mx-auto h-10 w-auto" />

        <h1 className="mt-2xl text-center text-pw-h1 font-[800] text-ink900">Admin sign in</h1>
        <p className="mt-sm text-center text-pw-small text-ink600">
          Content and learner management for PollWise.
        </p>

        <form className="mt-2xl flex flex-col gap-lg" onSubmit={(event) => event.preventDefault()}>
          <label className="flex flex-col gap-xs text-pw-small font-[700] text-ink900">
            Email
            <input
              type="email"
              name="email"
              autoComplete="username"
              disabled
              className="h-14 rounded-md border border-line bg-bg px-lg text-pw-body text-ink900 disabled:text-ink400"
            />
          </label>

          <label className="flex flex-col gap-xs text-pw-small font-[700] text-ink900">
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              disabled
              className="h-14 rounded-md border border-line bg-bg px-lg text-pw-body text-ink900 disabled:text-ink400"
            />
          </label>

          <button
            type="submit"
            disabled
            className="h-13 rounded-md border-b-4 border-jade700 bg-jade600 text-pw-label font-[800] uppercase tracking-[0.6px] text-white disabled:border-line disabled:bg-line disabled:text-ink400"
          >
            Sign in
          </button>
        </form>

        <p className="mt-lg text-center text-pw-small text-ink600">
          Sign-in is switched on in a later build step.
        </p>
      </section>
    </main>
  );
}
