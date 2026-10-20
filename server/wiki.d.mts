import type { IncomingMessage, ServerResponse } from "node:http";

export const LIMITS: Record<string, number>;
export function handleWiki(req: IncomingMessage, res: ServerResponse): boolean;
export function resetWiki(): void;
export function setUpstreamFetch(fn: (url: string, init?: RequestInit) => Promise<Response>): void;
