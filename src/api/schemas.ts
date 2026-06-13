import { z } from 'zod';

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const SuggestQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;
export type SuggestQueryInput = z.infer<typeof SuggestQuerySchema>;
