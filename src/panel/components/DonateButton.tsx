// ─── DonateButton ─────────────────────────────────────────────────────────────
// "Pay What You Want" donation button via LemonSqueezy.
// Replace LEMONSQUEEZY_URL with your actual store checkout link.
// e.g. https://yourstore.lemonsqueezy.com/checkout/buy/YOUR_PRODUCT_ID
// ─────────────────────────────────────────────────────────────────────────────

const LEMONSQUEEZY_URL =
  "https://usetwift.lemonsqueezy.com/checkout/buy/7b853ea7-31aa-4fe1-bc3b-6ada9b4bb648";

export function DonateButton() {
  function handleDonate() {
    // Side-panel context: window.open opens in the current browser window.
    window.open(LEMONSQUEEZY_URL, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="donate-banner">
      <span className="donate-icon">☕</span>
      <p className="donate-text">
        Twift is <strong>free forever</strong> — if it saves you time, <br />
        <strong>Buy me a coffee.</strong>
      </p>
      <button className="donate-btn" onClick={handleDonate}>
        Support ↗
      </button>
    </div>
  );
}
