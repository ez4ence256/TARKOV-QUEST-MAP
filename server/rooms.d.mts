import type { IncomingMessage, ServerResponse } from "node:http";

export const PROTOCOL: number;
export const LIMITS: Record<string, number>;
export const MODES: string[];
export const DEFAULT_NAME: string;
export function handleRooms(req: IncomingMessage, res: ServerResponse): boolean;
export function resetRooms(): void;
export function roomCount(): number;
export function cleanName(raw: unknown): string | null;
export function validateSnapshot(snapshot: unknown): Record<string, unknown> | null;
