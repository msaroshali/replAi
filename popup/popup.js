/**
 * SmartReply AI — Professional Settings Popup Script
 */

const ORDERED_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-1.5-flash'
];

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleKeyBtn = document.getElementById('toggleKeyVisibility');
  const testKeyBtn = document.getElementById('testKeyBtn');
  const testResult = document.getElementById('testResult');
  const defaultToneSelect = document.getElementById('defaultTone');
  const userNameInput = document.getElementById('userName');
  const selectedModelSelect = document.getElementById('selectedModel');
  const useEmojiCheckbox = document.getElementById('useEmoji');
  const saveBtn = document.getElementById('saveBtn');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const lastModelText = document.getElementById('lastModelText');
  const toast = document.getElementById('toast');

  // Load saved settings
  chrome.storage.local.get([
    'geminiApiKey',
    'defaultTone',
    'userName',
    'selectedModel',
    'useEmoji',
    'lastUsedModel',
    'lastUsedTime'
  ], (res) => {
    if (res.geminiApiKey) {
      apiKeyInput.value = res.geminiApiKey;
      updateStatusBadge(true);
    } else {
      updateStatusBadge(false);
    }

    if (res.defaultTone) defaultToneSelect.value = res.defaultTone;
    if (res.userName) userNameInput.value = res.userName;
    if (res.selectedModel) selectedModelSelect.value = res.selectedModel;
    if (res.useEmoji !== undefined) useEmojiCheckbox.checked = res.useEmoji;

    if (res.lastUsedModel) {
      lastModelText.innerHTML = `Last generated with: <strong>${res.lastUsedModel}</strong> ${res.lastUsedTime ? '(' + res.lastUsedTime + ')' : ''}`;
    } else {
      lastModelText.textContent = `Primary model: ${selectedModelSelect.value} (Auto-fallback enabled)`;
    }
  });

  // Toggle API key visibility
  toggleKeyBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleKeyBtn.textContent = '🔒';
    } else {
      apiKeyInput.type = 'password';
      toggleKeyBtn.textContent = '👁️';
    }
  });

  // Fast Verification using the exact supported model chain
  testKeyBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showTestResult(false, 'Enter an API key first.');
      return;
    }

    testResult.textContent = 'Verifying... ⚡';
    testResult.className = 'test-message';
    testKeyBtn.disabled = true;

    const testModels = [
      selectedModelSelect.value,
      'gemini-3-flash-preview',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-1.5-flash'
    ];
    const uniqueTestModels = [...new Set(testModels.filter(Boolean))];

    let verifiedModel = null;
    let errorMsg = 'Key verification failed';

    for (const model of uniqueTestModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            generationConfig: { maxOutputTokens: 2 }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          verifiedModel = model;
          break;
        } else {
          const errData = await res.json().catch(() => ({}));
          const msg = errData.error?.message || `HTTP ${res.status}`;
          if (res.status === 400 && msg.includes('API_KEY_INVALID')) {
            errorMsg = 'Invalid API key';
            break;
          }
          errorMsg = msg;
        }
      } catch (err) {
        errorMsg = err.name === 'AbortError' ? 'Timeout' : (err.message || 'Error');
      }
    }

    testKeyBtn.disabled = false;

    if (verifiedModel) {
      showTestResult(true, `✓ Key Verified (${verifiedModel})!`);
      updateStatusBadge(true);
      lastModelText.innerHTML = `Verified with: <strong>${verifiedModel}</strong>`;
      // Automatically save the verified key immediately
      chrome.storage.local.set({
        geminiApiKey: key,
        lastUsedModel: verifiedModel,
        selectedModel: selectedModelSelect.value || verifiedModel
      });
    } else {
      showTestResult(false, `✕ ${errorMsg.substring(0, 30)}`);
      updateStatusBadge(false);
    }
  });

  // Save Settings
  saveBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const defaultTone = defaultToneSelect.value;
    const userName = userNameInput.value.trim();
    const selectedModel = selectedModelSelect.value;
    const useEmoji = useEmojiCheckbox.checked;

    chrome.storage.local.set({
      geminiApiKey: apiKey,
      defaultTone,
      userName,
      selectedModel,
      useEmoji
    }, () => {
      updateStatusBadge(Boolean(apiKey));
      lastModelText.innerHTML = `Primary model: <strong>${selectedModel}</strong> (Auto-fallback enabled)`;
      showToast('Settings saved!');
    });
  });

  function updateStatusBadge(hasKey) {
    if (hasKey) {
      statusBadge.className = 'status-badge status-ready';
      statusText.textContent = 'Active';
    } else {
      statusBadge.className = 'status-badge status-warning';
      statusText.textContent = 'Needs Key';
    }
  }

  function showTestResult(isSuccess, msg) {
    testResult.textContent = msg;
    testResult.className = `test-message ${isSuccess ? 'success' : 'error'}`;
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }
});
