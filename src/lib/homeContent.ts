// Textes de l'écran d'accueil (français / anglais). index.html en garde une copie statique :
// ModePicker.test.tsx vérifie que les deux (et les données structurées) disent la même chose.
import { tr } from "./i18n";

/** Titre de l'onglet hors carte (index.html porte la version française). */
export const homeTitle = () =>
  tr("Carte et suivi des quêtes Escape from Tarkov | Tarkov Quest Planner", "Escape from Tarkov quest map and tracker | Tarkov Quest Planner");

export const SOURCES = {
  tarkovDev: "https://tarkov.dev/",
  wiki: "https://escapefromtarkov.fandom.com/wiki/Escape_from_Tarkov_Wiki",
};

/** Textes de la page d'accueil, lus à l'affichage (la langue peut changer). */
export function homeContent() {
  return {
    kicker: tr("Planificateur de quêtes · Escape from Tarkov", "Quest planner · Escape from Tarkov"),
    title: tr("Tes quêtes Escape from Tarkov, ", "Your Escape from Tarkov quests, "),
    titleAccent: tr("sur la carte.", "on the map."),
    lead: tr(
      "Sélectionne tes quêtes en cours : leurs objectifs s'affichent sur la map, avec les sorties. Coche-les en fin de raid, l'outil te propose la suite.",
      "Pick the quests you are working on: their objectives show up on the map, along with the extracts. Tick them off after a raid and the tool suggests what comes next.",
    ),
    pills: [
      tr("Gratuit", "Free"),
      tr("Sans compte", "No account"),
      tr("Progression enregistrée dans ton navigateur", "Progress saved in your browser"),
    ],
    pickTitle: tr("Choisis ton mode de jeu", "Choose your game mode"),
    pickNote: tr(
      "Chaque mode garde sa propre progression. Tu peux en changer à tout moment.",
      "Each mode keeps its own progress. You can switch at any time.",
    ),
    featuresTitle: tr("Tout ce qu'il faut pour préparer un raid", "Everything you need to plan a raid"),
    features: [
      {
        title: tr("Objectifs sur la carte", "Objectives on the map"),
        text: tr(
          "Chaque objectif de tes quêtes devient un point sur la map, avec une couleur par quête et une icône par type d'objectif.",
          "Every objective of your quests becomes a point on the map, with one colour per quest and one icon per objective type.",
        ),
      },
      {
        title: tr("Sorties, coops et transits", "Extracts, co-ops and transits"),
        text: tr(
          "Les sorties, coops et transits de chaque map sont affichés, avec leur faction et leur destination.",
          "The extracts, co-op extracts and transits of every map are shown, with their faction and destination.",
        ),
      },
      {
        title: tr("Import par capture d'écran", "Screenshot import"),
        text: tr(
          "Colle une capture de ton menu Tâches avec Ctrl+V, ou envoie une photo depuis ton téléphone : tes quêtes en cours sont reconnues.",
          "Paste a screenshot of your Tasks menu with Ctrl+V, or send a photo from your phone: your current quests are recognised.",
        ),
      },
      {
        title: tr("Objets à garder et planque", "Items to keep and hideout"),
        text: tr(
          "Cherche un objet : l'outil indique les quêtes et les modules de la planque qui en ont besoin, ses barters et ses crafts.",
          "Look up an item: the tool shows which quests and hideout modules need it, plus its barters and crafts.",
        ),
      },
      {
        title: tr("Fiche de quête complète", "Complete quest page"),
        text: tr(
          "Objectifs, objets à emporter, prérequis, récompenses et guide du wiki, au même endroit.",
          "Objectives, items to bring, prerequisites, rewards and the wiki guide, all in one place.",
        ),
      },
      {
        title: tr("Jeu en équipe", "Team play"),
        text: tr(
          "Crée une room et partage son code : chacun garde ses quêtes et voit celles de ses coéquipiers.",
          "Create a room and share its code: everyone keeps their own quests and sees their teammates' quests.",
        ),
      },
    ],
    faqTitle: tr("Questions fréquentes", "Frequently asked questions"),
    faq: [
      {
        q: tr("À quoi sert Tarkov Quest Planner ?", "What is Tarkov Quest Planner for?"),
        a: tr(
          "C'est une carte interactive des quêtes d'Escape from Tarkov. Tu sélectionnes les quêtes en cours : leurs objectifs s'affichent sur la map, avec les sorties, les coops et les transits. En fin de raid, tu les coches et l'outil te propose les quêtes suivantes.",
          "It is an interactive map of Escape from Tarkov quests. You pick the quests you are working on: their objectives show up on the map, with the extracts, co-op extracts and transits. After a raid you tick them off and the tool suggests the next quests.",
        ),
      },
      {
        q: tr("Faut-il créer un compte ?", "Do I need to create an account?"),
        a: tr(
          "Non. L'outil est gratuit et il n'y a ni compte ni inscription. Ta progression est enregistrée dans ton navigateur, séparément pour chaque mode de jeu : elle reste sur cet appareil et disparaît si tu vides les données du site.",
          "No. The tool is free and there is no account or sign-up. Your progress is saved in your browser, separately for each game mode: it stays on this device and is lost if you clear the site data.",
        ),
      },
      {
        q: tr("Le PvE et les saisons PvP sont-ils pris en charge ?", "Are PvE and PvP seasons supported?"),
        a: tr(
          "Oui. Tu choisis PvP, PvE ou PvP Saison au démarrage. Chaque mode a ses propres quêtes (données de tarkov.dev) et sa propre progression, et tu peux changer de mode à tout moment.",
          "Yes. You choose PvP, PvE or PvP Season when you start. Each mode has its own quests (tarkov.dev data) and its own progress, and you can switch modes at any time.",
        ),
      },
      {
        q: tr("Comment ajouter mes quêtes rapidement ?", "How do I add my quests quickly?"),
        a: tr(
          "Fais une capture de ton menu Personnage > Tâches dans le jeu, puis colle-la dans l'appli avec Ctrl+V (ou choisis l'image, ou envoie une photo depuis ton téléphone). La lecture se fait dans ton navigateur et tu vérifies les quêtes reconnues avant de les ajouter. Tu peux aussi les chercher dans la liste.",
          "Take a screenshot of your Character > Tasks menu in the game, then paste it into the app with Ctrl+V (or choose the image, or send a photo from your phone). The reading happens in your browser and you check the recognised quests before adding them. You can also search for them in the list.",
        ),
      },
      {
        q: tr("D'où viennent les données ?", "Where does the data come from?"),
        a: tr(
          "Les quêtes, objectifs, maps et objets viennent de l'API de tarkov.dev. Les textes détaillés, les guides et les photos des quêtes viennent du wiki Escape from Tarkov. Les données sont gardées dans ton navigateur et rafraîchies régulièrement.",
          "Quests, objectives, maps and items come from the tarkov.dev API. The detailed texts, guides and photos of the quests come from the Escape from Tarkov wiki. The data is kept in your browser and refreshed regularly.",
        ),
      },
      {
        q: tr("Peut-on l'utiliser en équipe ?", "Can I use it with a team?"),
        a: tr(
          "Oui, avec le bouton Room : l'un d'entre vous crée une room, les autres la rejoignent avec son code. Chacun garde ses propres quêtes et voit celles de ses coéquipiers en lecture seule. Aucun compte n'est nécessaire.",
          "Yes, with the Room button: one of you creates a room and the others join it with its code. Everyone keeps their own quests and sees their teammates' quests in read-only mode. No account is needed.",
        ),
      },
    ],
    sources: tr("Sources :", "Sources:"),
    wikiName: tr("wiki Escape from Tarkov", "Escape from Tarkov wiki"),
    disclaimer: tr("Site de fan, non affilié à Battlestate Games.", "Fan site, not affiliated with Battlestate Games."),
  };
}
