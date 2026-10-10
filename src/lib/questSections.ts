// Ordre des sections repliables de l'onglet « Quête sélectionnée » (choix de l'utilisateur,
// session 5) : d'abord ce qui sert pendant le raid, le Résumé (réplique du marchand) en dernier.

import { tr } from "./i18n";

export type QuestSectionId = "objectives" | "pack" | "guide" | "rewards" | "prereq" | "equipment" | "summary";

export const QUEST_SECTIONS: { id: QuestSectionId; title: string; open: boolean }[] = [
  { id: "objectives", get title() { return tr("Objectifs", "Objectives"); }, open: true },
  { id: "pack", get title() { return tr("À emporter", "Required items"); }, open: true },
  { id: "guide", get title() { return tr("Guide", "Guide"); }, open: true },
  { id: "rewards", get title() { return tr("Récompenses", "Rewards"); }, open: false },
  { id: "prereq", get title() { return tr("Prérequis", "Prerequisites"); }, open: false },
  { id: "equipment", get title() { return tr("Équipement initial", "Starting equipment"); }, open: false },
  { id: "summary", get title() { return tr("Résumé", "Summary"); }, open: false },
];
