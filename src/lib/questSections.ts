// Ordre des sections repliables de l'onglet « Quête sélectionnée » (choix de l'utilisateur,
// session 5) : d'abord ce qui sert pendant le raid, le Résumé (réplique du marchand) en dernier.

export type QuestSectionId = "objectives" | "pack" | "guide" | "rewards" | "prereq" | "equipment" | "summary";

export const QUEST_SECTIONS: { id: QuestSectionId; title: string; open: boolean }[] = [
  { id: "objectives", title: "Objectifs", open: true },
  { id: "pack", title: "À emporter", open: true },
  { id: "guide", title: "Guide", open: true },
  { id: "rewards", title: "Récompenses", open: false },
  { id: "prereq", title: "Prérequis", open: false },
  { id: "equipment", title: "Équipement initial", open: false },
  { id: "summary", title: "Résumé", open: false },
];
