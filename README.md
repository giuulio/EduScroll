# EduScroll

Fresh research, a little easier to scroll.

**[Public demo](https://giuulio.github.io/EduScroll/)** · React + TypeScript · GPT-6.1 Terra · arXiv

Choose a topic, scroll through ten plain-English research cards, and open a paper for a deeper explanation. Bookmark discoveries, share original publications, and request another batch without repeats.

The public GitHub Pages site serves a clearly labelled, curated demo collection of 20 real arXiv papers from 27 October 2026. **It cannot call your local inference server or spend your OpenAI credits.** Live generation runs only on your computer.

## Run locally

Requires Node.js 22 or newer.

```sh
cd ~/Developer/EduScroll
npm ci
cp -n .env.example .env
```

Edit `.env` and add your EduScroll project's OpenAI key:

```dotenv
OPENAI_API_KEY=your-project-key-here
OPENAI_MODEL=gpt-6.1-terra
```

Then:

```sh
npm run dev
```

Open **http://127.0.0.1:5173**. The UI detects whether the local API has a key. Once configured, searching a topic generates live cards. Restart the dev command after changing `.env`.

Do not put the key in frontend code, a `VITE_` variable, GitHub Actions, or GitHub Pages. `.env` and all `.env.*` files except the empty example are ignored by Git. Do not paste a key into the app or a chat.

## Information flow

1. A topic and date range become a constrained arXiv API query.
2. The server retrieves up to ten recent papers, using their original submission dates rather than version-update dates.
3. HTML figures and captions are retrieved for the first three papers where available.
4. GPT-6.1 Terra turns abstracts and supplied captions into schema-validated cards. Cards use original metadata and source links.
5. Opening a card fetches article text beyond the abstract. If HTML is unavailable, a PDF up to 12 MB is provided to the same model. The resulting explainer is cached.
6. Another batch advances the source cursor and deduplicates paper versions. Fewer than ten cards are shown when fewer results exist; papers are never invented to fill a quota.

## Private by default

- The API binds to **127.0.0.1**, not the LAN or public internet.
- Requests from non-local browser origins and unexpected hostnames are rejected before any inference.
- The public production build always uses demo data. It has no backend URL or OpenAI key.
- OpenAI is called server-side with `store: false`.
- Rate limits, three-request concurrency limits, six-hour in-memory caches, and arXiv request spacing constrain prototype usage.
- Bookmarks stay in browser local storage. There are no accounts, analytics, or database.
- Optional `API_ACCESS_TOKEN` can add another local gate. If set, provide it in this browser's session storage as `eduscroll-token`; this is **not** the OpenAI key.

This is a local prototype, not a hardened multi-user inference service. Do not tunnel or expose the server publicly.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local React frontend + private API |
| `npm run dev:ui` | Frontend only; demo mode when API is absent |
| `npm start` | API only |
| `npm test` | Source parsing, date handling, figure extraction, local-only access checks |
| `npm run build` | Type-check and build the static frontend |

## GitHub Pages

Pushes to `main` run `.github/workflows/pages.yml`: install, tests, production build, deploy. Repository Settings → Pages uses **GitHub Actions**. The site is served at `/EduScroll/`; relative asset paths support that project path. No API key or secret is needed for deployment.

## Scope and limitations

- Initial live source: arXiv. Google Scholar has no bulk-access API and is not scraped.
- “Today” uses UTC calendar dates. Publication labels on arXiv mean preprint submission, not journal publication.
- Abstract-based cards and full-text explainers are labelled separately. Demo explanations are explicitly abstract-only.
- Full-text HTML is bounded to the first 90,000 extracted characters. Figure choices use source captions, and the original image is shown unchanged.
- Some papers have no usable figures or HTML. Full-text failures show an error and link to the original; they never silently masquerade as full-paper explanations.
- AI can miss nuance. Preprints may not be peer reviewed. Check the original publication.
- Public demo date filters are disabled because its sample collection is fixed.

## Design and attribution

Interaction structure follows a social feed. UI references: [Luma style guide](https://luma.com/style-guide). Sans-serif type, concise posts, understated controls. Icons: [Reicon](https://reicon.dev/), MIT licensed. Papers, metadata and credited figures remain their authors' work; see each original publication for its licence. The demo figure links directly to its arXiv source.
