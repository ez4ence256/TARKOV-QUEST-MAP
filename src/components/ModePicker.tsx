// Écran d'accueil : présentation de l'outil et choix du mode de jeu.
// index.html en garde une copie statique (affichée avant le JS) : toute modification de texte va dans homeContent.ts
// et dans cette copie, ModePicker.test.tsx vérifie qu'elles restent identiques.
import { GAME_MODES, type GameMode } from "../types";
import { tr, type Lang } from "../lib/i18n";
import { homeContent, SOURCES } from "../lib/homeContent";
// version affichée en pied de page : à augmenter à chaque livraison (voir JOURNAL.md)
import { version } from "../../package.json";

export function ModePicker({
  last,
  onPick,
  lang,
  onLang,
}: {
  last: GameMode | null;
  onPick: (m: GameMode) => void;
  lang: Lang;
  onLang: (l: Lang) => void;
}) {
  const c = homeContent();
  return (
    <div className="home">
      <main className="home-main">
        {/* dans <main> pour être dans un repère ; positionné par rapport à .home, la mise en page ne change pas */}
        <select
          className="input lang-select"
          value={lang}
          onChange={(e) => onLang(e.target.value === "en" ? "en" : "fr")}
          aria-label={tr("Langue", "Language")}
        >
          <option value="fr">FR</option>
          <option value="en">EN</option>
        </select>
        <header className="home-hero">
          <p className="home-kicker">
            <img src="/favicon.svg" width="24" height="24" alt="" />
            {c.kicker}
          </p>
          <h1>
            {c.title}
            <span className="home-accent">{c.titleAccent}</span>
          </h1>
          <p className="home-lead">{c.lead}</p>
          <ul className="home-pills">
            {c.pills.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </header>
        <section className="home-cta" aria-labelledby="home-pick">
          <h2 id="home-pick">{c.pickTitle}</h2>
          <div className="mode-options">
            {GAME_MODES.map((m) => (
              <button
                key={m.id}
                className={`mode-option ${m.id === last ? "is-last" : ""}`}
                onClick={() => onPick(m.id)}
                autoFocus={m.id === last}
              >
                <span className="mode-label">{m.label}</span>
                <span className="muted small">{m.hint}</span>
                {m.id === last && <span className="tag">{tr("dernier utilisé", "last used")}</span>}
              </button>
            ))}
          </div>
          <p className="home-note muted">{c.pickNote}</p>
        </section>
        <section className="home-section" aria-labelledby="home-features">
          <h2 id="home-features">{c.featuresTitle}</h2>
          <ul className="home-features">
            {c.features.map((f) => (
              <li key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="home-section" aria-labelledby="home-faq">
          <h2 id="home-faq">{c.faqTitle}</h2>
          <div className="home-faq">
            {c.faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="home-footer muted">
        <p>
          {c.sources}{" "}
          <a href={SOURCES.tarkovDev} target="_blank" rel="noopener noreferrer">
            tarkov.dev
          </a>{" "}
          ·{" "}
          <a href={SOURCES.wiki} target="_blank" rel="noopener noreferrer">
            {c.wikiName}
          </a>
        </p>
        <p>{c.disclaimer}</p>
        <p>Tarkov Quest Planner · v{version}</p>
      </footer>
    </div>
  );
}
