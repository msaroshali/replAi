/**
 * SmartReply AI — Professional Gmail Content Script
 * Injects context-aware AI reply controls into Gmail formatting & compose toolbars
 * with full thread history extraction and dual-injection guarantee.
 */

(function () {
  'use strict';

  console.log('[SmartReply AI] Gmail Content Script Initialized.');

  const injectedElements = new WeakSet();

  /**
   * Main scan function: Finds the icon toolbar on the right of the Send button
   */
  function scanAndInjectAll() {
    const iconToolbars = document.querySelectorAll(
      'td.gU.Up, div.gU.Up, div.aDh, .btC, tr.btC'
    );

    iconToolbars.forEach((toolbar) => {
      if (injectedElements.has(toolbar)) return;

      const hasTools = toolbar.querySelector('[command="Files"], [aria-label*="Attach"], [aria-label*="Format"], [command="+formatting"], .aoO, .dC');
      if (hasTools || toolbar.classList.contains('Up') || toolbar.classList.contains('aDh')) {
        injectCircularToolbarButton(toolbar);
        injectedElements.add(toolbar);
      }
    });
  }

  /**
   * Injects a single, beautiful circular icon button (pen + golden lightning) next to Loom button
   */
  function injectCircularToolbarButton(toolbar) {
    if (toolbar.querySelector('.smartreply-btn-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'smartreply-btn-wrapper';

    // Circular Icon Button (Pen + Golden Lightning with clear separation)
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'smartreply-circle-btn';
    btn.setAttribute('title', 'SmartReply AI: Generate Email Reply');
    btn.setAttribute('aria-label', 'SmartReply AI');
    btn.innerHTML = `
      <svg class="smartreply-pen-lightning-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Blue Pen (Shifted Down-Left) -->
        <g transform="translate(-1.5, 1.5) scale(0.82)">
          <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25Z" fill="#2563eb"/>
          <path d="M20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z" fill="#1d4ed8"/>
        </g>
        <!-- Golden / Yellow Lightning Bolt (Shifted Top-Right for Clear Spacing) -->
        <g transform="translate(6.5, -1) scale(0.78)">
          <path d="M12 1L7 9H12L10 16L17 7H12L14 1H12Z" fill="#fbbf24" stroke="#d97706" stroke-width="1.2" stroke-linejoin="round"/>
        </g>
      </svg>
    `;

    const composeContainer = toolbar.closest('.M9, .AD, div[role="dialog"], table.cf') || document;
    
    // Create popover mounted to document.body to avoid clipping
    const popover = createPopoverElement(composeContainer);
    document.body.appendChild(popover);

    wrapper.appendChild(btn);

    // Target the tr or container to place right next to Loom button
    const tr = toolbar.closest('tr.btC') || (toolbar.tagName.toLowerCase() === 'tr' ? toolbar : null);
    if (tr) {
      const td = document.createElement('td');
      td.className = 'smartreply-button-td';
      td.style.verticalAlign = 'middle';
      td.appendChild(wrapper);

      const loomTd = tr.querySelector('.loom-button-td');
      if (loomTd && loomTd.nextSibling) {
        tr.insertBefore(td, loomTd.nextSibling);
      } else {
        const formatTd = tr.querySelector('td.oc.gU, td.a8X.gU');
        if (formatTd) {
          tr.insertBefore(td, formatTd);
        } else {
          tr.appendChild(td);
        }
      }
    } else {
      const rightIconContainer = toolbar.querySelector('.aDh, .gU.Up, td.gU.Up') || toolbar;
      const formattingIcon = rightIconContainer.querySelector('[command="+formatting"], [aria-label*="Formatting"], [command="Files"]');
      if (formattingIcon && formattingIcon.parentElement) {
        formattingIcon.parentElement.insertBefore(wrapper, formattingIcon);
      } else if (rightIconContainer.firstChild) {
        rightIconContainer.insertBefore(wrapper, rightIconContainer.firstChild);
      } else {
        rightIconContainer.appendChild(wrapper);
      }
    }

    bindPopoverEvents(btn, popover, composeContainer);
  }

  /**
   * Builds the sleek, modern popover DOM element
   */
  function createPopoverElement(composeContainer) {
    const popover = document.createElement('div');
    popover.className = 'smartreply-popover smartreply-hidden';
    popover.innerHTML = `
      <div class="smartreply-popover-header">
        <div class="smartreply-brand">
          <svg class="smartreply-brand-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2Z" />
          </svg>
          <span class="smartreply-brand-title">SmartReply AI</span>
        </div>
        <button type="button" class="smartreply-close-btn" title="Close">&times;</button>
      </div>

      <!-- Popover Body -->
      <div class="smartreply-popover-body">
        <div class="smartreply-section-title">SUGGESTED REPLIES</div>

        <!-- Dynamic Contextual Options List -->
        <div class="smartreply-options-list"></div>

        <!-- Custom Prompt Input -->
        <div class="smartreply-custom-section">
          <div class="smartreply-input-wrapper">
            <input type="text" class="smartreply-custom-input" placeholder="Draft custom reply instruction..." />
            <button type="button" class="smartreply-submit-btn" title="Generate Custom Reply">
              <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>

        <div class="smartreply-model-badge">✨ Powered by Gemini</div>
      </div>

      <!-- Loading State Overlay -->
      <div class="smartreply-loading-overlay">
        <div class="smartreply-spinner"></div>
        <div class="smartreply-loading-title">Analyzing thread...</div>
        <div class="smartreply-loading-subtitle">Crafting the perfect response</div>
      </div>
    `;

    return popover;
  }

  /**
   * Binds popover interactions and auto-analysis
   */
  function bindPopoverEvents(triggerBtn, popover, composeContainer) {
    const closeBtn = popover.querySelector('.smartreply-close-btn');
    const customInput = popover.querySelector('.smartreply-custom-input');
    const submitBtn = popover.querySelector('.smartreply-submit-btn');
    const optionsList = popover.querySelector('.smartreply-options-list');
    const loadingOverlay = popover.querySelector('.smartreply-loading-overlay');

    const refreshBadge = () => {
      chrome.storage.local.get(['selectedModel', 'lastUsedModel'], (res) => {
        const badge = popover.querySelector('.smartreply-model-badge');
        if (badge) {
          const model = res.lastUsedModel || res.selectedModel || 'gemini-3.1-flash-lite';
          badge.textContent = `⚡ Powered by ${model}`;
        }
      });
    };

    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('%c[SmartReply AI] AI Button Clicked -> Analyzing thread context...', 'color: #2563eb; font-weight: bold;');
      const isHidden = popover.classList.contains('smartreply-hidden');
      closeAllPopovers();

      if (isHidden) {
        refreshBadge();
        popover.classList.remove('smartreply-hidden');

        // Dynamically position popover directly above the button
        const rect = triggerBtn.getBoundingClientRect();
        const popoverWidth = 330;
        const popoverHeight = 310;

        let left = rect.left - 20;
        if (left + popoverWidth > window.innerWidth - 16) {
          left = window.innerWidth - popoverWidth - 16;
        }
        if (left < 16) left = 16;

        let top = rect.top - popoverHeight - 12;
        if (top < 16) top = rect.bottom + 8;

        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;

        // Show loading overlay instead of skeletons
        if (loadingOverlay) {
          const title = loadingOverlay.querySelector('.smartreply-loading-title');
          const sub = loadingOverlay.querySelector('.smartreply-loading-subtitle');
          if (title) title.textContent = 'Analyzing conversation...';
          if (sub) sub.textContent = 'Sending request & awaiting response';
          loadingOverlay.classList.add('smartreply-active');
        }
        optionsList.innerHTML = '';

        // Extract context and ask Gemini to suggest tailored options with pre-generated replies
        const context = extractFullThreadContext(composeContainer);
        const payload = {
          action: 'ANALYZE_AND_PREGENERATE',
          subject: context.subject,
          sender: context.sender,
          threadHistory: context.threadHistory,
          emailContent: context.latestBody
        };

        console.log('[SmartReply AI] Sending thread context to Gemini:', payload);

        chrome.runtime.sendMessage(payload, (response) => {
          if (loadingOverlay) loadingOverlay.classList.remove('smartreply-active');

          if (chrome.runtime.lastError || !response || !response.success || !Array.isArray(response.options)) {
            console.warn('[SmartReply AI] Auto-analysis error:', response || chrome.runtime.lastError);
            optionsList.innerHTML = `
              <div style="padding: 12px; font-size: 12px; color: #ef4444; text-align: center;">
                ${response?.message || 'Could not analyze thread. Please verify API key in extension settings.'}
              </div>
            `;
            return;
          }

          console.log(`%c[SmartReply AI] Received ${response.options.length} contextual options!`, 'color: #10b981; font-weight: bold;', response.options);

          // Render options
          optionsList.innerHTML = '';
          response.options.forEach((opt) => {
            const card = document.createElement('div');
            card.className = 'smartreply-option-card';
            card.innerHTML = `
              <div class="smartreply-option-header">
                <span class="smartreply-option-emoji">${opt.emoji || '💬'}</span>
                <span class="smartreply-option-title">${escapeHtml(opt.title || 'Reply Option')}</span>
              </div>
              <div class="smartreply-option-desc">${escapeHtml(opt.description || '')}</div>
            `;

            // Instant 0ms insertion on click!
            card.addEventListener('click', () => {
              console.log(`%c[SmartReply AI] Option Selected: "${opt.title}" -> Inserting reply...`, 'color: #10b981; font-weight: bold;');
              const composeBox = findComposeBox(composeContainer);
              insertReplyText(composeBox, opt.reply);
              popover.classList.add('smartreply-hidden');
              showNotification(`✨ Inserted: "${opt.title}"`, 'success');
            });

            optionsList.appendChild(card);
          });
        });
      }
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.classList.add('smartreply-hidden');
    });

    popover.addEventListener('click', (e) => e.stopPropagation());

    submitBtn.addEventListener('click', () => {
      const instruction = customInput.value.trim();
      if (!instruction) return;

      if (loadingOverlay) {
        const title = loadingOverlay.querySelector('.smartreply-loading-title');
        const sub = loadingOverlay.querySelector('.smartreply-loading-subtitle');
        if (title) title.textContent = 'Drafting custom reply...';
        if (sub) sub.textContent = 'Calibrating tone with Gemini';
        loadingOverlay.classList.add('smartreply-active');
      }
      const composeBox = findComposeBox(composeContainer);
      const context = extractFullThreadContext(composeContainer);

      chrome.runtime.sendMessage({
        action: 'GENERATE_CUSTOM',
        subject: context.subject,
        sender: context.sender,
        threadHistory: context.threadHistory,
        emailContent: context.latestBody,
        customInstruction: instruction
      }, (res) => {
        if (loadingOverlay) loadingOverlay.classList.remove('smartreply-active');
        popover.classList.add('smartreply-hidden');
        if (res && res.success && res.replyText) {
          insertReplyText(composeBox, res.replyText);
          showNotification('Custom reply drafted & inserted!', 'success');
        } else {
          showNotification(res?.message || 'Failed to draft custom reply.', 'error');
        }
      });
    });

    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitBtn.click();
      }
    });
  }

  function closeAllPopovers() {
    document.querySelectorAll('.smartreply-popover').forEach((p) => {
      p.classList.add('smartreply-hidden');
    });
  }

  document.addEventListener('click', () => {
    closeAllPopovers();
  });

  /**
   * Extracts full thread history and triggers generation with rich console logs
   */
  async function triggerReplyGeneration(composeContainer, popover, options) {
    const loadingOverlay = popover.querySelector('.smartreply-loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.add('smartreply-active');

    console.log('%c==============================================================', 'color: #2563eb;');
    console.log('%c[SmartReply AI] Step 1: Starting Reply Generation...', 'color: #2563eb; font-weight: bold;');

    let composeBox = null;
    let context = { subject: '', sender: '', latestBody: '', threadHistory: '' };

    try {
      composeBox = findComposeBox(composeContainer);
      console.log('[SmartReply AI] Compose Box Located:', composeBox);

      context = extractFullThreadContext(composeContainer);
      console.log('[SmartReply AI] Extracted Subject:', context.subject);
      console.log('[SmartReply AI] Extracted Sender:', context.sender);
      console.log('[SmartReply AI] Extracted Thread History:\n', context.threadHistory || context.latestBody);
    } catch (extractErr) {
      console.error('[SmartReply AI] Context Extraction Error:', extractErr);
    }

    const payload = {
      action: 'GENERATE_REPLY',
      subject: context.subject,
      sender: context.sender,
      threadHistory: context.threadHistory,
      emailContent: context.latestBody,
      quickMood: options.quickMood || 'auto',
      customInstruction: options.customInstruction || ''
    };

    console.log('[SmartReply AI] Step 2: Sending Payload to Background Service Worker:', payload);

    // Client-side safety timeout: never allow spinner to freeze longer than 10 seconds
    const safetyTimer = setTimeout(() => {
      if (loadingOverlay) loadingOverlay.classList.remove('smartreply-active');
      popover.classList.add('smartreply-hidden');
      console.error('[SmartReply AI] Error: Background service worker timed out after 10s.');
      showNotification('Request timed out. Open DevTools (F12) to see details.', 'error');
    }, 10000);

    try {
      chrome.runtime.sendMessage(payload, (response) => {
        clearTimeout(safetyTimer);
        if (loadingOverlay) loadingOverlay.classList.remove('smartreply-active');
        popover.classList.add('smartreply-hidden');

        console.log('%c[SmartReply AI] Step 3: Response Received from Background:', 'color: #10b981; font-weight: bold;', response);

        if (chrome.runtime.lastError) {
          console.error('[SmartReply AI] chrome.runtime.lastError:', chrome.runtime.lastError.message);
          showNotification(`Extension error: ${chrome.runtime.lastError.message}`, 'error');
          return;
        }

        if (!response) {
          console.error('[SmartReply AI] No response returned from background worker.');
          showNotification('No response received from background service. Please reload Gmail.', 'error');
          return;
        }

        if (response.success && response.replyText) {
          console.log(`%c[SmartReply AI] Step 4: Successfully Generated Text using ${response.modelUsed}:\n`, 'color: #10b981; font-weight: bold;', response.replyText);
          insertReplyText(composeBox, response.replyText);
          const modelTag = response.modelUsed ? ` (via ${response.modelUsed})` : '';
          showNotification(`Reply generated & inserted${modelTag}!`, 'success');
        } else {
          console.error('[SmartReply AI] Generation Failed. Error details:', response);
          if (response.error === 'NO_API_KEY') {
            showNotification('🔑 Please set your Gemini API Key in extension settings.', 'warning');
          } else {
            let errorText = response.message || response.error || 'Failed to generate reply.';
            if (typeof errorText === 'string' && errorText.includes('API_KEY_INVALID')) {
              errorText = 'API key invalid. Please verify in extension settings.';
            }
            showNotification(`✕ ${errorText}`, 'error');
          }
        }
        console.log('%c==============================================================', 'color: #2563eb;');
      });
    } catch (err) {
      clearTimeout(safetyTimer);
      if (loadingOverlay) loadingOverlay.classList.remove('smartreply-active');
      popover.classList.add('smartreply-hidden');
      console.error('[SmartReply AI] Critical Message Dispatch Error:', err);
      showNotification('Extension disconnected. Please refresh Gmail.', 'error');
    }
  }

  /**
   * Deep Thread Extractor: Collects full conversation history and timeline
   */
  function extractFullThreadContext(composeContainer) {
    let subject = '';
    let sender = '';
    let latestBody = '';
    let threadHistory = '';

    const subjectEl = document.querySelector('h2.hP, h2[data-thread-perm-id], [data-legacy-thread-id]');
    if (subjectEl) {
      subject = subjectEl.innerText.trim();
    } else {
      subject = document.title.replace(/ - [^ -]+@.+ - Gmail/i, '').replace(/ - Gmail/i, '').trim();
    }

    const messageContainers = document.querySelectorAll(
      'div[role="listitem"], div.adn.ads, div.kv, div.h7, div.gs'
    );

    const historyItems = [];

    if (messageContainers.length > 0) {
      messageContainers.forEach((msgEl, index) => {
        const senderNameEl = msgEl.querySelector('.gD, span[email], .zF');
        const senderText = senderNameEl ? (senderNameEl.getAttribute('name') || senderNameEl.innerText || senderNameEl.getAttribute('email')) : `Participant ${index + 1}`;
        const timeEl = msgEl.querySelector('.g3, .date');
        const timeText = timeEl ? timeEl.innerText.trim() : '';

        const bodyEl = msgEl.querySelector('.a3s.aiL, .ii.gt');
        if (bodyEl) {
          const clone = bodyEl.cloneNode(true);
          const quotes = clone.querySelectorAll('.gmail_quote, .gmail_extra, blockquote');
          quotes.forEach((q) => q.remove());
          const cleanBody = clone.innerText.trim();

          if (cleanBody) {
            historyItems.push(`[Message ${index + 1} from ${senderText}${timeText ? ' at ' + timeText : ''}]:\n${cleanBody}`);
            sender = senderText;
            latestBody = cleanBody;
          }
        }
      });
    }

    if (historyItems.length === 0) {
      const bodies = document.querySelectorAll('.a3s.aiL, .ii.gt');
      bodies.forEach((b, idx) => {
        const clone = b.cloneNode(true);
        const quotes = clone.querySelectorAll('.gmail_quote, .gmail_extra, blockquote');
        quotes.forEach((q) => q.remove());
        const text = clone.innerText.trim();
        if (text) {
          historyItems.push(`[Email ${idx + 1}]:\n${text}`);
          latestBody = text;
        }
      });

      const senderEls = document.querySelectorAll('.gD, span[email], .zF');
      if (senderEls.length > 0) {
        const last = senderEls[senderEls.length - 1];
        sender = last.getAttribute('name') || last.innerText || last.getAttribute('email') || '';
      }
    }

    threadHistory = historyItems.join('\n\n---\n\n');

    return { subject, sender, latestBody, threadHistory };
  }

  /**
   * Find Gmail compose editor
   */
  function findComposeBox(container) {
    return container.querySelector(
      'div[role="textbox"][contenteditable="true"], div[aria-label*="Message Body"], .Am.Al.editable, div[g_editable="true"]'
    ) || document.querySelector('div[role="textbox"][contenteditable="true"]');
  }

  /**
   * Insert reply into Gmail editor
   */
  function insertReplyText(composeBox, text) {
    if (!composeBox) {
      showNotification('Please click inside the reply message box first.', 'error');
      return;
    }

    composeBox.focus();

    const formattedHtml = text
      .split('\n\n')
      .map((p) => `<div>${escapeHtml(p).replace(/\n/g, '<br>')}</div>`)
      .join('<div><br></div>');

    const successful = document.execCommand('insertHTML', false, formattedHtml + '<div><br></div>');
    if (!successful) {
      const existing = composeBox.innerHTML;
      composeBox.innerHTML = formattedHtml + '<div><br></div>' + existing;
    }

    composeBox.dispatchEvent(new Event('input', { bubbles: true }));
    composeBox.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function escapeHtml(str) {
    return str
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
      document.body.appendChild(toast);
    }

    toast.className = `smartreply-toast smartreply-toast-${type} smartreply-toast-show`;
    toast.textContent = message;

    setTimeout(() => {
      toast.classList.remove('smartreply-toast-show');
    }, 4500);
  }

  // Observers & Events
  const observer = new MutationObserver(() => {
    scanAndInjectAll();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  document.addEventListener('click', () => {
    setTimeout(scanAndInjectAll, 100);
  });

  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.getAttribute && e.target.getAttribute('contenteditable') === 'true') {
      scanAndInjectAll();
    }
  });

  scanAndInjectAll();
  setInterval(scanAndInjectAll, 800);
})();
