export default function NoAccessPage() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Access Required
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-100">
        No entitled modules available
      </h1>
      <p className="mt-3 max-w-2xl text-slate-300">
        Your account is authenticated but does not currently have access to any
        modules. Ask an organisation administrator to assign module entitlements
        in your user profile.
      </p>
    </section>
  );
}
