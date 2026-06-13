// Pulls LIVE alerts from api.weather.gov and computes the riskScore via score.ts.
// This is the offchain computation the CRE workflow performs; running it here proves the
// score comes from real data (no hard-coded values). Usage:
//   node --experimental-strip-types src/fetchAndScore.ts [areaState]
import { topFloodRisk, scoreAlert, type CapAlert } from "./score.ts";

const AREA = process.argv[2] ?? "NY";
const UA = "CivicShield/1.0 (ETHGlobal hackathon; nuo.rosemary@gmail.com)";

async function fetchActiveAlerts(area: string): Promise<CapAlert[]> {
  // In the CRE workflow this becomes cre.capabilities.HTTPClient (native fetch is unavailable in WASM).
  const res = await fetch(`https://api.weather.gov/alerts/active?area=${area}`, {
    headers: { "User-Agent": UA, Accept: "application/geo+json" },
  });
  if (!res.ok) throw new Error(`weather.gov ${res.status}`);
  const data = (await res.json()) as { features: { properties: CapAlert }[] };
  return data.features.map((f) => f.properties);
}

async function main() {
  const alerts = await fetchActiveAlerts(AREA);
  console.log(`area=${AREA}  active alerts=${alerts.length}`);
  for (const a of alerts) {
    const tag = /flood/i.test(a.event) ? "FLOOD" : "     ";
    console.log(`  [${tag}] ${a.event} | sev=${a.severity} urg=${a.urgency} cer=${a.certainty} -> score ${scoreAlert(a)}`);
  }
  const top = topFloodRisk(alerts);
  if (!top) {
    console.log(`\nNo active flood alert in ${AREA}. riskScore would be 0 (below threshold 75 -> no release).`);
    return;
  }
  console.log(`\nTop flood risk: ${top.alert.event} (${top.alert.areaDesc ?? ""})`);
  console.log(`  source alert id: ${top.alert.id}`);
  console.log(`  riskScore: ${top.riskScore}  -> ${top.riskScore >= 75 ? "ABOVE threshold, release unlocked" : "below threshold"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
