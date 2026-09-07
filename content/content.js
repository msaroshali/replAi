/**
 * SmartReply AI — Gmail compose integration.
 * Generates reviewable drafts and never sends email on the user's behalf.
 */

(function () {
  'use strict';

  const injectedToolbars = new WeakSet();
  const injectedComposeContainers = new WeakSet();
  const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const disconnectedMessage = 'SmartReply was updated or reloaded. Refresh Gmail and try again.';
  let scanQueued = false;

  const brandMark = `
    <svg class="smartreply-mark" viewBox="0 0 24 24" aria-hidden="true">
      <rect class="smartreply-mark-bg" x="1" y="1" width="22" height="22" rx="5.5"/>
      <!-- Left Ear -->
      <path d="M8.2 15 C5.8 11 5.1 5.3 7.9 3 C9 2.2 10.1 3 10.5 4.7 C11 7.8 10.5 12.2 9.8 15 Z" fill="#fff"/>
      <path d="M8.4 14 C7 11 6.7 6.4 8.3 4.3 C8.8 3.8 9.4 4.3 9.6 5.3 C9.9 7.5 9.5 11.5 9 14 Z" fill="#ffb8d1"/>
      <!-- Right Ear -->
      <path d="M14.2 15 C13.5 12.2 13 7.8 13.5 4.7 C13.9 3 15 2.2 16.1 3 C18.9 5.3 18.2 11 15.8 15 Z" fill="#fff"/>
      <path d="M15 14 C14.5 11.5 14.1 7.5 14.4 5.3 C14.6 4.3 15.2 3.8 15.7 4.3 C17.3 6.4 17 11 15.6 14 Z" fill="#ffb8d1"/>
      <!-- Head -->
      <ellipse cx="12" cy="17.5" rx="5.5" ry="4" fill="#fff"/>
      <!-- Eyes -->
      <ellipse cx="10.3" cy="17" rx="0.7" ry="0.8" fill="#441424"/>
      <circle cx="10.1" cy="16.7" r="0.25" fill="#fff"/>
      <ellipse cx="13.7" cy="17" rx="0.7" ry="0.8" fill="#441424"/>
      <circle cx="13.5" cy="16.7" r="0.25" fill="#fff"/>
      <!-- Nose -->
      <polygon points="11.5,18.3 12.5,18.3 12,18.8" fill="#d84a7e"/>
    </svg>`;

  function getLocalSettings(keys, callback) {
    const localStorage = globalThis.chrome?.storage?.local;
    if (!localStorage?.get) {
      callback({}, new Error('Extension storage is unavailable.'));
      return;
    }

    try {
      localStorage.get(keys, (saved) => {
        const runtimeError = globalThis.chrome?.runtime?.lastError;
        callback(saved || {}, runtimeError || null);
      });
    } catch (error) {
      callback({}, error);
    }
  }

  function scanAndInject() {
    removeOrphanedPopovers();

    const toolbars = document.querySelectorAll('td.gU.Up, div.gU.Up, div.aDh, .btC, tr.btC');
    toolbars.forEach((toolbar) => {
      const composeContainer = toolbar.closest('.M9, .AD, div[role="dialog"], table.cf') || toolbar.parentElement;
      if (injectedToolbars.has(toolbar) || injectedComposeContainers.has(composeContainer) || toolbar.querySelector('.smartreply-btn-wrapper')) return;

      const looksLikeComposeToolbar = toolbar.matches('tr.btC, .btC, .aDh, .Up') ||
        toolbar.querySelector('[command="Files"], [aria-label*="Attach"], [command="+formatting"]');

      if (looksLikeComposeToolbar) {
        injectToolbarButton(toolbar, composeContainer);
        injectedToolbars.add(toolbar);
        injectedComposeContainers.add(composeContainer);
      }
    });
  }

  function scheduleScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      scanAndInject();
    });
  }

  function injectToolbarButton(toolbar, composeContainer) {
    const wrapper = document.createElement('div');
    wrapper.className = 'smartreply-btn-wrapper';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'smartreply-circle-btn';
    button.title = 'SmartReply AI — draft a reply';
    button.setAttribute('aria-label', 'Draft a reply with SmartReply AI');
    button.innerHTML = brandMark;
    wrapper.appendChild(button);

    const popover = createPopover(composeContainer);
    popover.smartreplyComposeContainer = composeContainer;
    document.body.appendChild(popover);

    getLocalSettings(['colorTheme', 'appearanceMode'], (saved) => {
      applyContentAppearance(button, saved);
      applyContentAppearance(popover, saved);
    });

    const row = toolbar.closest('tr.btC') || (toolbar.matches('tr') ? toolbar : null);
    if (row) {
      const cell = document.createElement('td');
      cell.className = 'smartreply-button-td';
      cell.appendChild(wrapper);

      // Gmail places third-party compose actions (such as Loom) between Send
      // and its native formatting control. Anchoring to the Aa control keeps
      // SmartReply in the expected order without depending on another
      // extension's private DOM or translated labels:
      // Send -> third-party actions -> SmartReply -> Aa.
      const formattingButton = row.querySelector(
        '[command="+formatting"], ' +
        '.aA7.aaA.aMZ, ' +
        '[aria-label*="Formatting options" i], ' +
        '[data-tooltip*="Formatting options" i]'
      );
      const formattingCell = formattingButton?.closest('td');

      if (formattingCell && formattingCell.parentElement === row) {
        row.insertBefore(cell, formattingCell);
      } else {
        // Native-class fallback works independently of Gmail's language.
        const sendButton = row.querySelector(
          '.aoO, [command="Send"], ' +
          '[role="button"][aria-label^="Send" i], ' +
          '[role="button"][data-tooltip^="Send" i]'
        );
        const sendCell = sendButton?.closest('td');

        if (sendCell && sendCell.parentElement === row) {
          sendCell.insertAdjacentElement('afterend', cell);
        } else {
          row.appendChild(cell);
        }
      }
    } else {
      // Pop-out and alternate compose layouts may use a flex toolbar rather
      // than table cells. Insert immediately before the Aa control there too.
      const formattingButton = toolbar.querySelector(
        '[command="+formatting"], ' +
        '.aA7.aaA.aMZ, ' +
        '[aria-label*="Formatting options" i], ' +
        '[data-tooltip*="Formatting options" i]'
      );
      const formattingUnit = formattingButton?.closest('.gU') || formattingButton;

      if (formattingUnit?.parentElement) {
        formattingUnit.insertAdjacentElement('beforebegin', wrapper);
      } else {
        toolbar.appendChild(wrapper);
      }
    }

    bindPopover(button, popover, composeContainer);
  }

  function createPopover() {
    const popover = document.createElement('section');
    popover.className = 'smartreply-popover smartreply-hidden';
    popover.setAttribute('aria-label', 'SmartReply AI draft panel');
    popover.innerHTML = `
      <header class="smartreply-popover-header">
        <div class="smartreply-brand">${brandMark}<div><strong>SmartReply AI</strong><span>Review before inserting</span></div></div>
        <button type="button" class="smartreply-close-btn" aria-label="Close SmartReply AI">×</button>
      </header>

      <div class="smartreply-popover-body">
        <div class="smartreply-section-heading"><span>Draft preview</span><span class="smartreply-context-label">Best fit</span></div>
        <div class="smartreply-preview" tabindex="0" aria-live="polite">Choose a reply direction to preview its draft.</div>

        <fieldset class="smartreply-direction-group">
          <legend>Reply direction</legend>
          <div class="smartreply-options-list" role="list"></div>
        </fieldset>

        <label class="smartreply-field-label">Add a detail or instruction</label>
        <textarea class="smartreply-custom-input" rows="2" maxlength="1200" aria-label="Add a detail or instruction" placeholder="e.g. Thursday at 2 PM works; ask for the deck"></textarea>

        <div class="smartreply-controls-row">
          <label>Tone
            <select class="smartreply-tone-select">
              <option value="professional">Professional</option>
              <option value="direct">Direct</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
            </select>
          </label>
          <label>Length
            <select class="smartreply-length-select">
              <option value="short">Short</option>
              <option value="medium" selected>Medium</option>
              <option value="detailed">Detailed</option>
            </select>
          </label>
        </div>

        <div class="smartreply-action-row">
          <button type="button" class="smartreply-regenerate-btn">Regenerate</button>
          <button type="button" class="smartreply-insert-btn" disabled>Insert draft</button>
        </div>

        <div class="smartreply-footnote"><span class="smartreply-model-badge">Google Gemini</span><span>Never auto-sends</span></div>
      </div>

      <div class="smartreply-loading-overlay" aria-live="polite">
        <div class="smartreply-spinner"></div>
        <strong class="smartreply-loading-title">Reading the thread…</strong>
        <span class="smartreply-loading-subtitle">Drafting four useful directions</span>
      </div>`;
    return popover;
  }

  function bindPopover(trigger, popover, composeContainer) {
    const closeButton = popover.querySelector('.smartreply-close-btn');
    const preview = popover.querySelector('.smartreply-preview');
    const contextLabel = popover.querySelector('.smartreply-context-label');
    const optionsList = popover.querySelector('.smartreply-options-list');
    const customInput = popover.querySelector('.smartreply-custom-input');
    const toneSelect = popover.querySelector('.smartreply-tone-select');
    const lengthSelect = popover.querySelector('.smartreply-length-select');
    const regenerateButton = popover.querySelector('.smartreply-regenerate-btn');
    const insertButton = popover.querySelector('.smartreply-insert-btn');
    const loadingOverlay = popover.querySelector('.smartreply-loading-overlay');
    const loadingTitle = popover.querySelector('.smartreply-loading-title');
    const loadingSubtitle = popover.querySelector('.smartreply-loading-subtitle');
    const modelBadge = popover.querySelector('.smartreply-model-badge');

    const state = {
      options: [],
      selectedIndex: 0,
      customReply: '',
      context: null,
      requestId: 0
    };

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const wasHidden = popover.classList.contains('smartreply-hidden');
      closeAllPopovers(popover);
      if (!wasHidden) return;

      popover.classList.remove('smartreply-hidden');
      positionPopover(trigger, popover);

      getLocalSettings(['defaultTone', 'defaultLength', 'colorTheme', 'appearanceMode'], (saved, storageError) => {
        if (saved.defaultTone) toneSelect.value = saved.defaultTone;
        if (saved.defaultLength) lengthSelect.value = saved.defaultLength;
        applyContentAppearance(trigger, saved);
        applyContentAppearance(popover, saved);
        if (storageError) {
          showPanelError(disconnectedMessage);
          return;
        }
        if (!state.options.length) requestDrafts(false);
      });
    });

    closeButton.addEventListener('click', () => popover.classList.add('smartreply-hidden'));
    popover.addEventListener('click', (event) => event.stopPropagation());

    regenerateButton.addEventListener('click', () => {
      requestDrafts(Boolean(customInput.value.trim()));
    });

    insertButton.addEventListener('click', () => {
      const reply = state.customReply || state.options[state.selectedIndex]?.reply;
      if (!reply) return;

      const inserted = insertReplyText(findComposeBox(composeContainer), reply);
      if (inserted) {
        popover.classList.add('smartreply-hidden');
        showNotification('Draft inserted. Review it before sending.', 'success');
      }
    });

    customInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        requestDrafts(true);
      }
    });

    toneSelect.addEventListener('change', () => {
      regenerateButton.textContent = 'Apply & regenerate';
    });
    lengthSelect.addEventListener('change', () => {
      regenerateButton.textContent = 'Apply & regenerate';
    });

    function requestDrafts(useCustomInstruction) {
      const runtime = globalThis.chrome?.runtime;
      if (!runtime?.sendMessage) {
        showPanelError(disconnectedMessage);
        return;
      }

      const instruction = customInput.value.trim();
      if (useCustomInstruction && !instruction) {
        showNotification('Add a drafting note first.', 'warning');
        customInput.focus();
        return;
      }

      state.context = extractThreadContext(composeContainer);
      state.requestId += 1;
      const requestId = state.requestId;
      state.customReply = '';
      setLoading(true, useCustomInstruction ? 'Following your note…' : 'Reading the thread…', useCustomInstruction ? 'Drafting a tailored reply' : 'Drafting four useful directions');

      const basePayload = {
        subject: state.context.subject,
        sender: state.context.sender,
        threadHistory: state.context.threadHistory,
        emailContent: state.context.latestBody,
        toneOverride: toneSelect.value,
        lengthOverride: lengthSelect.value
      };

      const payload = useCustomInstruction
        ? { ...basePayload, action: 'GENERATE_CUSTOM', customInstruction: instruction }
        : { ...basePayload, action: 'ANALYZE_AND_PREGENERATE' };

      const timeout = window.setTimeout(() => {
        if (requestId !== state.requestId) return;
        state.requestId += 1;
        setLoading(false);
        showPanelError('The request timed out. Check your connection and try again.');
      }, 60000);

      getLocalSettings(['debugMode', 'debugFullContent'], (saved) => {
        if (saved.debugMode) {
          if (saved.debugFullContent) {
            console.groupCollapsed(`%c[SmartReply AI Debug] ✉️ Sending Email Thread to Gemini (${payload.action})`, 'color: #0f6a6d; font-weight: bold;');
            console.log('Subject:', state.context.subject);
            console.log('Sender:', state.context.sender);
            console.log('Latest Body:\n', state.context.latestBody);
            console.log('Thread History:\n', state.context.threadHistory);
            console.log('Full Request Payload:\n', payload);
            console.groupEnd();
          } else {
            console.groupCollapsed(`%c[SmartReply AI Debug] ✉️ Requesting Drafts (${payload.action})`, 'color: #0f6a6d; font-weight: bold;');
            console.log('Subject length:', state.context.subject ? `${state.context.subject.length} chars` : '0 chars');
            console.log('Sender:', state.context.sender || 'Unknown');
            console.log('Thread history size:', state.context.threadHistory ? `${state.context.threadHistory.length} chars` : '0 chars');
            console.log('Latest email body size:', state.context.latestBody ? `${state.context.latestBody.length} chars` : '0 chars');
            console.log('Tone:', payload.toneOverride, '| Length:', payload.lengthOverride);
            if (useCustomInstruction) console.log('Custom instruction length:', instruction.length);
            console.log('🔒 Full email text omitted for privacy. Enable "Include full email text in logs" in Settings to inspect raw text.');
            console.groupEnd();
          }
        }

        try {
          runtime.sendMessage(payload, (response) => {
            window.clearTimeout(timeout);
            if (requestId !== state.requestId) return;
            setLoading(false);

            if (saved.debugMode) {
              if (saved.debugFullContent) {
                console.log('%c[SmartReply AI Debug] ✨ Response from Background / Gemini:', 'color: #207659; font-weight: bold;', response);
              } else {
                console.log('%c[SmartReply AI Debug] ✨ Drafts received:', 'color: #207659; font-weight: bold;', {
                  success: response?.success,
                  modelUsed: response?.modelUsed,
                  optionCount: response?.options?.length,
                  hasCustomReply: Boolean(response?.replyText)
                });
              }
            }

            if (runtime.lastError) {
              showPanelError(disconnectedMessage);
              return;
            }
            if (!response?.success) {
              showPanelError(response?.message || 'Could not create a draft. Check SmartReply settings.');
              return;
            }

            regenerateButton.textContent = 'Regenerate';
            if (useCustomInstruction) {
              state.customReply = response.replyText;
              state.selectedIndex = -1;
              renderSelectedDraft('Custom draft', response.replyText);
              optionsList.querySelectorAll('button').forEach((button) => button.classList.remove('smartreply-selected'));
            } else {
              state.options = response.options;
              state.selectedIndex = 0;
              renderOptions();
            }

            modelBadge.textContent = response.modelUsed || 'Google Gemini';
            requestAnimationFrame(() => positionPopover(trigger, popover));
          });
        } catch (error) {
          window.clearTimeout(timeout);
          if (requestId !== state.requestId) return;
          setLoading(false);
          showPanelError(disconnectedMessage);
        }
      });
    }

    function renderOptions() {
      optionsList.replaceChildren();
      state.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `smartreply-option${index === state.selectedIndex ? ' smartreply-selected' : ''}`;
        button.setAttribute('aria-pressed', String(index === state.selectedIndex));

        const title = document.createElement('strong');
        title.textContent = option.title;
        const description = document.createElement('span');
        description.textContent = option.description;
        button.append(title, description);

        button.addEventListener('click', () => {
          state.selectedIndex = index;
          state.customReply = '';
          optionsList.querySelectorAll('button').forEach((item, itemIndex) => {
            const selected = itemIndex === index;
            item.classList.toggle('smartreply-selected', selected);
            item.setAttribute('aria-pressed', String(selected));
          });
          renderSelectedDraft(index === 0 ? 'Best fit' : option.title, option.reply);
        });

        optionsList.appendChild(button);
      });

      const selected = state.options[state.selectedIndex];
      if (selected) renderSelectedDraft('Best fit', selected.reply);
    }

    function renderSelectedDraft(label, reply) {
      contextLabel.textContent = label;
      preview.classList.remove('smartreply-error');
      preview.textContent = reply;
      insertButton.disabled = !reply;
    }

    function showPanelError(message) {
      preview.classList.add('smartreply-error');
      preview.textContent = message;
      contextLabel.textContent = 'Needs attention';
      insertButton.disabled = true;
      requestAnimationFrame(() => positionPopover(trigger, popover));
    }

    function setLoading(isLoading, title, subtitle) {
      if (title) loadingTitle.textContent = title;
      if (subtitle) loadingSubtitle.textContent = subtitle;
      loadingOverlay.classList.toggle('smartreply-active', isLoading);
      loadingOverlay.setAttribute('aria-busy', String(isLoading));
    }
  }

  function positionPopover(trigger, popover) {
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(420, window.innerWidth - 24);
    popover.style.width = `${width}px`;

    let left = rect.left - 20;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));

    const height = Math.min(popover.offsetHeight || 600, window.innerHeight - 24);
    let top = rect.top - height - 10;
    if (top < 12) top = Math.min(rect.bottom + 8, window.innerHeight - height - 12);

    popover.style.left = `${left}px`;
    popover.style.top = `${Math.max(12, top)}px`;
  }

  function closeAllPopovers(except) {
    document.querySelectorAll('.smartreply-popover').forEach((popover) => {
      if (popover !== except) popover.classList.add('smartreply-hidden');
    });
  }

  function removeOrphanedPopovers() {
    document.querySelectorAll('.smartreply-popover').forEach((popover) => {
      if (popover.smartreplyComposeContainer && !popover.smartreplyComposeContainer.isConnected) {
        popover.remove();
      }
    });
  }

  function applyContentAppearance(element, settings) {
    const theme = settings.colorTheme === 'rose' ? 'rose' : 'teal';
    const preference = ['light', 'dark', 'system'].includes(settings.appearanceMode)
      ? settings.appearanceMode
      : 'system';
    const resolvedMode = preference === 'system'
      ? (systemDarkQuery.matches ? 'dark' : 'light')
      : preference;

    element.dataset.smartreplyTheme = theme;
    element.dataset.smartreplyMode = resolvedMode;
  }

  function refreshContentAppearance() {
    getLocalSettings(['colorTheme', 'appearanceMode'], (saved) => {
      document.querySelectorAll('.smartreply-circle-btn, .smartreply-popover').forEach((element) => {
        applyContentAppearance(element, saved);
      });
    });
  }

  function extractThreadContext(composeContainer) {
    const subjectElement = document.querySelector('h2.hP, h2[data-thread-perm-id]');
    const subject = subjectElement?.innerText?.trim() ||
      document.title.replace(/ - [^ -]+@.+ - Gmail/i, '').replace(/ - Gmail/i, '').trim();

    let messageContainers = [...document.querySelectorAll('div.adn.ads')];
    if (!messageContainers.length) {
      messageContainers = [...document.querySelectorAll('div[role="listitem"]')]
        .filter((element) => element.querySelector('.a3s.aiL, .ii.gt'));
    }

    const seenBodies = new Set();
    const messages = [];

    messageContainers.forEach((message, index) => {
      const body = message.querySelector('.a3s.aiL, .ii.gt');
      if (!body || (composeContainer.contains(body) && body.isContentEditable)) return;

      const clone = body.cloneNode(true);
      clone.querySelectorAll('.gmail_quote, .gmail_extra, blockquote, script, style').forEach((element) => element.remove());
      const text = (clone.innerText || clone.textContent || '').trim();
      const signature = text.slice(0, 500);
      if (!text || seenBodies.has(signature)) return;
      seenBodies.add(signature);

      const senderElement = message.querySelector('.gD, span[email], .zF');
      const sender = senderElement?.getAttribute('name') || senderElement?.innerText?.trim() || senderElement?.getAttribute('email') || `Participant ${index + 1}`;
      const time = message.querySelector('.g3, .date')?.innerText?.trim() || '';
      messages.push({ sender, time, body: text });
    });

    const recentMessages = messages.slice(-8);
    const latest = recentMessages.at(-1) || {};
    const threadHistory = recentMessages
      .map((message, index) => `[Message ${index + 1} — ${message.sender}${message.time ? ` — ${message.time}` : ''}]\n${message.body}`)
      .join('\n\n---\n\n')
      .slice(-24000);

    return {
      subject: subject.slice(0, 500),
      sender: String(latest.sender || '').slice(0, 300),
      latestBody: String(latest.body || '').slice(0, 8000),
      threadHistory
    };
  }

  function findComposeBox(container) {
    return container.querySelector('div[role="textbox"][contenteditable="true"], div[aria-label*="Message Body"], .Am.Al.editable, div[g_editable="true"]') ||
      document.querySelector('div[role="textbox"][contenteditable="true"]');
  }

  function insertReplyText(composeBox, text) {
    if (!composeBox) {
      showNotification('Click inside the Gmail reply box, then try again.', 'error');
      return false;
    }

    composeBox.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(composeBox);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    const formatted = String(text)
      .split('\n\n')
      .map((paragraph) => `<div>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</div>`)
      .join('<div><br></div>');
    const spacer = composeBox.innerText.trim() ? '<div><br></div>' : '';

    const inserted = document.execCommand('insertHTML', false, spacer + formatted + '<div><br></div>');
    if (!inserted) composeBox.insertAdjacentHTML('beforeend', spacer + formatted + '<div><br></div>');

    composeBox.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return true;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showNotification(message, type = 'info') {
    let toast = document.querySelector('.smartreply-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'smartreply-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }

    toast.className = `smartreply-toast smartreply-toast-${type} smartreply-toast-show`;
    toast.textContent = message;
    window.setTimeout(() => toast.classList.remove('smartreply-toast-show'), 4000);
  }

  document.addEventListener('click', () => closeAllPopovers());
  document.addEventListener('focusin', (event) => {
    if (event.target?.getAttribute?.('contenteditable') === 'true') scheduleScan();
  });

  const storageChanges = globalThis.chrome?.storage?.onChanged;
  if (storageChanges?.addListener) {
    storageChanges.addListener((changes, areaName) => {
      if (areaName === 'local' && (changes.colorTheme || changes.appearanceMode)) {
        refreshContentAppearance();
      }
    });
  }

  systemDarkQuery.addEventListener('change', () => {
    getLocalSettings(['appearanceMode'], (saved) => {
      if (!saved.appearanceMode || saved.appearanceMode === 'system') refreshContentAppearance();
    });
  });

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
  scanAndInject();
})();
