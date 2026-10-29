# Editorial protocol · author voice

The feed is a labelled AI rewrite in the research team's point of view. Write a tweet the team could use to explain its supported finding: direct, specific and concise. It is not a post published by an author, and must not suggest that EduScroll performed the research.

Use first-person plural when it clarifies the work: “We tested…”, “We built…”, “We found…”, “Our device…”. A result can lead without a pronoun when that sounds more natural. Vary the opening; do not make every card begin “We”. The post stands alone in 1–2 sentences, normally 20–40 words and no more than 280 characters.

Match the voice to the evidence:

- Original research: “We cut reconstruction error by 28.9% across 15 test scans, using the same memory as the comparison method.”
- Review: “We reviewed conductive materials for heart rhythm. Promising lab results still face a gap in larger-animal safety tests.” Use this only when the source supports that synthesis; do not imply the reviewers conducted the experiments.
- Proposal: “We propose…” preserves that the device or mechanism is not yet a demonstrated result.
- Mechanism or theoretical result: lead with the concrete relationship or counterexample, without forcing personal language.

Never use reportorial wrappers such as “The article describes”, “This paper discusses”, “The study found”, or “According to this review”. Do not fill a post with “the abstract does not report a result”. Select a different supported fact. No obligatory punchline, speculative application, or “why it matters” slogan.

Use everyday words. Explain unfamiliar measures, or choose a more understandable detail. Preserve units, the comparison and the condition that makes a claim true. Keep simulation, lab, animal, patient-cohort and clinical-trial findings distinct. A device tested in pigs must not sound ready for human implantation.

Select exact supporting quotations before writing. The live numerical guard requires exact numerical values from those quotations; dimension terms such as “3D” are descriptions, not new measured results. A manually reviewed demo may use sensible rounding with “about”, but the live path should retain the source's numerals. Never turn percent into percentage points, a benchmark metric into a success rate, or a relative improvement into an absolute one.

No markdown, hashtags, emojis, title repetition, hype, or filler such as “a breakthrough”, “the future of”, “a little curiosity”, and “your next rabbit hole”. Headline: 5–9 simple words for the expanded view. Tags: 1–2 plain topics. The internal `whyItMatters` field is one grounded sentence, not extra feed copy.

Figures are selected independently of text. The text task may supply a meaningful subject illustration as an immediate fallback, but its visual preference must not suppress a verified source figure arriving later. Use text-only only when no meaningful visual is supported.

If validation fails, publish a clearly labelled source excerpt without inventing a first-person rewrite. Prefer a direct result sentence over a reportorial introduction when both are available. Do not silently label an unchanged excerpt as an author-voice rewrite.

Review a mixed sample for claim accuracy, useful specificity, readability, hook variety, and a preserved comparison/setting. Length and exact quotes alone are insufficient. `editorialVersion` in `server/editorial.ts` invalidates cached posts when these rules change.
