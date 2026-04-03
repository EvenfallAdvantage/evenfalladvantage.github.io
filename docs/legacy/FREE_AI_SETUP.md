# AI Question Generator Setup

> **UPDATED April 2026:** The AI question generator has been completely rewritten to support multiple providers. API keys are now stored in the browser's localStorage — **never hardcoded in source files**.

## How It Works

The admin dashboard (`/admin/`) includes an AI-powered assessment question generator. When an admin clicks "Generate Questions" for a training module, the system:

1. Extracts text content from the module's slides
2. Sends a structured prompt to the selected AI provider
3. Parses the returned JSON into multiple-choice questions
4. Saves them to the `assessment_questions` table
5. Falls back to a local template-based generator if the API call fails

## Supported Providers

| Provider | API Style | Free Tier? |
|----------|-----------|------------|
| Google Gemini | Custom REST | Yes (60 req/min) |
| OpenAI | OpenAI-compatible | No |
| Anthropic (Claude) | Custom REST | No (may have CORS issues from browser) |
| Groq | OpenAI-compatible | Yes (generous) |
| OpenRouter | OpenAI-compatible | Some free models |
| Mistral | OpenAI-compatible | Yes (limited) |
| Together AI | OpenAI-compatible | Yes (limited) |
| Ollama (Local) | OpenAI-compatible | Free (self-hosted) |
| Custom | OpenAI-compatible | User-defined |

## Setup

1. Open the admin dashboard at `/admin/`
2. Navigate to a course and click "Generate Questions"
3. On first use, a **Settings panel** appears
4. Select your provider, paste your API key, choose a model
5. Click "Save & Generate"
6. Settings are saved in `localStorage` under the key `ea_ai_provider_config`

No code changes or file edits are needed. The API key never leaves your browser.

## Recommended Free Options

**Google Gemini** — Create a key at https://makersuite.google.com/app/apikey. Select model `gemini-2.0-flash`. 60 requests/minute, completely free.

**Groq** — Sign up at https://console.groq.com. Select model `llama-3.3-70b-versatile`. Very fast inference, generous free tier.

**OpenRouter** — Sign up at https://openrouter.ai. Some models are free (e.g., `meta-llama/llama-3.3-70b-instruct`).

## Security

- API keys are stored in `localStorage` only — never in source code, never sent to your server
- Keys are scoped to the admin's browser — switching browsers requires re-entering the key
- The old approach of hardcoding API keys in `ai-question-generator-free.js` has been removed
- If the AI call fails, the system falls back to locally generated template questions

## File

The implementation is in `admin/js/ai-question-generator-free.js`.
