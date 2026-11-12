// Écran d'accueil : ce que fait l'outil, puis le choix du mode de jeu. Montré à la première visite et quand on change
// de mode : ensuite l'appli rouvre directement sur le dernier mode joué (loadState, src/state/store.ts).
// Les textes français sont repris tels quels dans index.html (copie statique affichée avant le chargement de
// l'appli, lue par les moteurs de recherche) et dans sa FAQ en données structurées : modifier les trois ensemble.
import { GAME_MODES, type GameMode } from "../types";
import { tr, type Lang } from "../lib/i18n";
import type { UiIconId } from "../lib/uiIcons";
import { UiIcon } from "./UiIcon";
import { IS_TOUCH } from "../lib/device";
// version affichée en pied de page : à augmenter à chaque livraison (voir JOURNAL.md)
import { version } from "../../package.json";

const MODE_ICONS: Record<GameMode, UiIconId> = { regular: "swords", pve: "shield", "pvp-season": "timer" };

const features = (): { icon: UiIconId; title: string; text: string }[] => [
  {
    icon: "map-pin",
    title: tr("Objectifs sur la carte", "Objectives on the map"),
    text: tr(
      "Une couleur par quête, une icône par type d'objectif, étage par étage, sur toutes les maps.",
      "One colour per quest, one icon per objective type, floor by floor, on every map.",
    ),
  },
  {
    icon: "log-out",
    title: tr("Sorties, coops et transits", "Extracts, co-op exits and transits"),
    text: tr("Les extractions PMC et Scav de chaque map, avec leur nom et leur faction.", "PMC and Scav extracts on every map, with their name and faction."),
  },
  {
    // téléphone : pas de Ctrl+V, la capture se fait en photo (la copie statique d'index.html garde le texte ordinateur)
    icon: IS_TOUCH ? "camera" : "clipboard-paste",
    title: tr("Import par capture d'écran", "Import from a screenshot"),
    text: IS_TOUCH
      ? tr(
          "Prends en photo le menu Tâches du jeu : tes quêtes sont reconnues dans ton navigateur.",
          "Take a photo of the in-game Tasks menu: your quests are recognised in your browser.",
        )
      : tr(
          "Colle une capture du menu Tâches avec Ctrl+V : tes quêtes sont reconnues dans ton navigateur.",
          "Paste a screenshot of the Tasks menu with Ctrl+V: your quests are recognised in your browser.",
        ),
  },
  {
    icon: "warehouse",
    title: tr("Objets à garder et planque", "Items to keep and hideout"),
    text: tr(
      "Ce qu'il te faut encore pour tes quêtes et pour les prochains niveaux de ta planque.",
      "What you still need for your quests and for the next levels of your hideout.",
    ),
  },
  {
    icon: "file-text",
    title: tr("Fiche de quête complète", "Full quest sheet"),
    text: tr("Guide, prérequis, récompenses et photos des emplacements, tirés du wiki.", "Guide, requirements, rewards and location photos, taken from the wiki."),
  },
  {
    icon: "users",
    title: tr("Jeu en équipe", "Team play"),
    text: tr("Crée une room pour voir les quêtes de tes coéquipiers sur la même carte.", "Create a room to see your teammates' quests on the same map."),
  },
];

const faq = (): { q: string; a: string }[] => [
  {
    q: tr("À quoi sert Tarkov Quest Planner ?", "What is Tarkov Quest Planner for?"),
    a: tr(
      "À préparer tes raids sur Escape from Tarkov. Tu sélectionnes tes quêtes en cours et leurs objectifs apparaissent en points sur la carte de chaque map, avec les sorties. En fin de raid, tu coches ce qui est fait et l'outil te propose les quêtes débloquées.",
      "Planning your Escape from Tarkov raids. Select the quests you are doing and their objectives show up as points on each map, with the extracts. After the raid, tick what is done and the tool suggests the quests you unlocked.",
    ),
  },
  {
    q: tr("Faut-il créer un compte ?", "Do I need an account?"),
    a: tr(
      "Non. Le site est gratuit et sans inscription : ta progression est enregistrée automatiquement dans ton navigateur. Un export JSON, dans les Réglages, permet de garder une copie ou de changer d'appareil.",
      "No. The site is free and needs no sign-up: your progress is saved automatically in your browser. A JSON export, in Settings, lets you keep a copy or switch devices.",
    ),
  },
  {
    q: tr("Le PvE et les saisons PvP sont-ils pris en charge ?", "Are PvE and PvP seasons supported?"),
    a: tr(
      "Oui. PvP, PvE et PvP Saison ont chacun leurs quêtes et leur propre progression. Tu choisis ton mode à la première visite : le site rouvre ensuite sur le dernier mode joué, et tu peux en changer à tout moment.",
      "Yes. PvP, PvE and PvP Season each have their own quests and their own progress. You pick your mode on your first visit: the site then reopens on the last mode you played, and you can change it at any time.",
    ),
  },
  {
    q: tr("Comment ajouter mes quêtes rapidement ?", "How do I add my quests quickly?"),
    a: tr(
      "Cherche-les par leur nom français ou anglais, ou importe une capture d'écran du menu Tâches du jeu (Ctrl+V sur ordinateur, photo sur téléphone) : les quêtes sont reconnues dans ton navigateur, l'image n'est envoyée nulle part.",
      "Search for them by their French or English name, or import a screenshot of the in-game Tasks menu (Ctrl+V on a computer, a photo on a phone): the quests are recognised in your browser, the image is not sent anywhere.",
    ),
  },
  {
    q: tr("D'où viennent les données ?", "Where does the data come from?"),
    a: tr(
      "Les quêtes, les maps, les sorties et les marchands viennent de l'API publique de tarkov.dev et se mettent à jour toutes seules. Les guides et les photos d'emplacements viennent du wiki Escape from Tarkov.",
      "Quests, maps, extracts and traders come from the public tarkov.dev API and update on their own. Guides and location photos come from the Escape from Tarkov wiki.",
    ),
  },
  {
    q: tr("Peut-on l'utiliser en équipe ?", "Can I use it with my squad?"),
    a: tr(
      "Oui. Crée une room et donne son ID à tes coéquipiers : chacun voit sur la même carte, en lecture seule, les quêtes et les objectifs cochés des autres.",
      "Yes. Create a room and give its ID to your teammates: everyone sees, read-only and on the same map, the quests and ticked objectives of the others.",
    ),
  },
];

/** Logo : réticule kaki, objectif orange (même dessin que public/favicon.svg). */
function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" width="26" height="26" aria-hidden="true">
      <circle cx="32" cy="32" r="17" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M32 8v11M32 45v11M8 32h11M45 32h11" stroke="currentColor" strokeWidth="4" />
      <circle className="brand-dot" cx="32" cy="32" r="6" />
    </svg>
  );
}

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
  return (
    <div className="landing">
      <header className="landing-top">
        <div className="landing-brand">
          <BrandMark />
          Tarkov Quest Planner
        </div>
        <select
          className="input lang-select"
          value={lang}
          onChange={(e) => onLang(e.target.value === "en" ? "en" : "fr")}
          aria-label={tr("Langue", "Language")}
        >
          <option value="fr">FR</option>
          <option value="en">EN</option>
        </select>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <p className="landing-kicker">{tr("Planificateur de quêtes · Escape from Tarkov", "Quest planner · Escape from Tarkov")}</p>
          <h1>
            {tr("Tes quêtes Escape from Tarkov, ", "Your Escape from Tarkov quests, ")}
            <em>{tr("sur la carte.", "on the map.")}</em>
          </h1>
          <p className="landing-lead">
            {tr(
              "Sélectionne tes quêtes en cours : leurs objectifs s'affichent sur la map, avec les sorties. Coche-les en fin de raid, l'outil te propose la suite.",
              "Select the quests you are doing: their objectives show up on the map, with the extracts. Tick them after the raid and the tool suggests what comes next.",
            )}
          </p>
          <ul className="landing-trust">
            <li>{tr("Gratuit", "Free")}</li>
            <li>{tr("Sans compte", "No account")}</li>
            <li>{tr("Progression enregistrée dans ton navigateur", "Progress saved in your browser")}</li>
          </ul>
        </section>

        <section className="mode-card" aria-labelledby="mode-title">
          <h2 id="mode-title" className="mode-title">
            {tr("Choisis ton mode de jeu", "Choose your game mode")}
          </h2>
          <div className="mode-options">
            {GAME_MODES.map((m) => (
              <button key={m.id} className={`mode-option${m.id === last ? " is-last" : ""}`} onClick={() => onPick(m.id)} autoFocus={m.id === last}>
                <UiIcon id={MODE_ICONS[m.id]} size={22} />
                <span className="mode-text">
                  <span className="mode-label">{m.label}</span>
                  <span className="mode-hint">{m.hint}</span>
                </span>
                {m.id === last && <span className="mode-last">{tr("Reprendre", "Resume")}</span>}
                <UiIcon id="chevron-right" size={18} />
              </button>
            ))}
          </div>
          <p className="mode-note">
            {tr("Chaque mode garde sa propre progression. Tu peux en changer à tout moment.", "Each mode keeps its own progress. You can switch at any time.")}
          </p>
        </section>
      </main>

      <section className="landing-section" aria-labelledby="features-title">
        <h2 id="features-title" className="landing-h2">
          {tr("Tout ce qu'il faut pour préparer un raid", "Everything you need to plan a raid")}
        </h2>
        <ul className="feature-grid">
          {features().map((f) => (
            <li key={f.icon} className="feature">
              <UiIcon id={f.icon} size={22} />
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-section" aria-labelledby="faq-title">
        <h2 id="faq-title" className="landing-h2">
          {tr("Questions fréquentes", "Frequently asked questions")}
        </h2>
        <div className="faq">
          {faq().map((f) => (
            <details key={f.q} className="faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <p>
          {tr("Données :", "Data:")}{" "}
          <a href="https://tarkov.dev" target="_blank" rel="noopener noreferrer">
            tarkov.dev
          </a>
          . {tr("Guides et photos :", "Guides and photos:")}{" "}
          <a href="https://escapefromtarkov.fandom.com/wiki/Escape_from_Tarkov_Wiki" target="_blank" rel="noopener noreferrer">
            {tr("wiki Escape from Tarkov", "Escape from Tarkov wiki")}
          </a>
          .{" "}
          {tr(
            "Site de fan : Escape from Tarkov est une marque de Battlestate Games, ce projet n'y est pas affilié.",
            "Fan site: Escape from Tarkov is a trademark of Battlestate Games; this project is not affiliated with it.",
          )}
        </p>
        <span className="app-version">v{version}</span>
      </footer>
    </div>
  );
}
