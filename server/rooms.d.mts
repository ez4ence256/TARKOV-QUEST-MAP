import type { IncomingMessage, ServerResponse } from "node:http";

export const LIMITS: Record<string, number>;
export const MODES: string[];
export function handleRooms(req: IncomingMessage, res: ServerResponse): boolean;
export function resetRooms(): void;
export function roomCount(): number;
export function validateOps(ops: unknown): { kind: string; id: string; on: boolean }[] | null;
export function validateState(state: unknown): Record<string, Set<string>> | null;
