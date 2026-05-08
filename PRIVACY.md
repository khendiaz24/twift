# Privacy Policy for Twift

**Effective Date:** April 26, 2026

Twift ("we," "our," or "the Extension") is a developer tool designed to extract CSS design tokens for Tailwind CSS development. We value your privacy and are committed to transparency.

## 1. Information We Collect

Twift does **not** collect any personal or sensitive user data.

- **No Personal Data:** We do not collect, store, or transmit any personally identifiable information (PII), such as your name, email address, IP address, or location.
- **No Browsing History:** We do not track, record, or access your browsing history.
- **No Cookies or Fingerprinting:** We do not use cookies, device fingerprinting, or any other tracking mechanisms.

The only data the Extension reads is the computed CSS styles of the webpage you are actively viewing, and only when you explicitly trigger the scan. This data never leaves your browser.

## 2. How We Handle Data

All processing is performed entirely within your local browser environment.

- **Local Processing Only:** CSS design token extraction (colors, fonts, spacing) is computed in your browser at the moment of scanning. No data is buffered, logged, or queued for later processing.
- **No External Transmission:** None of the page style data, URL, or any other information is ever sent to our servers or any third-party service.
- **No Analytics:** We do not use any analytics, telemetry, or crash-reporting services.

## 3. Data Storage

Twift does **not** store any user data.

- **No Browser Storage Used:** The Extension does not write to `localStorage`, `sessionStorage`, IndexedDB, or any browser storage APIs.
- **No Server-Side Storage:** We operate no backend database or server that stores user information.
- **Ephemeral Results Only:** The scan results (extracted design tokens) are held in memory only for the duration of your current session in the side panel. They are discarded when you close the panel or navigate away.

## 4. Data Sharing and Disclosure

Because we collect and store no data, there is nothing to share.

- We do not sell, rent, trade, or otherwise disclose any user information to third parties.
- We do not share data with advertisers, data brokers, or analytics providers.
- We will never provide user data to law enforcement or other government bodies because no such data exists.

## 5. Permissions Justification

The Extension requests only the minimum permissions required for its functionality:

- **activeTab:** Allows the Extension to read the computed CSS styles of the tab you are currently viewing, solely to generate your Tailwind CSS theme. Access is granted only when you explicitly trigger a scan.
- **scripting:** Required to inject the CSS scanner script into the active tab when a scan is triggered by the user.
- **sidePanel:** Required to display the Extension's user interface in the browser side panel.
- **clipboardWrite:** Required to copy the generated Tailwind CSS `@theme` block to your clipboard when you click the copy button.

## 6. Children's Privacy

This Extension is intended for use by developers and does not target children. We do not knowingly collect any information from anyone under the age of 13.

## 7. Changes to This Policy

We may update this Privacy Policy from time to time. Any changes will be reflected by the updated "Effective Date" at the top of this page. Continued use of the Extension after changes are posted constitutes your acceptance of the updated policy.

## 8. Contact

If you have any questions or concerns regarding this Privacy Policy, please contact the developer at:
developer.khendiaz@gmail.com
