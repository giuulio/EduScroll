# EduScroll search case study — 31 October 2026

Five topics were tested against the local API using GPT-6.1 Terra, Best match and This week. The public GitHub Pages demo and local browser UI were also opened and inspected. The configured local key successfully generated live posts and explanations; no credentials were included in the report or browser build.

Baseline: `dea7ea351751312e9b1f56e2ef37b8614ec69cbc`. Each table entry is one sequential request with fresh application caches, not a statistical performance benchmark. Source availability and model output varied between runs. “Complete” includes optional figure work; it does not mean the reader waits that long for text.

| Search prompt | First post before → after | Complete before → after | Posts before → after | Main finding |
| --- | --- | --- | --- | --- |
| large language model hallucinations | 17.7 → 10.1 s | 26.7 → 23.7 s | 10 → 10 | Broad word overlap diluted the feed with general medical and language-model applications. The revised selection focuses on unsupported answers, factual errors and their detection. |
| nanotech for pacemakers | 14.3 → 14.8 s | 14.3 → 28.3 s | 3 → 7 | General cardiovascular reviews suppressed date expansion. The revised feed explicitly widens the dates and includes heartbeat-powered pacemakers and relevant enabling work. |
| perovskite solar cells | 13.3 → 13.6 s | 17.9 → 27.0 s | 7 → 10 | Records without abstracts occupied page slots. Posts now explain efficiency and test conditions more clearly; illustrations depict solar cells rather than anonymous layers. |
| quantum error correction | 10.9 → 9.7 s | 18.3 → 33.3 s | 10 → 10 | Eight baseline items were generic repository deposits, including a repetitive series making sweeping claims. The revised feed omits these deposits and includes research articles and explicitly labelled preprints. |
| Roman concrete | 14.7 → 13.3 s | 22.7 → 23.8 s | 10 → 10 | The baseline mixed Roman history, French literary uses of “roman”, Raman physics and modern concrete. The revised feed contains research about Roman concrete and its durability. |

Mean first-post latency fell from **14.19 to 12.29 seconds (13.3%)**; the median fell from 14.27 to 13.30 seconds. Full completion increased from 19.98 to 27.22 seconds on average. The revised runs returned 47 posts rather than 40, performed an explicit intent check, and selected more relevant source figures. This is a quality/latency tradeoff, not an across-the-board speedup.

## Root causes and changes

1. **Candidate acceptance was too permissive.** Semantic source search can return nearby subjects; matching words can also have different meanings or occur only in background. A bounded Terra selection now checks the complete research intent before pagination and date expansion. Unknown output IDs are rejected. Empty abstracts and non-paper records are removed early. Related words remain grouped as concepts, including “large language model” and nanogenerator synonyms.
2. **A DOI was insufficient provenance.** OpenAlex indexes repository deposits as well as scholarly publications, sometimes labelling a deposit an article. Discovery now omits generic repository deposits and non-paper types while retaining journals, conferences and recognised preprint archives. This is a provenance filter, not a judgment that every retained claim is true or peer reviewed.
3. **The first post waited for three generated cards.** The first ranked post now has its own batch. Two workers retain ranked streaming order. Discovery notices arrive before generation finishes. A separate `posts-ready` event enables pagination while optional figures continue patching existing cards; the reader no longer waits for the final image to continue.
4. **Short posts retained unnecessary specialist names.** Writing instructions now prioritize the result and setting, omit unnecessary model IDs and benchmark names, and explain useful metrics in everyday terms. Exact supporting excerpts and numerical validation remain in place. The overview shows one finding initially, with additional findings expandable.
5. **Images were not consistently tied to the post.** Figure selection previously used the raw abstract before the written post existed. It now receives the actual post and must explicitly confirm that the figure supports its central mechanism or result. Crop reinspection and original-image provenance remain. Concept layouts retain every supplied label; solar and cardiac energy-flow schematics replace unsuitable stock shapes. Concept diagrams remain explicitly labelled, with no invented measurements.
6. **Cold explanation lookup was broken for Europe PMC.** Quoting `EXT_ID` returned zero results for existing identifiers. Removing those quotes fixes reopening a paper on a fresh server or Worker instance. A regression test covers this independently of a preceding feed request. An arXiv lookup also encountered a transient HTTP 503; a subsequent request succeeded without a code workaround.

## Content and image review

The revised Roman-concrete overview distinguishes mineral deposition in ancient concrete, self-healing tests on modern mixtures, and an environmental assessment that does **not** promise large emissions savings. The pacemaker post retains its animal-test setting rather than implying clinical readiness. Solar-cell posts retain thermal cycling versus dark-storage conditions and distinguish retained efficiency from absolute light-to-electricity efficiency. Quantum posts identify proposals and simulations as such.

Selected source examples: [heartbeat-powered leadless pacemaker](https://europepmc.org/article/MED/42616885), [solar-cell heat testing](https://europepmc.org/article/MED/42963917), [Roman-concrete minerals](https://europepmc.org/article/MED/42418584), [quantum decoder power signatures](https://doi.org/10.1145/3857307.3857309), [medical image hallucination detection](https://arxiv.org/abs/2610.38389v1).

The baseline displayed 3 original figures, 31 concept illustrations and 6 text-only cards. The revised sample displayed **6 original figures, 22 concepts and 19 text-only cards**. Less decorative imagery is intentional: an unrelated or unreadable image is not evidence. Original pacemaker and quantum figures retain source links, captions and reversible crops. Browser review checked the updated feed, concept labels, original crops, full-figure controls and explanation evidence labels.

## Expanded explanations

One first-ranked paper per topic was reopened after restarting the API, exercising cold metadata lookup. After fixing Europe PMC:

| Topic | Latency | Evidence used |
| --- | --- | --- |
| Language-model hallucinations | 19.33 s | arXiv full text; actual source sections identified |
| Pacemakers | 3.09 s | Abstract, explicitly labelled |
| Solar cells | 2.91 s | Abstract, explicitly labelled |
| Quantum error correction | 3.14 s | Abstract; conceptual synthesis described as such |
| Roman concrete | 2.89 s | Abstract, explicitly labelled |

## Remaining limits

This five-case sample does not establish scientific accuracy across topics. Exact quotations and numerical checks cannot fully verify paraphrase entailment. Some theoretical quantum posts still require specialist knowledge, and enabling-work selection can remain broader than the core device query. Generic-repository exclusion also reduces recall for legitimate manuscripts deposited only there.

Original figures remain unavailable for many papers; recent solar-cell and Roman-concrete results often use concepts or text alone. External source delays and outages remain visible constraints. Cold arXiv full-text explanations can be much slower than abstract explanations. Provider, token and monetary costs were not instrumented, so this study makes no cost claim.

Automated coverage includes topic grouping, ambiguous keyword acceptance, pre-pagination screening and date expansion, provenance, missing abstracts, cold lookups, ranked first-card streaming, early pagination, cancellation, post-aware source figure selection, crop validation, label retention, and credential boundaries. Required checks: `npm test`, `npm run build`, and hosted Worker validation with `npm run build:api`.
