import Link from "next/link";

// Page 1 — the cinematic hero. One message, one action: Start.
export default function Home() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-center">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/pic/nasa-5477L9Z5eqI-unsplash.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-stone-950/70 via-stone-950/45 to-stone-950/85" />

      <div className="relative z-10 max-w-3xl px-6">
        <p className="font-sans text-sm uppercase tracking-[0.25em] text-white/70">On-chain disaster relief</p>
        <h1 className="mt-5 font-serif text-6xl font-semibold leading-[1.05] tracking-tight text-white sm:text-8xl">
          CivicShield
        </h1>
        <p className="mx-auto mt-6 max-w-xl font-serif text-2xl italic leading-snug text-white/90 sm:text-3xl">
          Real-world disaster unlocks relief.
        </p>
        <p className="mx-auto mt-4 max-w-lg text-base text-white/70">
          AI proposes, the chain certifies, donors verify. A verified hazard signal — not a
          committee, not an unaccountable AI — is what releases the money.
        </p>

        <Link
          href="/disasters"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-stone-900 transition-colors hover:bg-white/90"
        >
          Start →
        </Link>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-white/50">↓</div>
    </section>
  );
}
