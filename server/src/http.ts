import type { Response } from 'express';

export const ok = (res: Response, data: unknown) => res.json({ data });

