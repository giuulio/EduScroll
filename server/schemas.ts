import {z} from 'zod';
export const illustrationSchema = z.object({
  layout:z.enum(['pipeline','network','layers','orbit']),
  labels:z.array(z.string().max(16)).min(3).max(3),
  accent:z.enum(['purple','blue','green','orange','pink']),
  caption:z.string(),
});
