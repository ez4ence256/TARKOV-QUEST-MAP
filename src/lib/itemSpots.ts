// Item finder, onglet « Où le trouver » : meilleurs spots d'un objet, d'après les points d'apparition au
// sol de tarkov.dev (lootLoose des maps). Points regroupés (même pièce : < 10 m à plat, < 3 m de
// hauteur) ; score d'un groupe = somme, pour chaque point, de 1 / nombre d'objets possibles à ce point
// (un point qui ne propose que 3 objets vaut plus qu'un point qui en propose 50). C'est un ordre
// relatif (densité de points), pas une probabilité : le jeu ne publie pas les chances par point.
// Logique pure, lue telle quelle par Node (scripts/sync-item-spots.mjs).

export interface LooseSpawn {
  map: string;
  x: number;
  y: number;
  z: number;
  items: string[];
}
export interface DoorLock {
  map: string;
  x: number;
  y: number;
  z: number;
  key: string;
}
/** [map (normalizedName), x, y, z, nombre de points, score x 100, clé de la porte la plus proche ou ""] */
export type Spot = [string, number, number, number, number, number, string];

const SAME_ROOM = 10;
const SAME_FLOOR = 3;
const near = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, d: number) => Math.hypot(a.x - b.x, a.z - b.z) < d && Math.abs(a.y - b.y) < SAME_FLOOR;

/**
 * Spots d'un objet, du meilleur au moins bon, 6 au plus : le meilleur de chaque map (on joue une map à
 * la fois) et ceux qui valent au moins la moitié du meilleur ; rien sous 15 % du meilleur.
 */
export function bestSpots(spawns: LooseSpawn[], locks: DoorLock[]): Spot[] {
  const groups: LooseSpawn[][] = [];
  for (const p of spawns) {
    const g = groups.find((g) => g[0].map === p.map && g.some((q) => near(q, p, SAME_ROOM)));
    if (g) g.push(p);
    else groups.push([p]);
  }
  const spots = groups.map((g) => {
    const c = { x: avg(g.map((p) => p.x)), y: avg(g.map((p) => p.y)), z: avg(g.map((p) => p.z)) };
    const score = g.reduce((s, p) => s + 1 / p.items.length, 0);
    const door = locks
      .filter((l) => l.map === g[0].map && near(l, c, SAME_ROOM))
      .sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z))[0];
    return { spot: [g[0].map, Math.round(c.x), Math.round(c.y), Math.round(c.z), g.length, Math.round(score * 100), door?.key ?? ""] as Spot, score };
  });
  spots.sort((a, b) => b.score - a.score);
  const best = spots[0]?.score ?? 0;
  const firstOfMap = new Set<string>();
  return spots
    .filter((s) => {
      const first = !firstOfMap.has(s.spot[0]);
      firstOfMap.add(s.spot[0]);
      return s.score >= best * 0.15 && (first || s.score >= best / 2);
    })
    .slice(0, 6)
    .map((s) => s.spot);
}

const avg = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
