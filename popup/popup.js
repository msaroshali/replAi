const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const SUPPORTED_MODELS = new Set([
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash'
]);
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const toggleKeyButton = document.getElementById('toggleKeyVisibility');
  const testKeyButton = document.getElementById('testKeyBtn');
  const testResult = document.getElementById('testResult');
  const toneSelect = document.getElementById('defaultTone');
  const lengthSelect = document.getElementById('defaultLength');
  const userNameInput = document.getElementById('userName');
  const modelSelect = document.getElementById('selectedModel');
  const emojiCheckbox = document.getElementById('useEmoji');
  const consentCheckbox = document.getElementById('privacyConsentAccepted');
  const privacyDetails = document.getElementById('privacyDetails');
  const privacySummaryText = document.getElementById('privacySummaryText');
  const privacyState = document.getElementById('privacyState');
  const colorThemeSelect = document.getElementById('colorTheme');
  const appearanceModeSelect = document.getElementById('appearanceMode');
  const saveButton = document.getElementById('saveBtn');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const lastModelText = document.getElementById('lastModelText');
  const toast = document.getElementById('toast');

  let verificationTimer = 0;
  let verificationRequestId = 0;
  let verificationState = 'idle';
  let verifiedSignature = '';

  chrome.storage.local.get([
    'geminiApiKey',
    'defaultTone',
    'defaultLength',
    'userName',
    'selectedModel',
    'useEmoji',
    'privacyConsentAccepted',
    'colorTheme',
    'appearanceMode',
    'apiKeyVerified',
    'verifiedModel',
    'lastUsedModel'
  ], (saved) => {
    apiKeyInput.value = saved.geminiApiKey || '';
    toneSelect.value = saved.defaultTone || 'professional';
    lengthSelect.value = saved.defaultLength || 'medium';
    userNameInput.value = saved.userName || '';
    modelSelect.value = SUPPORTED_MODELS.has(saved.selectedModel) ? saved.selectedModel : DEFAULT_MODEL;
    emojiCheckbox.checked = saved.useEmoji === true;
    consentCheckbox.checked = saved.privacyConsentAccepted === true;
    colorThemeSelect.value = saved.colorTheme === 'rose' ? 'rose' : 'teal';
    appearanceModeSelect.value = ['light', 'dark', 'system'].includes(saved.appearanceMode) ? saved.appearanceMode : 'system';

    applyAppearance();
    updateConsentSummary();
    privacyDetails.open = !consentCheckbox.checked;

    if (saved.apiKeyVerified === true && saved.verifiedModel === modelSelect.value && apiKeyInput.value.trim()) {
      verifiedSignature = currentKeySignature();
      verificationState = 'success';
      showTestResult('success', `Saved key verified with ${modelSelect.value}.`);
    } else if (apiKeyInput.value.trim()) {
      queueKeyVerification(350);
    }

    updateStatus();
    lastModelText.textContent = saved.lastUsedModel
      ? `Last successful model: ${saved.lastUsedModel}`
      : 'No drafts generated yet.';
  });

  toggleKeyButton.addEventListener('click', () => {
    const showing = apiKeyInput.type === 'text';
    apiKeyInput.type = showing ? 'password' : 'text';
    toggleKeyButton.setAttribute('aria-label', showing ? 'Show API key' : 'Hide API key');
  });

  apiKeyInput.addEventListener('input', (event) => {
    window.clearTimeout(verificationTimer);
    verificationRequestId += 1;
    verificationState = 'idle';
    verifiedSignature = '';
    testKeyButton.disabled = false;
    testKeyButton.textContent = 'Check now';

    const key = apiKeyInput.value.trim();
    if (!key) {
      showTestResult('info', 'Paste a key and it will be checked automatically.');
    } else if (key.length < 16) {
      showTestResult('info', 'Waiting for the complete key…');
    } else {
      queueKeyVerification(event.inputType === 'insertFromPaste' ? 120 : 650);
    }
    updateStatus();
  });

  modelSelect.addEventListener('change', () => {
    verifiedSignature = '';
    verificationState = 'idle';
    if (apiKeyInput.value.trim().length >= 16) queueKeyVerification(250);
    updateStatus();
  });

  consentCheckbox.addEventListener('change', () => {
    updateConsentSummary();
    updateStatus();
  });

  colorThemeSelect.addEventListener('change', applyAppearance);
  appearanceModeSelect.addEventListener('change', applyAppearance);
  systemDarkQuery.addEventListener('change', () => {
    if (appearanceModeSelect.value === 'system') applyAppearance();
  });

  testKeyButton.addEventListener('click', verifyKey);

  saveButton.addEventListener('click', () => {
    const signature = currentKeySignature();
    const keyIsVerified = Boolean(signature) && verifiedSignature === signature;
    const settings = {
      geminiApiKey: apiKeyInput.value.trim(),
      defaultTone: toneSelect.value,
      defaultLength: lengthSelect.value,
      userName: userNameInput.value.trim(),
      selectedModel: modelSelect.value || DEFAULT_MODEL,
      useEmoji: emojiCheckbox.checked,
      privacyConsentAccepted: consentCheckbox.checked,
      colorTheme: colorThemeSelect.value === 'rose' ? 'rose' : 'teal',
      appearanceMode: ['light', 'dark', 'system'].includes(appearanceModeSelect.value) ? appearanceModeSelect.value : 'system',
      apiKeyVerified: keyIsVerified,
      verifiedModel: keyIsVerified ? modelSelect.value : ''
    };

    chrome.storage.local.set(settings, () => {
      updateConsentSummary();
      privacyDetails.open = !settings.privacyConsentAccepted;
      updateStatus();

      if (!settings.privacyConsentAccepted) {
        showToast('Settings saved. SmartReply is paused until data sharing is enabled.');
      } else if (!settings.geminiApiKey) {
        showToast('Preferences saved. Add a Gemini key to start.');
      } else if (keyIsVerified) {
        showToast('Settings saved. SmartReply is ready.');
      } else {
        showToast('Settings saved. The key still needs a successful check.');
      }
    });
  });

  function queueKeyVerification(delay) {
    window.clearTimeout(verificationTimer);
    verificationState = 'waiting';
    showTestResult('checking', 'Checking the key automatically…');
    updateStatus();
    verificationTimer = window.setTimeout(verifyKey, delay);
  }

  function verifyKey() {
    window.clearTimeout(verificationTimer);
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      verificationState = 'idle';
      showTestResult('info', 'Paste a key and it will be checked automatically.');
      updateStatus();
      return;
    }
    if (apiKey.length < 16) {
      verificationState = 'idle';
      showTestResult('info', 'Waiting for the complete key…');
      updateStatus();
      return;
    }

    const signature = currentKeySignature();
    const requestId = ++verificationRequestId;
    verificationState = 'checking';
    testKeyButton.disabled = true;
    testKeyButton.textContent = 'Checking…';
    showTestResult('checking', 'Connecting to Gemini…');
    updateStatus();

    chrome.runtime.sendMessage({
      action: 'TEST_API_KEY',
      apiKey,
      model: modelSelect.value
    }, (response) => {
      if (requestId !== verificationRequestId || signature !== currentKeySignature()) return;

      testKeyButton.disabled = false;
      testKeyButton.textContent = 'Check now';

      if (chrome.runtime.lastError) {
        verificationState = 'error';
        verifiedSignature = '';
        showTestResult('error', 'Extension disconnected. Reload it and retry.');
      } else if (response?.success) {
        verificationState = 'success';
        verifiedSignature = signature;
        showTestResult('success', `Connected with ${response.workingModel}.`);
      } else {
        verificationState = 'error';
        verifiedSignature = '';
        showTestResult('error', response?.error || 'Connection failed.');
      }
      updateStatus();
    });
  }

  function currentKeySignature() {
    const key = apiKeyInput.value.trim();
    return key ? `${key}\n${modelSelect.value || DEFAULT_MODEL}` : '';
  }

  function applyAppearance() {
    const theme = colorThemeSelect.value === 'rose' ? 'rose' : 'teal';
    const preference = ['light', 'dark', 'system'].includes(appearanceModeSelect.value)
      ? appearanceModeSelect.value
      : 'system';
    const resolvedMode = preference === 'system'
      ? (systemDarkQuery.matches ? 'dark' : 'light')
      : preference;

    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.mode = resolvedMode;
  }

  function updateConsentSummary() {
    if (consentCheckbox.checked) {
      privacySummaryText.textContent = 'Data sharing accepted';
      privacyState.textContent = 'Enabled';
      privacyState.className = 'privacy-state privacy-state-enabled';
    } else {
      privacySummaryText.textContent = 'Generation is paused';
      privacyState.textContent = 'Paused';
      privacyState.className = 'privacy-state privacy-state-paused';
    }
  }

  function updateStatus() {
    const hasKey = Boolean(apiKeyInput.value.trim());
    let statusClass = 'status-warning';
    let label = 'Set up';

    if (hasKey && !consentCheckbox.checked) {
      statusClass = 'status-paused';
      label = 'Paused';
    } else if (hasKey && ['waiting', 'checking'].includes(verificationState)) {
      statusClass = 'status-checking';
      label = 'Checking';
    } else if (hasKey && consentCheckbox.checked && verifiedSignature === currentKeySignature()) {
      statusClass = 'status-ready';
      label = 'Ready';
    } else if (hasKey && verificationState === 'error') {
      label = 'Key issue';
    } else if (hasKey && consentCheckbox.checked) {
      label = 'Check key';
    }

    statusBadge.className = `status-badge ${statusClass}`;
    statusText.textContent = label;
  }

  function showTestResult(kind, message) {
    testResult.className = `test-message ${kind}`;
    testResult.textContent = String(message).slice(0, 130);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3000);
  }
});
