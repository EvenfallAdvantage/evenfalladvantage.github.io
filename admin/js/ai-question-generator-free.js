// Multi-Provider AI Question Generator for Assessments
// Supports: Gemini, OpenAI, Anthropic, Groq, OpenRouter, Mistral, Together, Ollama, Custom

// ─── Provider Configuration ───────────────────────────────────────────────────

const AI_PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiStyle: 'gemini',
    corsNote: null,
  },
  openai: {
    name: 'OpenAI',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'],
    baseUrl: 'https://api.openai.com/v1',
    apiStyle: 'openai',
    corsNote: null,
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
    baseUrl: 'https://api.anthropic.com/v1',
    apiStyle: 'anthropic',
    corsNote: 'This provider may block browser requests (CORS). If generation fails, try OpenRouter or Groq as alternatives.',
  },
  groq: {
    name: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    baseUrl: 'https://api.groq.com/openai/v1',
    apiStyle: 'openai',
    corsNote: null,
  },
  openrouter: {
    name: 'OpenRouter',
    defaultModel: 'openai/gpt-4o',
    models: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-20250514', 'google/gemini-2.0-flash-001', 'meta-llama/llama-3.3-70b-instruct'],
    baseUrl: 'https://openrouter.ai/api/v1',
    apiStyle: 'openai',
    corsNote: null,
  },
  mistral: {
    name: 'Mistral',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-small-latest'],
    baseUrl: 'https://api.mistral.ai/v1',
    apiStyle: 'openai',
    corsNote: null,
  },
  together: {
    name: 'Together AI',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    baseUrl: 'https://api.together.xyz/v1',
    apiStyle: 'openai',
    corsNote: null,
  },
  ollama: {
    name: 'Ollama (Local)',
    defaultModel: 'llama3',
    models: ['llama3', 'mistral', 'codellama', 'gemma2'],
    baseUrl: 'http://localhost:11434/v1',
    apiStyle: 'openai',
    corsNote: 'Requires Ollama running locally. Set OLLAMA_ORIGINS=* for CORS.',
  },
  custom: {
    name: 'Custom (OpenAI-compatible)',
    defaultModel: '',
    models: [],
    baseUrl: '',
    apiStyle: 'openai',
    corsNote: 'Enter any OpenAI-compatible API endpoint.',
  },
};

const CONFIG_KEY = 'ea_ai_provider_config';

function loadAIConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
  } catch { return null; }
}

function saveAIConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// ─── Provider Settings UI ─────────────────────────────────────────────────────

function showAIConfigPanel(onSaveCallback) {
  const existing = document.getElementById('ai-config-panel');
  if (existing) existing.remove();

  const config = loadAIConfig() || { provider: 'gemini', apiKey: '', model: '', baseUrl: '' };
  const provider = AI_PROVIDERS[config.provider] || AI_PROVIDERS.gemini;

  const panel = document.createElement('div');
  panel.id = 'ai-config-panel';
  panel.className = 'modal-overlay';
  panel.innerHTML = `
    <div style="background: var(--admin-card-bg, #1a2332); border: 1px solid var(--admin-border, #2a3a4a); border-radius: 12px; padding: 24px; max-width: 520px; width: 90%; margin: auto; position: relative; top: 50%; transform: translateY(-50%);">
      <h3 style="margin: 0 0 16px; color: var(--admin-text, #e0e0e0);">AI Provider Settings</h3>
      
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 13px; margin-bottom: 4px; color: var(--admin-text-secondary, #aaa);">Provider</label>
        <select id="ai-provider-select" style="width: 100%; padding: 8px; background: var(--admin-input-bg, #0d1520); color: var(--admin-text, #e0e0e0); border: 1px solid var(--admin-border, #2a3a4a); border-radius: 6px;">
          ${Object.entries(AI_PROVIDERS).map(([key, p]) => `<option value="${key}" ${key === config.provider ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </div>

      <div id="ai-cors-warning" style="display: none; background: #3d2e00; border: 1px solid #6b5000; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 12px; color: #f0c040;"></div>

      <div id="ai-key-row" style="margin-bottom: 12px;">
        <label style="display: block; font-size: 13px; margin-bottom: 4px; color: var(--admin-text-secondary, #aaa);">API Key</label>
        <input type="password" id="ai-api-key" value="${escapeAttr(config.apiKey || '')}" placeholder="Paste your API key..." style="width: 100%; padding: 8px; background: var(--admin-input-bg, #0d1520); color: var(--admin-text, #e0e0e0); border: 1px solid var(--admin-border, #2a3a4a); border-radius: 6px; box-sizing: border-box;" />
      </div>

      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 13px; margin-bottom: 4px; color: var(--admin-text-secondary, #aaa);">Model</label>
        <select id="ai-model-select" style="width: 100%; padding: 8px; background: var(--admin-input-bg, #0d1520); color: var(--admin-text, #e0e0e0); border: 1px solid var(--admin-border, #2a3a4a); border-radius: 6px;">
        </select>
        <input type="text" id="ai-model-custom" value="" placeholder="Or type a custom model name..." style="width: 100%; padding: 8px; margin-top: 6px; background: var(--admin-input-bg, #0d1520); color: var(--admin-text, #e0e0e0); border: 1px solid var(--admin-border, #2a3a4a); border-radius: 6px; box-sizing: border-box; font-size: 12px;" />
      </div>

      <div id="ai-baseurl-row" style="margin-bottom: 16px; display: none;">
        <label style="display: block; font-size: 13px; margin-bottom: 4px; color: var(--admin-text-secondary, #aaa);">Base URL (override)</label>
        <input type="text" id="ai-base-url" value="${escapeAttr(config.baseUrl || '')}" placeholder="https://..." style="width: 100%; padding: 8px; background: var(--admin-input-bg, #0d1520); color: var(--admin-text, #e0e0e0); border: 1px solid var(--admin-border, #2a3a4a); border-radius: 6px; box-sizing: border-box;" />
      </div>

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button onclick="document.getElementById('ai-config-panel').remove()" style="padding: 8px 16px; background: transparent; color: var(--admin-text-secondary, #aaa); border: 1px solid var(--admin-border, #2a3a4a); border-radius: 6px; cursor: pointer;">Cancel</button>
        <button id="ai-save-btn" style="padding: 8px 16px; background: var(--admin-primary, #d59b3c); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Save & Generate</button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  const providerSelect = document.getElementById('ai-provider-select');
  const modelSelect = document.getElementById('ai-model-select');
  const modelCustom = document.getElementById('ai-model-custom');
  const corsWarning = document.getElementById('ai-cors-warning');
  const baseUrlRow = document.getElementById('ai-baseurl-row');
  const keyRow = document.getElementById('ai-key-row');

  function updateProviderUI() {
    const pKey = providerSelect.value;
    const prov = AI_PROVIDERS[pKey];
    modelSelect.innerHTML = prov.models.map(m => `<option value="${m}" ${m === config.model ? 'selected' : ''}>${m}</option>`).join('') || '<option value="">Enter model below</option>';
    corsWarning.style.display = prov.corsNote ? 'block' : 'none';
    corsWarning.textContent = prov.corsNote || '';
    baseUrlRow.style.display = (pKey === 'custom' || pKey === 'ollama') ? 'block' : 'none';
    keyRow.style.display = pKey === 'ollama' ? 'none' : 'block';
  }

  providerSelect.addEventListener('change', updateProviderUI);
  updateProviderUI();

  document.getElementById('ai-save-btn').addEventListener('click', () => {
    const newConfig = {
      provider: providerSelect.value,
      apiKey: document.getElementById('ai-api-key').value.trim(),
      model: modelCustom.value.trim() || modelSelect.value,
      baseUrl: document.getElementById('ai-base-url').value.trim(),
    };
    saveAIConfig(newConfig);
    panel.remove();
    if (onSaveCallback) onSaveCallback(newConfig);
  });
}

// ─── API Adapters ─────────────────────────────────────────────────────────────

async function callOpenAICompatible(baseUrl, apiKey, model, prompt) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 3000,
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callGemini(apiKey, model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 3000 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

async function callAnthropic(apiKey, model, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text;
}

async function callAIProvider(config, prompt) {
  const prov = AI_PROVIDERS[config.provider];
  const baseUrl = config.baseUrl || prov.baseUrl;
  const model = config.model || prov.defaultModel;

  let rawText;
  switch (prov.apiStyle) {
    case 'gemini':
      rawText = await callGemini(config.apiKey, model, prompt);
      break;
    case 'anthropic':
      rawText = await callAnthropic(config.apiKey, model, prompt);
      break;
    case 'openai':
    default:
      rawText = await callOpenAICompatible(baseUrl, config.apiKey, model, prompt);
      break;
  }

  // Parse JSON from response (strip markdown fencing if present)
  let jsonText = rawText.trim();
  if (jsonText.startsWith('```json')) jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  else if (jsonText.startsWith('```')) jsonText = jsonText.replace(/```\n?/g, '');
  if (jsonText.includes('{')) jsonText = jsonText.substring(jsonText.indexOf('{'), jsonText.lastIndexOf('}') + 1);

  const parsed = JSON.parse(jsonText);
  return parsed.questions || parsed;
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildQuestionPrompt(moduleName, slides) {
  const slideContent = slides.map((slide, i) =>
    `Slide ${i + 1}: ${slide.title || 'Untitled'}\n${slide.content || ''}\n${slide.notes || ''}`
  ).join('\n\n');

  return `You are an expert security training assessment creator specializing in event security and emergency response. Based on the following training module content, generate 10 high-quality multiple-choice questions.

Module: ${moduleName}

Content:
${slideContent}

Generate exactly 10 questions in the following JSON format:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation of the correct answer"
    }
  ]
}

CRITICAL REQUIREMENTS:
1. Each question MUST be based on SPECIFIC content from the slides above
2. Questions should test practical application and scenario-based understanding
3. All 4 options must be plausible; randomize the correct answer position
4. Difficulty mix: 3 basic recall, 4 application, 3 analysis/decision-making
5. Prioritize safety-critical information and proper procedures
6. Keep questions clear and under 200 characters
7. Use professional security industry terminology

RESPOND ONLY WITH VALID JSON, NO OTHER TEXT OR MARKDOWN`;
}

// ─── Local Fallback Generator ─────────────────────────────────────────────────

function generateQuestionsLocally(slides, moduleName) {
  const questions = [];
  const commonDistractors = {
    procedures: ['Follow standard operating procedures', 'Contact your supervisor immediately', 'Document the incident in writing', 'Notify local law enforcement'],
    safety: ['Ensure personal safety first', 'Evacuate the area immediately', 'Secure the perimeter', 'Call for backup assistance'],
  };

  slides.forEach((slide) => {
    if (slide.content && slide.content.length > 50 && questions.length < 10) {
      const sentences = slide.content.split(/[.!?]+/).filter(s => s.trim().length > 20);
      if (sentences.length > 0) {
        const keyFact = sentences[0].trim();
        const distractors = commonDistractors[questions.length % 2 === 0 ? 'procedures' : 'safety'];
        const options = shuffleArray([keyFact.length > 100 ? keyFact.substring(0, 100) + '...' : keyFact, ...distractors.slice(0, 3)]);
        questions.push({
          question: `According to ${moduleName}, what is the correct approach for ${slide.title?.toLowerCase() || 'this topic'}?`,
          options,
          correct: options.findIndex(o => o.includes(keyFact.substring(0, 50))) || 0,
          explanation: `Covered in ${slide.title}: ${keyFact.substring(0, 150)}...`,
        });
      }
    }
  });

  while (questions.length < 10) {
    questions.push({
      question: questions.length % 2 === 0
        ? 'What is the primary responsibility of an event security guard?'
        : 'When should you escalate a situation to your supervisor?',
      options: shuffleArray(questions.length % 2 === 0
        ? ['Ensuring the safety and security of all attendees', 'Selling merchandise and concessions', 'Managing event logistics and scheduling', 'Providing entertainment for guests']
        : ['When the situation exceeds your authority or training', 'Only during emergencies', 'Never, handle everything independently', 'Only at the end of your shift']),
      correct: 0,
      explanation: 'Fundamental security principle.',
    });
  }
  return questions;
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ─── Save Questions ───────────────────────────────────────────────────────────

async function saveQuestionsToAssessment(assessmentId, questions) {
  const { error: deleteError } = await supabase.from('assessment_questions').delete().eq('assessment_id', assessmentId);
  if (deleteError) throw deleteError;

  const records = questions.map((q, i) => ({
    assessment_id: assessmentId,
    question_number: i + 1,
    question_text: q.question,
    option_a: q.options[0],
    option_b: q.options[1],
    option_c: q.options[2],
    option_d: q.options[3],
    correct_answer: ['A', 'B', 'C', 'D'][q.correct],
    explanation: q.explanation,
  }));

  const { error: insertError } = await supabase.from('assessment_questions').insert(records);
  if (insertError) throw insertError;

  await supabase.from('assessments').update({ total_questions: questions.length }).eq('id', assessmentId);
  return true;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

async function generateAssessmentQuestions(moduleId, moduleName) {
  const config = loadAIConfig();

  if (!config || !config.apiKey) {
    // No config yet -- show settings panel, then generate on save
    return new Promise((resolve) => {
      showAIConfigPanel(async (newConfig) => {
        const result = await _doGenerate(moduleId, moduleName, newConfig);
        resolve(result);
      });
    });
  }

  return _doGenerate(moduleId, moduleName, config);
}

async function _doGenerate(moduleId, moduleName, config) {
  try {
    const { data: slides, error: slidesError } = await supabase.from('module_slides').select('*').eq('module_id', moduleId).order('slide_number');
    if (slidesError) throw slidesError;
    if (!slides || slides.length === 0) throw new Error('No slides found for this module');

    const { data: assessment, error: assessmentError } = await supabase.from('assessments').select('*').eq('module_id', moduleId).single();
    if (assessmentError) throw assessmentError;

    let questions;
    let method = 'AI';

    try {
      const prompt = buildQuestionPrompt(moduleName, slides);
      questions = await callAIProvider(config, prompt);
    } catch (aiError) {
      console.warn('AI generation failed, using local fallback:', aiError);
      questions = generateQuestionsLocally(slides, moduleName);
      method = 'Local (fallback)';
    }

    await saveQuestionsToAssessment(assessment.id, questions);

    return { success: true, questionsGenerated: questions.length, method, provider: AI_PROVIDERS[config.provider]?.name || config.provider };
  } catch (error) {
    console.error('Error in generateAssessmentQuestions:', error);
    return { success: false, error: error.message };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

window.generateAssessmentQuestions = generateAssessmentQuestions;
window.saveQuestionsToAssessment = saveQuestionsToAssessment;
window.showAIConfigPanel = showAIConfigPanel;
