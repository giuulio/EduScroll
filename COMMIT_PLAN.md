# EduScroll improvement commit plan

Approved scope: keep the public demo, add hosted bring-your-own-key live research, reduce waiting, improve discovery and editorial quality, and replace filler and rectangular controls.

Each functional commit must pass `npm test` and `npm run build`, then be pushed immediately. Never stage or print credentials or environment files. GPT-6.1 Terra remains the default; Luna is opt-in for evaluation.

1. **docs: record delivery plan and hosted BYOK policy**
   Update contributor guidance for public server-side BYOK. Record architecture, sequence and acceptance checks.
2. **feat: add multi-source discovery with calendar filters and relevance ranking**
   Add explicit UTC date ranges, concept-aware search, arXiv/Europe PMC/OpenAlex adapters, stable deduplication, best-match/latest sorting, and visibly labelled wider-date fallback.
3. **feat: stream evidence-led posts through a hosted-ready BYOK API**
   Add request-scoped credentials, safe errors and cancellation, progressive cards, reusable public-paper caches, on-demand detail, versioned editorial protocols, and optional Luna evaluation.
4. **feat: add capsule controls and a session-only hosted connection flow**
   Simplify copy, enable real filters and sorting, consume progressive results, display sources and fallback dates, keep keys in memory, and preserve bookmarks.
5. **feat: refresh the demo with concrete findings and varied visuals**
   Review all demo posts against their abstracts; diversify conceptual visuals without invented data; support text-only cards and preserve readable originals.
6. **deploy: publish the BYOK API and verify the public experience**
   Deploy a credential-free API service, configure the public frontend, update setup/privacy docs, verify mobile/desktop and demo/live/error paths, and record measured performance and deployment results.

## Acceptance checks

- Demo works without credentials or backend availability and labels its collection dates honestly.
- Browser session key is never persisted, returned, logged, or included in URLs; disconnect clears it. Hosted API accepts only bounded research operations and does not fall back to an owner key.
- Date boundaries, sparse results, concept queries, duplicate versions, pagination, source outages, and cross-session isolation have deterministic tests.
- Text arrives before optional figures; cancelled searches do not update the UI or continue avoidable provider work.
- Every numerical demo claim is supported by its supplied abstract. No fabricated chart values or unlabelled conceptual art.
- Targets to measure: cached feed under one second; first cold live card in 5–10 seconds under normal provider conditions. Report actual verification limits.
