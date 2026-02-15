import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-12 sm:px-10">
        <header className="flex items-center justify-between">
          <p className="text-sm font-semibold tracking-[0.2em] text-slate-300">
            SCHOOLTRACK
          </p>
          <nav className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium hover:border-slate-400"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-teal-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-200"
            >
              Get started
            </Link>
          </nav>
        </header>

        <section className="mt-20 grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
              Compliance visibility for every school, in one operating platform.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-slate-300">
              SchoolTrack helps leaders see training risk quickly, act with
              confidence, and keep a clear audit trail for every compliance
              decision.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/sign-up"
                className="rounded-md bg-teal-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-teal-200"
              >
                Create account
              </Link>
              <Link
                href="/sign-in"
                className="rounded-md border border-slate-600 px-5 py-3 text-sm font-medium hover:border-slate-400"
              >
                Open platform
              </Link>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Current build focus</h2>
            <ul className="space-y-3 text-sm text-slate-200">
              <li>Platform shell with org and school scope controls.</li>
              <li>TrainingTrack with expiry logic and dashboards.</li>
              <li>Traffic-light module indicators with reason codes.</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
