# Editorial protocol · v1

Write like someone sharing a specific finding they want a friend to see. The feed post stands alone in 1–2 sentences, normally 20–40 words and no more than 280 characters.

Choose a hook from the evidence:

- Result: “Success rose from 33% to 75% across three real-robot tasks.”
- Scale: “1,150 examples. 64 editing tasks. A phone-image benchmark goes beyond one overall score.”
- Failure: “A robot can open a drawer and still make the wrong movement.”
- Mechanism: “Human videos teach a robot which movements connect the scene now to what happens next.”
- Contrast: describe a supported comparison in ordinary language, including the relevant baseline.

These are patterns, not fixed templates. Vary the opening across a feed. A question must lead to a specific answer supported by the source. Do not add an obligatory punchline, speculative application, or “why it matters” slogan.

Use everyday words. Explain unfamiliar measures, or choose a more understandable detail. Preserve the condition that makes a claim true. In medical stories, distinguish synthetic data, patient cohorts, and clinical trials. Do not imply patient benefit or deployment readiness from a model benchmark.

Example from the bundled surface-reconstruction abstract:

> Rebuilding 3D surfaces with hexagon-shaped pieces cut error by about 29% across 15 test scans. The comparison method used the same amount of memory.

The original says 28.9% lower reconstruction error on 15 scans against a memory-matched baseline. Do not replace that with “29% faster,” “29% better images,” or a claim about real-world deployment.

No markdown, hashtags, emojis, title repetition, hype, or filler such as “a breakthrough,” “the future of,” “a little curiosity,” and “your next rabbit hole.” Headline: 5–9 simple words for the expanded view. Tags: 1–2 plain topics. The internal `whyItMatters` field is one grounded sentence, not extra feed copy.

Review a mixed sample for claim accuracy, useful specificity, readability, hook variety, and a preserved comparison/setting. The model benchmark includes fields for this human review; length and exact quotes alone are insufficient.
