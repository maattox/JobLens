# JobLens

AI-powered job compatibility checks for Chrome and Microsoft Edge. Open a job listing, run a check against your profile and preferences, and get a scored report using **your own** OpenAI, Anthropic, or Google Gemini API key (BYOK).

## Install

Chrome and Edge load a **folder**, so download the release zip, unzip it, then point **Load unpacked** at that folder.

1. Open the [latest Release](https://github.com/maattox/JobLens/releases/latest)
2. Download the `joblens-v*.zip` asset
3. Unzip it to a folder you will keep (Chrome reads from that path)
4. In Chrome open `chrome://extensions` (or Edge: `edge://extensions`)
5. Turn on **Developer mode** → **Load unpacked** → select the unzipped folder (it should contain `manifest.json`)
6. Pin JobLens, add an API key in Settings, then run a check on a full job listing tab

When a new release is published, download the new zip, replace the old folder (or load the new one), and click **Reload** on the extension card if you updated in place.

## Features

- One-click **Check Job Compatibility** with category scores and details
- Structured profile (skills, experience, projects, education, certifications) and checkbox preferences
- Optional **Fill from resume** (PDF → review before saving)
- Local pre-checks for clear mismatches (e.g. pay / remote work) before spending an AI request
- History of past checks; open full reports in a dedicated tab
- Reopening JobLens on a listing you already checked shows that saved report without a new AI request
- Best extraction on Indeed and GovernmentJobs; partial support for ZipRecruiter and LinkedIn; on-demand fallback on other sites when you run a check

JobLens is not affiliated with or endorsed by Indeed, GovernmentJobs, ZipRecruiter, or LinkedIn.

## Privacy

Compatibility checks and resume extraction send your profile, preferences, and job listing or resume text to the AI provider you select. You must acknowledge this before those actions. Keys and profile data stay in `chrome.storage.local` on your device.

- Policy (HTML page): [privacy.html](https://maattox.github.io/JobLens/privacy.html)
- Project site: [https://maattox.github.io/JobLens/](https://maattox.github.io/JobLens/)

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
scripts/          # Build helpers (store zip, sync AI models)
```

## License

[MIT](LICENSE)
