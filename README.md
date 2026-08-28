# SmartReply AI for Gmail

SmartReply AI adds a review-first reply panel to Gmail. It reads the current thread only when you open the panel, drafts four context-aware reply directions with Google Gemini, and lets you preview a complete draft before inserting it into Gmail.

It never clicks Send.

## What changed in 1.3.2

- Prevents stale or unavailable extension storage APIs from crashing Gmail's compose toolbar.
- Falls back to the default appearance when settings cannot be read.
- Shows a clear **Refresh Gmail** message when the extension was updated or reloaded while Gmail remained open.
- Guards background messaging and live theme updates when the extension context is unavailable.

## What changed in 1.3.1

- Places the SmartReply toolbar action directly before Gmail's **Aa** control, after Send and other compose actions such as Loom.
- Uses Gmail's language-independent formatting command as the primary toolbar anchor.
- Removes the permanent outer button box so the reply mark sits cleanly beside Gmail's native and third-party controls.

## What changed in 1.3.0

- Accepted data disclosure collapses into a compact privacy row instead of occupying the popup.
- Consent can be revoked and saved normally; doing so clearly pauses generation without deleting other settings.
- API keys are checked automatically after paste or a short typing pause. **Check now** remains available only as a manual retry.
- Added Teal and Rose color themes.
- Added Light, Dark, and Follow System appearance modes across the popup and Gmail compose panel.
- Theme changes propagate to open Gmail tabs after settings are saved.

## What changed in 1.2.0

- New compose panel built around **preview → choose direction → insert**.
- New unified teal reply-mark identity across the toolbar, popup, and store icons.
- Clear first-run data disclosure and explicit consent setting.
- Email content is treated as untrusted data in the Gemini system prompt.
- Gemini JSON schema output plus local validation for exactly four complete choices.
- Gemini requests opt out of API-side storage with `store: false`.
- Tone and length controls work in both settings and the compose panel.
- Custom drafting notes produce a preview instead of inserting immediately.
- No email subject, sender, body, draft, or API key is written to the console.
- No continuous polling loop; Gmail changes are handled with a scheduled mutation observer.
- No build step or third-party runtime dependency.

## Install locally

1. Download and unzip the project.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and choose this project folder.
5. Open the extension popup.
6. Read and accept the data disclosure, add a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey), and save.
7. Refresh Gmail.

## Use in Gmail

1. Open a thread and click **Reply**.
2. Click the teal SmartReply mark in the compose toolbar.
3. Review the recommended draft or choose another reply direction.
4. Optionally add a detail, change tone or length, and regenerate.
5. Click **Insert draft**.
6. Edit and review the message in Gmail before sending it yourself.

## Privacy and architecture

- The API key is stored in `chrome.storage.local` on the user's Chrome profile.
- When generation is requested, selected thread content and any drafting note are sent directly from the extension to the Google Gemini API.
- There is no SmartReply developer server, account, analytics SDK, or telemetry endpoint in this project.
- Google’s terms and the user’s Gemini plan govern processing by Gemini.
- The extension asks for only `storage` permission plus host access to Gmail and the Gemini API.
- Thread content is capped before a request is made. SmartReply never auto-sends email.

## Development

The extension is plain HTML, CSS, and JavaScript. No bundling is required.

```bash
npm test
```

After changes, reload the unpacked extension from `chrome://extensions` and refresh Gmail.

## Important review notes

Gmail's internal DOM is not a public API and its selectors can change. Test reply, reply-all, pop-out compose, long threads, multiple compose windows, and keyboard-only operation before every Chrome Web Store release.
