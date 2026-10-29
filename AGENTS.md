# EduScroll contributor instructions

- Keep OpenAI inference server-side. The public build supports a default demo and explicit hosted bring-your-own-key mode. Never bundle an owner key, persist visitor keys, or expose the local server unchanged.
- Use gpt-6.1-terra for all model calls unless the user explicitly changes it.
- Never read out, log, stage, commit, or push API keys or .env files.
- Use Luma's UI references and Reicon icons; use sans-serif type and concise copy.
- Push immediately after every commit, as requested by the user.
- Run npm test and npm run build before committing functional changes.
