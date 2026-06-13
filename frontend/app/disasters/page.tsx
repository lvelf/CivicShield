import Link from "next/link";

type Disaster = {
  key: string;
  name: string;
  img: string;
  live: boolean;
  stat: string; // headline US data point
  detail: string; // severity / impact
};

const DISASTERS: Disaster[] = [
  {
    key: "flood",
    name: "Flood",
    img: "/pic/kelly-sikkema-_whs7FPfkwQ-unsplash.jpg",
    live: true,
    stat: "The most frequent U.S. disaster — live federal Flood Warnings via api.weather.gov.",
    detail: "This pool's scope. A qualifying NWS flood signal (severity · urgency · certainty → riskScore ≥ 75) is what unlocks relief.",
  },
  {
    key: "wildfire",
    name: "Wildfire",
    img: "/pic/markus-spiske-d4SLJNrU4rs-unsplash.jpg",
    live: false,
    stat: "~70,000 wildfires a year in the U.S.; ~7M acres burned annually.",
    detail: "Multi-scope coming: a wildfire pool with its own recipients and a regionalized agent.",
  },
  {
    key: "hurricane",
    name: "Hurricane",
    img: "/pic/nasa-5477L9Z5eqI-unsplash.jpg",
    live: false,
    stat: "Atlantic season Jun–Nov; repeated billion-dollar landfalls.",
    detail: "Multi-scope coming: per-region pools (e.g. FL-hurricane) with attested event scope.",
  },
  {
    key: "earthquake",
    name: "Earthquake",
    img: "/pic/usgs-WQ5HOvrDZ6Y-unsplash.jpg",
    live: false,
    stat: "USGS logs thousands of U.S. quakes yearly; M5+ cause major damage.",
    detail: "Multi-scope coming: USGS-fed scoring, same propose → certify → release machine.",
  },
];

// Page 2 — pick a hazard. Hover a card to see the U.S. picture; flood is live and donatable.
export default function DisastersPage() {
  return (
    <main className="bg-[#fafaf9]">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="font-sans text-sm uppercase tracking-[0.2em] text-stone-400">Choose a hazard</p>
        <h1 className="mt-3 max-w-2xl font-serif text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          Where relief is needed.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-stone-600">
          Hover any hazard for its U.S. picture. Today this fund is scoped to{" "}
          <span className="font-medium text-stone-900">flood</span> — the others are the multi-scope
          roadmap.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DISASTERS.map((d) => (
            <div
              key={d.key}
              className="group relative h-96 overflow-hidden rounded-2xl border border-stone-200"
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url('${d.img}')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/30 to-stone-950/10" />

              {/* status chip */}
              <span
                className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                  d.live
                    ? "bg-emerald-500/90 text-white ring-white/30"
                    : "bg-white/15 text-white ring-white/30 backdrop-blur"
                }`}
              >
                {d.live ? "LIVE" : "Preview"}
              </span>

              {/* base title */}
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h2 className="font-serif text-2xl font-semibold text-white">{d.name}</h2>

                {/* revealed-on-hover detail */}
                <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-500 group-hover:max-h-64 group-hover:opacity-100">
                  <p className="mt-2 text-sm text-white/85">{d.stat}</p>
                  <p className="mt-2 text-xs text-white/65">{d.detail}</p>
                  {d.live ? (
                    <Link
                      href="/donate"
                      className="mt-4 inline-flex rounded-full bg-white px-5 py-2 text-sm font-semibold text-stone-900 transition-colors hover:bg-white/90"
                    >
                      Donate to flood relief →
                    </Link>
                  ) : (
                    <span className="mt-4 inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white/70 ring-1 ring-inset ring-white/20">
                      Multi-scope — coming soon
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
