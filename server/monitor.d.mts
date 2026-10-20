import type { IncomingMessage, ServerResponse } from "node:http";

export const LIMITS: Record<string, number>;
export function handleMonitor(req: IncomingMessage, res: ServerResponse): boolean;
export function resetMonitor(): void;
export function validateEvent(body: unknown): Record<string, unknown> | null;
