# JobLens

AI-powered job compatibility checks for Chrome and Microsoft Edge. Open a job listing, run a check against your profile and preferences, and get a scored report using **your own** OpenAI, Anthropic, or Google Gemini API key (BYOK).

## Features

- One-click **Check Job Compatibility** with category scores and details
- Structured profile (skills, experience, projects, education, certifications) and checkbox preferences
- Optional **Fill from resume** (PDF → review before saving)
- Local pre-checks for clear mismatches (e.g. pay / remote work) before spending an AI request
- History of past checks; open full reports in a dedicated tab
- Best extraction on Indeed and GovernmentJobs; partial support for ZipRecruiter and LinkedIn; on-demand fallback on other sites when you run a check

JobLens is not affiliated with or endorsed by Indeed, GovernmentJobs, ZipRecruiter, or LinkedIn.

## Privacy

Compatibility checks and resume extraction send your profile, preferences, and job listing or resume text to the AI provider you select. You must acknowledge this before those actions. Keys and profile data stay in `chrome.storage.local` on your device.

- Policy (markdown): [docs/privacy.md](docs/privacy.md)
- Policy (HTML page): [privacy.html](https://maattox.github.io/JobLens/privacy.html)

## Project structure

```
src/
  background/     # Service worker, AI clients, check pipeline
  content/        # Content script + site extractors
  popup/          # React popup UI
  app/            # Dedicated extension tab UI
  report/         # Read-only report page for new-tab viewing
  shared/         # Types, schema, pre-check, formatting, migration
  styles/         # Design tokens
docs/             # Public site + privacy policy
```

## License

[MIT](LICENSE)
