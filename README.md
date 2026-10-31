# EduScroll

**[Open EduScroll](https://giuulio.github.io/EduScroll/)** · [Research API](https://eduscroll-research-api.sageorbit65.chatgpt.site/) · React + TypeScript

Search a research topic, scroll through short evidence-backed posts, and open the original publication or an explanation. Bookmark papers in your browser and share their source links.

## Public demo and live research

The public site works without a download:

- **Browse the demo:** 20 real arXiv papers from 27 October 2026, with manually reviewed posts, supporting quotations, original figures and varied conceptual illustrations. Date filters use the papers' actual dates. Empty periods show an explicit wider-date notice.
- **Use your OpenAI key:** connect a project key in the site to search arXiv, Europe PMC and OpenAlex and generate live posts. GPT-6.1 Terra is the default. GPT-6 Luna is an explicit lower-cost experimental option; no automatic model switch occurs.

Visitor keys are kept in tab memory, sent over HTTPS to the hosted EduScroll API and then OpenAI, and never saved to browser storage or the API's caches or logs. Disconnect or reload to clear the key. You must trust the hosted service to handle the key temporarily. Generation is charged to your OpenAI account; a key is checked for model access before connection. The public service has no owner inference key and cannot spend the repository owner's credits.

The [five-topic case study](CASE_STUDY.md) records measured latency, content/image findings and resulting fixes. The [commit plan](COMMIT_PLAN.md) records the implementation sequence and acceptance checks. Editorial contracts live in [content/](content/).

## Discovery and content

- Free-form searches retain subject concepts and group synonyms; fuzzy matching handles common spelling errors. The source APIs supply real metadata and abstracts. A bounded model check screens for the complete research intent before pagination and date expansion. Empty abstracts, non-paper records and generic repository deposits are omitted; identifiable scholarly sources and recognised preprint archives remain.
- Today, this week (Monday onward), and this month use UTC calendar dates. Publication dates are original source dates, not retrieval or revision times.
- If a selected period has no matches, the feed explicitly labels related papers from all dates. A source outage produces partial results and a notice.
- Best match combines relevance, modest freshness and source diversity. Latest sorts by publication date. DOI, title and arXiv-version deduplication prevents repeat works.
- Feed text uses abstracts, exact supporting passages and conservative numerical checks. Original research is rewritten from the research team’s perspective and labelled as an AI rewrite; reviews cannot claim the experiments they cite. Unverifiable generated claims fall back to a labelled source excerpt. Papers without a usable abstract are skipped.
- After discovery and topic screening, an immediate source briefing appears with citations. The first ranked post is generated alone, followed by batches on two text workers. Text cards stream in ranking order, and pagination becomes available as soon as posts are ready. Two figure workers select against the actual written post and patch existing cards as they become ready, including bookmarks and open explanations. Stopping or replacing a search cancels pending work.
- The figure worker retrieves original arXiv images and open-access PMC media, including biomedical papers discovered through Europe PMC or DOI lookup. Vision chooses a readable whole figure or a self-contained panel crop. A second check rejects crops that lose axes, units, legends, controls or scale bars. The original bitmap stays unchanged; Full figure and Source controls expose the uncropped context and original caption. Crops retain attribution and licence information. Concept illustrations remain a fallback, and figures that cannot be made readable are omitted.
- Opening a paper retrieves arXiv full text or a bounded PDF on demand. Other sources currently use their abstract. The explanation always labels its evidence basis; unavailable full text never masquerades as a full-paper reading.

Preprints and research articles are labelled by their source. An AI explanation can miss nuance: consult the original publication.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. You can enter a key through the UI. Alternatively configure `OPENAI_API_KEY` and optional `OPENAI_MODEL` in your local server environment and restart the API. Local configuration may use an ignored `.env` file. Never put a key in a `VITE_` variable, tracked source, workflow, URL, or chat.

The local API binds only to 127.0.0.1 and rejects public hosts/origins. Optional `API_ACCESS_TOKEN` is entered in local connection settings and sent as `X-EduScroll-Access-Token`; it also stays in memory. The public Worker uses a separate hosted mode that requires a visitor key on every inference request.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Frontend and loopback-only API |
| `npm run dev:ui` | Frontend preview |
| `npm start` | Loopback-only API |
| `npm test` | Offline parsing, discovery, evidence, streaming and security tests |
| `npm run build` | Type-check and build the GitHub Pages frontend |
| `npm run build:api` | Bundle and validate the hosted Worker; replaces `dist/` |
| `npm run benchmark:models -- --help` | Show opt-in benchmark usage without model requests |

`benchmark:models` requires explicit `--run` and reads a key only from the process environment. The default is Terra; comparing Luna requires `--models=gpt-6.1-terra,gpt-6-luna`. It records latency, tokens, estimated cost and manual quality fields. Benchmark reports default to the system temporary directory. Pricing is dated, and measured quality requires human review.

Manual demo refresh scripts are local tools and never run in public deployment workflows.

## Hosting and privacy boundaries

Pushes to `main` run tests and build/deploy the static frontend through `.github/workflows/pages.yml`. The only frontend service configuration is a public HTTPS address in `src/hosting.ts`.

The Sites-hosted API is a standard Web Request/Response Worker from `worker/index.ts`, using the same service code as the local adapter. `.openai/hosting.json` identifies that service. Build and package the API after building the frontend; its deployment artifact is `dist/server/index.js`. No inference secret is configured on the public service.

The API accepts only bounded research, explanation and connection operations, restricted models, JSON bodies and approved browser origins. It enforces per-key/per-IP limits, request deadlines and cancellation, and redacts provider error details. Caches hold only public paper metadata/content and model/protocol versions; keys and personalised instructions are excluded. Caches and counters are bounded, temporary and isolate-local, so warm-cache performance is not guaranteed across Worker instances. Pagination recovers from expired or relocated snapshots using excluded paper IDs.

There are no accounts, analytics or private document uploads. Bookmarks alone use local storage. Source/API providers and the hosting platform process requests under their own policies. The service is a small prototype, not a key vault.

## Design and attribution

UI references: [Luma](https://luma.com/style-guide). Icons: [Reicon](https://reicon.dev/), MIT licensed. The interface uses system sans-serif type, capsule controls and a wide social feed with a left navigation rail. Light and dark appearance follow the system setting automatically, including changes while the page is open. The [visual-planning proposal](content/visual-planning-proposal.md) describes a feed-level replacement for repeated stock diagrams; it is proposed work, not the current renderer. Papers and credited source figures remain their authors' work; consult original publications for licences. Conceptual SVG illustrations use bounded layouts and escaped labels, without fabricated data plots.
