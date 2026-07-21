import { defineManifest } from "@crxjs/vite-plugin";
import packageJson from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: "JobLens",
  short_name: "JobLens",
  version: packageJson.version,
  description:
    "AI-powered job compatibility check using your profile, preferences, resume, and your own API key.",
  icons: {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
  permissions: ["activeTab", "scripting", "storage"],
  host_permissions: [
    "*://*.governmentjobs.com/*",
    "*://*.indeed.com/*",
    "*://*.ziprecruiter.com/*",
    "*://*.linkedin.com/*",
    "https://api.openai.com/*",
    "https://api.anthropic.com/*",
    "https://generativelanguage.googleapis.com/*",
  ],
  action: {
    default_popup: "src/popup/index.html",
    default_title: "JobLens",
    default_icon: {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: [
        "*://*.governmentjobs.com/*",
        "*://*.indeed.com/*",
        "*://*.ziprecruiter.com/*",
        "*://*.linkedin.com/*",
      ],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
});
