# SmartReply AI for Gmail

<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="SmartReply AI logo">
</p>

<p align="center">
  <strong>Open-source, review-first email drafting inside Gmail.</strong>
</p>

SmartReply AI is an open-source Chrome extension that creates context-aware Gmail reply drafts with Google Gemini and your own API key. It reads the current conversation only after you request a draft, presents four possible reply directions, and lets you review the complete text before inserting it.

**SmartReply never clicks Send.** You remain responsible for reviewing and sending every email.

## Highlights

- Four context-aware reply directions, with the best fit shown first.
- Full draft preview before anything is inserted into Gmail.
- Custom drafting notes such as “Agree to Thursday at 2 PM” or “Ask for the updated deck.”
- Professional, direct, friendly, and formal tone options.
- Short, medium, and detailed response lengths.
- Automatic matching of the latest email’s language.
- Optional sign-off name and subtle emoji preference.
- Teal and Rose themes with Light, Dark, and Follow System modes.
- Automatic Gemini API-key verification.
- Configurable primary model with automatic fallback.
- Explicit consent that can be revoked at any time.
- No SmartReply account, analytics SDK, telemetry, or developer-operated backend.
- No build step and no third-party runtime dependencies.

## What is new in 1.4.0

- Redesigned popup with a clearer setup-first layout.
- Collapsible privacy and API-key sections with visible connection states.
- Dedicated Help and Preferences drawers.
- Built-in step-by-step Gmail usage guidance.
- Appearance and model controls moved out of the main setup flow.
- Optional developer debug mode for inspecting generation requests and responses.
- Improved status labels for setup, checking, ready, paused, and key-error states.
- Continued protection against stale extension contexts after reloading the extension.
- Reliable Gmail toolbar placement near Send and immediately before the **Aa** formatting control.

## How it works

1. Open an email thread in Gmail and click **Reply** or **Reply all**.
2. Click the SmartReply icon in the compose toolbar.
3. SmartReply extracts a limited amount of recent thread context.
4. The extension sends that context directly to Google Gemini using your API key.
5. Gemini returns four structured reply options.
6. Select an option, adjust the tone or length, or add a custom instruction.
7. Click **Insert draft** to place the selected text into Gmail.
8. Review and send the email yourself.

## Install locally

### Requirements

- Google Chrome or another compatible Chromium browser.
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Installation

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the project folder containing `manifest.json`.
6. Open the SmartReply popup from Chrome’s extensions menu.
7. Review and accept the data-sharing disclosure.
8. Paste your Gemini API key and wait for the automatic verification.
9. Click **Save settings**.
10. Refresh Gmail.

There is no `npm install`, build, or `node_modules` step. The extension runs directly from its HTML, CSS, and JavaScript source files.

## Settings

### Draft defaults

- **Tone:** Professional, Direct, Friendly, or Formal.
- **Length:** Short, Medium, or Detailed.
- **Sign-off name:** An optional name Gemini may use when a sign-off is appropriate.
- **Emoji:** Optionally allow one subtle emoji when it genuinely fits.

### Appearance

- **Color theme:** Teal or Rose.
- **Mode:** Follow System, Light, or Dark.

Appearance settings apply to both the extension popup and the Gmail drafting panel.

After changing drawer settings, return to the main popup and click **Save settings**.

### Model selection

Choose a preferred Gemini model in **Preferences & Models**. If it is unavailable or temporarily rate-limited, SmartReply can try a supported fallback model.

### Debug mode

Debug mode is intended only for local development and is disabled by default.

> **Sensitive-data warning:** Debug mode writes the email subject, sender, thread content, drafting instructions, prompts, generated drafts, and provider responses to browser developer consoles. Do not enable it while processing confidential, work-related, or personal email unless you understand and accept that exposure. Disable it again when troubleshooting is complete.

The Gemini API key itself is not intentionally written to the console.

## Privacy and security

SmartReply is designed around explicit user action and minimal permissions:

- Your Gemini API key is stored in `chrome.storage.local` in your Chrome profile.
- The key is sent to Gemini in the `x-goog-api-key` request header, not in the request URL.
- Email content is processed only when you open the SmartReply draft panel or regenerate a draft.
- Recent thread context is capped before transmission.
- Email content is treated as untrusted data in the system prompt.
- Gemini responses use a JSON schema and are validated before display.
- Requests set `store: false` where supported by the Gemini API.
- SmartReply has no developer-operated proxy server.
- SmartReply does not include analytics, telemetry, advertising, or tracking code.
- SmartReply cannot and does not send email automatically.

Email content is still transmitted to Google Gemini. Google’s terms and the privacy conditions of your Gemini plan govern Google’s processing. Do not use SmartReply with messages you are not authorized to share with the selected AI provider.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `storage` | Stores the API key, consent choice, drafting preferences, theme, and connection state locally. |
| `https://mail.google.com/*` | Adds the SmartReply control to Gmail and reads the active thread after a user request. |
| `https://generativelanguage.googleapis.com/*` | Sends authorized generation and API-key verification requests to Gemini. |

## Project structure

```text
replAi/
├── manifest.json
├── content/
│   ├── content.js        # Gmail integration, context extraction, and draft insertion
│   └── content.css       # Gmail toolbar and drafting-panel styles
├── popup/
│   ├── popup.html        # Settings, help, consent, and connection UI
│   ├── popup.css         # Popup themes and layout
│   └── popup.js          # Settings persistence and API-key verification
├── src/
│   └── background.js     # Gemini requests, prompts, validation, and model fallback
├── icons/                # Extension and toolbar artwork
├── tests/                # Local behavior and regression tests
└── scripts/              # Development utilities
```

## Development

Open the project folder directly in Visual Studio Code. No dependency installation is required.

Run the automated checks with:

```bash
npm test
```

The tests use Node.js’s built-in test runner. After changing extension code:

1. Save the files.
2. Open `chrome://extensions`.
3. Click **Reload** on SmartReply AI.
4. Fully refresh Gmail with `Ctrl + Shift + R`.

If multiple copies of SmartReply are installed, disable the older versions before testing.

## Testing checklist

Before each release, manually verify:

- A new Gmail reply.
- Reply all.
- A pop-out compose window.
- Multiple open compose windows.
- Collapsed and expanded email threads.
- Long conversations and quoted replies.
- English and non-English Gmail interfaces.
- Keyboard-only navigation.
- Light and dark appearance modes.
- Consent revocation.
- Invalid, expired, and rate-limited API keys.
- Extension reload followed by a full Gmail refresh.

Gmail’s internal DOM is not a public API and can change without notice, so toolbar placement and context extraction require ongoing regression testing.

## Creating a release ZIP

The Chrome Web Store archive must contain `manifest.json` at the ZIP root. Do not package the parent `replAi` directory itself.

Exclude development and repository files such as:

- `.git/`
- Existing `.zip` archives
- Test output
- Editor configuration and operating-system metadata

Never upload a release ZIP containing the Git repository history. Keep a separate clean release archive for the Chrome Web Store.

## Current limitations

- Gmail only.
- Requires the user’s own Gemini API key.
- Does not read attachments.
- Does not automatically send, schedule, or approve email.
- Gmail UI changes may temporarily affect toolbar placement or thread extraction.
- Debug mode can expose email content in local developer consoles when enabled.

## Contributing

Bug reports and focused pull requests are welcome. When reporting a Gmail integration problem, include:

- Chrome version.
- Gmail interface language.
- Compose mode: reply, reply all, new message, or pop-out.
- SmartReply version.
- Reproduction steps.
- Sanitized console output, with all personal email content and API credentials removed.

Do not submit real email conversations, personal information, or API keys in issues.

## License

The project currently declares the ISC license in `package.json`. Add a root `LICENSE` file before the public open-source release so the licensing terms are explicit to contributors and users.
