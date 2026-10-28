import {z} from 'zod';
export const illustrationSchema = z.object({
  layout:z.enum(['pipeline','network','layers','comparison','orbit']),
  labels:z.array(z.string()),
  accent:z.enum(['purple','blue','green','orange','pink']),
  caption:z.string(),
});
