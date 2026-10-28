// Keeps the server awake on hosts whose free plan sleeps after a while without visits (Render's
// free plan sleeps after 15 minutes). Every few minutes the server visits its OWN public address,
// which counts as a visit, so it never goes to sleep and the Deriv connection stays up.
//
// Turned on only when a public address is known:
//   - RENDER_EXTERNAL_URL: set automatically by Render (e.g. https://stallion.onrender.com)
//   - KEEP_ALIVE_URL:      set it yourself on other hosts
// KEEP_ALIVE_MINUTES (default 10) changes how often. KEEP_ALIVE_URL=off turns it off.

const DEFAULT_MINUTES = 10;

export function startKeepAlive() {
    const base = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
    if (!base || base === "off") return;
    const minutes = Math.min(14, Math.max(1, Number(process.env.KEEP_ALIVE_MINUTES) || DEFAULT_MINUTES));
    const url = `${base.replace(/\/+$/, "")}/health`;

    const ping = async () => {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { "User-Agent": "stallion-keep-alive" } });
            if (!res.ok) console.warn(`[keep-alive] ${url} answered ${res.status}`);
        } catch (error) {
            console.warn(`[keep-alive] could not reach ${url}: ${error.message}`);
        }
    };

    setInterval(ping, minutes * 60_000).unref();
    console.info(`[keep-alive] visiting ${url} every ${minutes} min so the host doesn't sleep`);
}
