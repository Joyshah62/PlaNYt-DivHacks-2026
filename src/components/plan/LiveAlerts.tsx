"use client";

import { Radio } from "lucide-react";
import { useEffect, useState } from "react";

interface LiveAlert {
  title: string;
  detail: string;
  place: string;
  source: { title: string; url: string };
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/**
 * Live heads-ups for the day from the web (parades, street fairs, closures, big games), shown only
 * when there are some. Crowd bars elsewhere are past ridership; these are what's on that date.
 */
export function LiveAlerts({ date, places }: { date: string; places: string[] }) {
  const key = `${date}|${places.join("|")}`;
  const [found, setFound] = useState<{ key: string; alerts: LiveAlert[] }>({ key: "", alerts: [] });

  useEffect(() => {
    if (!places.length) return;
    const controller = new AbortController();
    fetch("/api/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ date, places }), signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`alerts ${res.status}`);
        return res.json() as Promise<{ alerts: LiveAlert[] }>;
      })
      .then((body) => setFound({ key, alerts: body.alerts }))
      // A heads-up is a bonus: without one, the day still shows. Noted, so an outage isn't mistaken for a quiet day.
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.warn("[alerts] couldn't load live alerts:", error instanceof Error ? error.message : error);
      });
    return () => controller.abort();
    // `key` stands for date and places.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const alerts = found.key === key ? found.alerts : [];
  if (!alerts.length) return null;
  return (
    <aside className="ed-live" aria-label="Live heads-up for this day">
      <p className="ed-live-kicker">
        <Radio aria-hidden /> Live heads-up · from the web
      </p>
      <ul>
        {alerts.map((a) => (
          <li key={`${a.title}|${a.source.url}`}>
            <b>{a.title}</b>
            {a.place !== "Citywide" && <span className="ed-live-place"> · near {a.place}</span>}
            <span className="ed-live-detail">{a.detail}</span>
            <a href={a.source.url} target="_blank" rel="noopener noreferrer" className="ed-live-source">
              {host(a.source.url)} ↗
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
