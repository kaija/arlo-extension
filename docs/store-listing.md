# Chrome Web Store listing

Copy-paste content for the Developer Dashboard. Fields follow the dashboard's
own order.

## Store listing → Product details

**Name** (from manifest): `Arlo`

**Summary** (max 132 characters, from manifest `description`):

```
An AI assistant with helpful suggestions for the page you are viewing.
```

**Category**: Productivity → Tools

**Language**: English

**Description**:

```
Arlo is an AI assistant that lives in the Chrome side panel. Give it a task in plain language and it works on the page you are looking at.

WHAT ARLO CAN DO
• Read the tab you are viewing, at the level of detail the task needs
• Open tabs for you, and keep every tab it opens in an "Arlo" tab group so you can find and close them
• Stream its answer back as it works, so you see progress instead of waiting
• Stop a running task at any time with one click

BRING YOUR OWN MODEL
Arlo has no server of its own. Point it at any OpenAI-compatible endpoint (OpenAI, a proxy, or a local model server) and add your API key in the options page. You can keep several profiles and choose a default.

YOU STAY IN CONTROL
• Arlo only reads a page when you ask it to
• Access to a model's website is requested per origin, and you can revoke it in Chrome at any time
• Access to all pages is optional, asked for once from the panel, and can be left off

PRIVACY
Arlo has no backend and no analytics. Your API key and settings stay in your browser. Page content is sent only to the model endpoint you configured, and only when you run a task.
```

**Graphic assets** (not in the repo, must be made):

- Store icon 128×128: `public/icons/icon-128.png`
- At least one screenshot, 1280×800 or 640×400 (side panel with a finished task)
- Small promo tile 440×280

## Privacy

**Single purpose**:

```
Let the user give plain-language tasks to an AI assistant in the Chrome side panel, which reads the current tab and opens tabs to carry them out.
```

**Permission justifications**:

| Permission                                              | Justification                                                                                                                                                                                             |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab`                                             | Lets Arlo read the page the user opened it from, only after the user clicks the toolbar icon.                                                                                                             |
| `scripting`                                             | Runs the page reader inside the current tab to extract its text for the AI model.                                                                                                                         |
| `sidePanel`                                             | Arlo's whole interface is the Chrome side panel.                                                                                                                                                          |
| `storage`                                               | Saves the user's model profiles, API key and preferences in the browser.                                                                                                                                  |
| `tabGroups`                                             | Puts every tab Arlo opens into an "Arlo" group so the user can see and close them.                                                                                                                        |
| Optional host permissions (`http://*/*`, `https://*/*`) | Nothing is granted at install. Requested at runtime for (a) the origin of the model endpoint the user configured, or (b) reading pages without a toolbar click, if the user chooses. Revocable in Chrome. |

**Remote code**: No, I am not using remote code.

**Data usage** — tick: _Website content_ (page text is sent to the user's own model endpoint) and _Authentication information_ (API key, stored locally). Then certify:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes unrelated to the item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**: required because the extension handles website content. Host a short policy (for example a `PRIVACY.md` on GitHub Pages) stating the points under "Privacy" above.
