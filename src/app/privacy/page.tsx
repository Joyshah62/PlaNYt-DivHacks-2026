import type { Metadata } from "next";
import { AppBar } from "@/components/editorial/AppBar";
import { edFonts } from "@/components/editorial/fonts";
import { BRAND } from "@/lib/plan/display";
import "./privacy.css";

export const metadata: Metadata = {
  title: `Privacy · ${BRAND.name}`,
  description: `What ${BRAND.name} collects, why, who helps us run it, and the choices you have.`,
};

const UPDATED = "September 27, 2026";
/** Where privacy requests go. */
const CONTACT = "privacy@planyt.tech";

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "summary",
    title: "The short version",
    body: (
      <>
        <p>
          {BRAND.name} plans days in New York City. We collect what we need to plan your day, save it and share it with the people you
          invite, and nothing more. We don&apos;t sell your data, we don&apos;t show ads, and we don&apos;t use third-party analytics or
          tracking cookies.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <ul>
        <li>
          <b>Your account.</b> Your name and email address, from Google sign-in or the form you fill in, and a password if you choose one
          (stored only as a secure hash). A phone number, if you add one, so we can text you your plan.
        </li>
        <li>
          <b>Your plans.</b> The places, times and preferences in the days you plan and save, such as your pace, who&apos;s coming and
          what you&apos;re interested in.
        </li>
        <li>
          <b>Trip rooms.</b> The name and emoji you join with, the times you&apos;re free, your votes, and the ideas and messages you post.
          If you share where you&apos;re starting from, we store it rounded to about 200 meters and show your friends only the
          neighborhood.
        </li>
        <li>
          <b>What you ask Roam AI.</b> The messages you send our assistant on the website or by iMessage, and voice notes you record,
          which we turn into text.
        </li>
        <li>
          <b>Your location, only when you ask.</b> If you tap &ldquo;Use my location&rdquo; or &ldquo;Locate me&rdquo;, your browser
          shares your position for that search. We don&apos;t track you in the background.
        </li>
        <li>
          <b>On your device.</b> Your theme and some planner settings stay in your browser&apos;s storage. Guests in a trip room are
          remembered there too.
        </li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To plan your day: finding places, fitting them to opening hours, subway times and crowds, and suggesting changes.</li>
        <li>To save your plans to your account and show them on any device you sign in on.</li>
        <li>To run trip rooms: showing your group&apos;s votes and ideas, and finding a fair place to meet.</li>
        <li>To text you your plan and, on the day, when it&apos;s time to head to the next stop. Text STOP at any time.</li>
        <li>To remember preferences you mention (&ldquo;I&apos;m vegetarian&rdquo;), so later plans suit you.</li>
        <li>To keep the service secure, fix problems and prevent abuse.</li>
      </ul>
    ),
  },
  {
    id: "share",
    title: "Who helps us run it",
    body: (
      <>
        <p>We share data only with the services that make {BRAND.name} work, and only what each one needs:</p>
        <dl>
          <dt>Google</dt>
          <dd>Sign-in, maps, place details and photos, and Gemini, the AI model behind Roam AI, which reads your messages to plan.</dd>
          <dt>ElevenLabs</dt>
          <dd>Turns your voice notes into text and reads replies aloud when you ask.</dd>
          <dt>Tavily</dt>
          <dd>Web searches Roam AI makes to check themed days (search terms only, never your account details).</dd>
          <dt>Backboard</dt>
          <dd>Keeps the preferences Roam AI remembers about you.</dd>
          <dt>Photon (Spectrum)</dt>
          <dd>Delivers our iMessage texts to your phone.</dd>
          <dt>MongoDB Atlas and Render</dt>
          <dd>Store our data and host the website.</dd>
          <dt>OpenStreetMap, NYC GeoSearch and Open-Meteo</dt>
          <dd>Look up the places and addresses you search, and the weather for your day.</dd>
        </dl>
        <p>
          The people in a trip room see what you post there. We may also disclose information if the law requires it or to protect
          someone&apos;s safety.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>
        We use one kind of cookie: the one that keeps you signed in. We don&apos;t use advertising or analytics cookies, so there&apos;s
        nothing to opt out of.
      </p>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <ul>
        <li>Trip rooms are deleted automatically 30 days after anyone last changed them.</li>
        <li>Saved plans and your account stay until you delete them or ask us to.</li>
        <li>iMessage conversations are kept while you use the service, so we can pick up where you left off.</li>
        <li>Server logs leave out what you write, and our host keeps them only for a limited time.</li>
      </ul>
    ),
  },
  {
    id: "choices",
    title: "Your choices",
    body: (
      <ul>
        <li>You can use the planner without sharing your location.</li>
        <li>Text STOP to stop updates by iMessage, and START to turn them back on.</li>
        <li>
          You can ask us for a copy of your data, to correct it, or to delete your account and everything tied to it. Email{" "}
          <a href={`mailto:${CONTACT}`} className="ed-link">
            {CONTACT}
          </a>{" "}
          and we&apos;ll reply within 30 days.
        </li>
        <li>Depending on where you live (for example, California or the EU), you may have further rights, and we&apos;ll honor them.</li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Data travels over encrypted connections and is stored with access limited to the services above. No system is perfectly secure,
        but we work to protect your information and will tell you if a breach affects you.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>{BRAND.name} isn&apos;t meant for children under 13, and we don&apos;t knowingly collect their information.</p>,
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <p>
        If we change this policy, we&apos;ll update the date at the top, and tell you in the app if the change matters. Questions?
        Email{" "}
        <a href={`mailto:${CONTACT}`} className="ed-link">
          {CONTACT}
        </a>
        .
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className={`ed ${edFonts}`}>
      <main className="ed-app ed-paper pv">
        <AppBar />
        <header className="ed-gut pv-head">
          <p className="ed-mono ed-kicker">Updated {UPDATED}</p>
          <h1 className="pv-title">
            Privacy, <em>plainly.</em>
          </h1>
          <p className="ed-dek">What {BRAND.name} collects, why, who helps us run it, and the choices you have.</p>
        </header>
        <div className="ed-gut pv-grid">
          <nav aria-label="On this page" className="pv-toc">
            <p className="ed-mono ed-muted">On this page</p>
            <ol>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          <article className="pv-body">
            {SECTIONS.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`}>
                <h2 id={`${s.id}-title`} className="ed-h3">
                  <span className="ed-mono ed-kicker">{String(i + 1).padStart(2, "0")}</span> {s.title}
                </h2>
                {s.body}
              </section>
            ))}
          </article>
        </div>
      </main>
    </div>
  );
}
