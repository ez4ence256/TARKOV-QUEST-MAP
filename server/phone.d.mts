import type { IncomingMessage, ServerResponse } from "node:http";

export const LIMITS: Record<string, number>;
export function handlePhone(req: IncomingMessage, res: ServerResponse): boolean;
export function resetPhone(): void;
export function ageSession(code: string, ms: number): void;
export function looksLikeImage(buf: Buffer): boolean;
