# AI Question Generator Setup (Legacy)

> **DEPRECATED:** This document described the old OpenAI-only approach with a hardcoded API key in `admin/js/ai-question-generator.js`. That file has been **deleted**.
>
> The current system supports **8 AI providers** with browser-stored API keys. See [`FREE_AI_SETUP.md`](./FREE_AI_SETUP.md) for the updated documentation.

## What Changed (April 2026)

- `admin/js/ai-question-generator.js` (OpenAI-only, hardcoded key) — **deleted**
- `admin/js/ai-question-generator-free.js` — **completely rewritten** with multi-provider support
- API keys are now stored in `localStorage`, not in source code
- A settings panel UI lets admins select their provider and model
- Supports: Gemini, OpenAI, Anthropic, Groq, OpenRouter, Mistral, Together, Ollama, Custom
- Falls back to local template-based generation if the API call fails
