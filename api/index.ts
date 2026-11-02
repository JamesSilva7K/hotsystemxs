import type { IncomingMessage, ServerResponse } from 'node:http';
import { prepare } from '../server/app.js';

/**
 * Entrada serverless da Vercel.
 * O mesmo app Express atende /api/*; o frontend é servido pelo CDN da Vercel.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await prepare();
  (app as unknown as (request: IncomingMessage, response: ServerResponse) => void)(req, res);
}
