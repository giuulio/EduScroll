import {z} from 'zod';
import {illustrationLayouts} from '../src/visuals';
export const illustrationSchema = z.object({
  layout:z.enum(illustrationLayouts),
  labels:z.array(z.string().max(16)).min(1).max(3),
  accent:z.enum(['purple','blue','green','orange','pink']),
  caption:z.string(),
});
