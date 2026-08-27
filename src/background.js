import { GoogleGenAI } from '@google/genai';

const DEFAULT_MODEL_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['defaultTone', 'selectedModel', 'useEmoji'], (res) => {
    const defaults = {};
    if (!res.defaultTone) defaults.defaultTone = 'professional';
    if (!res.selectedModel) defaults.selectedModel = 'gemini-3.1-flash-lite';
    if (res.useEmoji === undefined) defaults.useEmoji = false;
    if (Object.keys(defaults).length > 0) {
      chrome.storage.local.set(defaults);
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ANALYZE_AND_PREGENERATE') {
    handleAnalyzeAndPregenerate(request)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: 'SERVER_ERROR', message: err.message || 'Generation failed' }));
    return true;
  }

  if (request.action === 'GENERATE_CUSTOM') {
    handleCustomReply(request)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: 'SERVER_ERROR', message: err.message || 'Custom generation failed' }));
    return true;
  }

  if (request.action === 'TEST_API_KEY') {
    testApiKeyWithSdk(request.apiKey, request.model)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message || 'Verification failed.' }));
    return true;
  }
});

/**
 * Analyze thread context and pre-generate 3-4 tailored option buttons with complete ready-to-insert replies
 */
async function handleAnalyzeAndPregenerate(data) {
  const settings = await chrome.storage.local.get([
    'geminiApiKey',
    'defaultTone',
    'userName',
    'useEmoji',
    'selectedModel'
  ]);

  const apiKey = settings.geminiApiKey?.trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'NO_API_KEY',
      message: 'Please set your Gemini API Key in the SmartReply extension popup.'
    };
  }

  const requestedModel = settings.selectedModel || 'gemini-3.1-flash-lite';
  const userName = settings.userName?.trim() || '';
  const useEmoji = settings.useEmoji === true;

  const systemInstruction = `You are SmartReply AI, an intelligent executive email assistant embedded in Gmail.
Your role is to deeply analyze the incoming email thread context (no matter the topic - personal, business, landlord, recruiter, etc.), determine exactly 4 distinct natural reply strategies suitable for this specific situation, and draft complete, ready-to-send email replies for each.

OUTPUT FORMAT REQUIREMENTS:
You MUST respond with a valid JSON object ONLY (no markdown code fences, no extra text) with this exact schema:
{
  "options": [
    {
      "id": "opt_1",
      "emoji": "🚀",
      "title": "Short 2-4 word intent title (e.g. Agree and Proceed)",
      "description": "Brief 1-sentence summary of what this reply says",
      "reply": "The complete, polished, ready-to-send email reply text."
    },
    // exactly 4 options
  ]
}

REPLY GUIDELINES:
1. Provide exactly 4 diverse options tailored to the specific conversation context. For example: agreement, disagreement, request for clarification, or an alternative proposal.
2. Formulate proper email structure:
   - Salutation (e.g., "Hi [Name],")
   - Empty line
   - Body paragraph(s) separated by empty lines
   - Empty line
   - Sign-off (e.g., "Best regards,\\n\\n${userName ? userName : '[Your Name]'}")
3. ${useEmoji ? 'You may include 1 tasteful emoji in the reply if fitting.' : 'Do NOT include emojis inside the email reply body.'}
4. Write natural, human-like text. Do not put the name inline in the same sentence as the sign-off.
5. Output raw JSON only.`;

  const promptText = `${systemInstruction}

=== INCOMING EMAIL CONVERSATION THREAD ===
Subject: ${data.subject || '(No Subject)'}
Sender: ${data.sender || 'Sender'}

${data.threadHistory || data.emailContent || '(No email body content available)'}
=== END OF THREAD ===

Analyze this thread and generate the 3-4 tailored option choices with their complete pre-generated replies in JSON now:`;

  const ai = new GoogleGenAI({ apiKey });
  const modelsToTry = [requestedModel, ...DEFAULT_MODEL_CHAIN.filter((m) => m !== requestedModel)];

  let lastError = null;
  let successfulModel = '';

  for (const modelName of modelsToTry) {
    try {
      console.log(`[SmartReply AI] Analyzing thread & pre-generating options with model: ${modelName}`);

      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptText
      });

      if (response && response.text) {
        let rawJson = response.text.trim();
        if (rawJson.startsWith('```json')) {
          rawJson = rawJson.substring(7).trim();
        } else if (rawJson.startsWith('```')) {
          rawJson = rawJson.substring(3).trim();
        }
        if (rawJson.endsWith('```')) {
          rawJson = rawJson.substring(0, rawJson.length - 3).trim();
        }

        const parsed = JSON.parse(rawJson);
        if (parsed && Array.isArray(parsed.options) && parsed.options.length > 0) {
          successfulModel = modelName;
          console.log(`[SmartReply AI] Successfully generated ${parsed.options.length} contextual options with: ${modelName}`);

          chrome.storage.local.set({
            lastUsedModel: successfulModel,
            lastUsedTime: new Date().toLocaleTimeString()
          });

          return {
            success: true,
            options: parsed.options,
            modelUsed: successfulModel
          };
        }
      }
    } catch (err) {
      console.warn(`[SmartReply AI] Model ${modelName} failed:`, err.message || err);
      let msg = err.message || String(err);
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error && parsed.error.message) msg = parsed.error.message;
      } catch (e) {}
      lastError = msg;
    }
  }

  return {
    success: false,
    error: 'ALL_MODELS_FAILED',
    message: typeof lastError === 'string' ? lastError : 'Failed to analyze conversation across available models.'
  };
}

/**
 * Handle custom prompt submission
 */
async function handleCustomReply(data) {
  const settings = await chrome.storage.local.get([
    'geminiApiKey',
    'defaultTone',
    'userName',
    'useEmoji',
    'selectedModel'
  ]);

  const apiKey = settings.geminiApiKey?.trim();
  if (!apiKey) {
    return { success: false, error: 'NO_API_KEY', message: 'API Key is missing.' };
  }

  const requestedModel = settings.selectedModel || 'gemini-3.1-flash-lite';
  const userName = settings.userName?.trim() || '';
  const ai = new GoogleGenAI({ apiKey });

  const promptText = `You are SmartReply AI. Write a concise, professional email reply.
Subject: ${data.subject || ''}
Sender: ${data.sender || ''}

Context:
${data.threadHistory || data.emailContent || ''}

User Directive:
${data.customInstruction}

${userName ? `Sign off with: "${userName}".` : 'Sign off professionally.'}
Output ONLY the reply text ready to send.`;

  const modelsToTry = [requestedModel, ...DEFAULT_MODEL_CHAIN.filter((m) => m !== requestedModel)];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptText
      });

      if (response && response.text) {
        let replyText = response.text.trim();
        if (replyText.startsWith('```')) {
          const firstLineEnd = replyText.indexOf('\n');
          if (firstLineEnd !== -1) replyText = replyText.substring(firstLineEnd + 1);
        }
        if (replyText.endsWith('```')) {
          replyText = replyText.substring(0, replyText.length - 3);
        }
        return { success: true, replyText: replyText.trim(), modelUsed: modelName };
      }
    } catch (err) {
      lastError = err.message || String(err);
    }
  }

  return { success: false, error: 'FAILED', message: lastError || 'Custom generation failed.' };
}

/**
 * Verify key using official GoogleGenAI SDK
 */
async function testApiKeyWithSdk(apiKey, preferredModel = 'gemini-3.1-flash-lite') {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'Please enter an API key.' };
  }

  const cleanKey = apiKey.trim();
  const ai = new GoogleGenAI({ apiKey: cleanKey });

  const modelsToTry = [
    preferredModel,
    ...DEFAULT_MODEL_CHAIN.filter((m) => m !== preferredModel)
  ];

  let lastErrorMsg = 'Verification failed';

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: 'Hi'
      });

      if (response && response.text) {
        chrome.storage.local.set({ lastUsedModel: modelName });
        return { success: true, workingModel: modelName };
      }
    } catch (err) {
      lastErrorMsg = err.message || String(err);
      if (lastErrorMsg.includes('API_KEY_INVALID')) {
        return { success: false, error: 'Invalid API Key. Please verify in Google AI Studio.' };
      }
    }
  }

  return { success: false, error: `Key test failed: ${lastErrorMsg.substring(0, 30)}` };
}
