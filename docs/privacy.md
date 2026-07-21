# Privacy Policy for JobLens

Last updated: 2026-07-21

JobLens is a browser extension that helps you evaluate how well a job listing matches your profile and preferences using an AI provider API key that you provide (bring your own key).

## What Data We Collect

JobLens collects and stores the following information **on your device only** (via Chrome’s local extension storage):

| Data | Purpose |
|------|---------|
| Profile (skills, work experience, projects, education, certifications, optional notes, optional resume text extracted from a PDF you upload) | Compatibility checks and resume-assisted profile fill |
| Job preferences (minimum pay, commute, remote work, schedule, job type) | Local pre-checks and compatibility analysis |
| AI settings (provider choice, model name, API key, and any models you add manually) | Sending requests you initiate to your chosen AI provider |
| Extracted job listing data from pages you check | Running checks and showing results |
| Compatibility reports and follow-up Q&A history | Showing past results in History |
| Privacy acknowledgment and onboarding flags | Remembering that you accepted the in-product notice and completed or skipped setup |

JobLens does **not** run analytics, advertising, or remote telemetry. Developer-only debug tools (when enabled in local builds) stay on your device and are not included in store releases.

## How Data Is Stored

- All of the data above is stored locally using `chrome.storage.local`.
- JobLens does **not** use `chrome.storage.sync`.
- JobLens does **not** operate its own backend server that receives your profile, resume, job listings, or API keys.

## How Data Is Used

Data is used only to provide JobLens’s single purpose: checking job listing compatibility with your profile and preferences, including related features such as resume-assisted profile fill, local history, and optional follow-up questions about a saved report.

## Data Sent Off Your Device

When **you** start one of these actions, JobLens sends relevant data over HTTPS to the AI provider **you** selected:

1. **Compatibility check** — profile, preferences, and job listing text/metadata from the active tab
2. **Fill from resume** — resume text extracted locally from a PDF you choose
3. **Follow-up questions** on a saved report — conversation context needed to answer your question
4. **Model list refresh** (Settings) — your API key, only to list available models from that provider

Supported providers (you choose one):

- [OpenAI](https://openai.com/privacy/) (`api.openai.com`)
- [Anthropic](https://www.anthropic.com/privacy) (`api.anthropic.com`)
- [Google Gemini](https://policies.google.com/privacy) (`generativelanguage.googleapis.com`)

Your API key is included only in requests to the provider you configured. JobLens does not send your data to any other third party for advertising, brokerage, credit decisions, or unrelated analytics.

Before the first compatibility check or resume extraction, JobLens shows an in-product notice and requires your acknowledgment.

## Website Content Access

On supported job sites (GovernmentJobs, Indeed, ZipRecruiter, LinkedIn), JobLens may inject a content script that stays idle until you run a check. On other sites, when you click **Check Job Compatibility**, JobLens may temporarily read the active tab (with your gesture) to extract listing text. Page content is used only for that user-initiated feature.

## Data Sharing

- JobLens does **not** sell user data.
- JobLens does **not** share data with advertising platforms, data brokers, or information resellers.
- The only off-device recipients are the AI provider you choose, solely to perform the request you started.

## Limited Use

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

More generally, JobLens limits use of user data to providing or improving its disclosed single purpose (job compatibility checking and related on-device features). JobLens does not use or transfer user data for personalized ads, sale to data brokers, or creditworthiness/lending purposes.

## Data Retention and Deletion

- Data remains on your device until you clear it or uninstall the extension.
- Uninstalling JobLens removes its local extension storage.
- You can change or overwrite profile, preferences, API key, and history from within the extension UI.

## Children’s Privacy

JobLens is not directed at children and is intended for adults evaluating employment opportunities.

## Changes to This Policy

If JobLens’s data practices change, this policy will be updated and the “Last updated” date revised. Material changes will also be reflected in the Chrome Web Store privacy disclosures and, when appropriate, in the in-product notice.

## Contact

Privacy questions: **joblenscontact@gmail.com**
