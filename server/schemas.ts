import {z} from 'zod';
export const illustrationSchema = z.object({
  layout:z.enum(['pipeline','network','layers','orbit','comparison','hexagons','robot','sound','roads','video','device','documents','motion']),
  labels:z.array(z.string().max(16)).min(1).max(3),
  accent:z.enum(['purple','blue','green','orange','pink']),
  caption:z.string(),
});
