// ============================================================
// panel/components/LoginView.tsx
// Google OAuth sign-in screen shown when no session exists.
// ============================================================

import { useState, useEffect } from "react";

interface Props {
  onLogin: () => void;
  isLoading: boolean;
}

export function LoginView({ onLogin, isLoading }: { onLogin: () => void; isLoading?: boolean }) {
  return (
    <div className="login-root">
      <div className="login-logo">
        <svg width="32" height="32" viewBox="0 0 20 20" fill="none">
          <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
          <rect x="11" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.6" />
          <rect x="2" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.4" />
          <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.2" />
        </svg>
        <span className="login-wordmark">Twift</span>
      </div>

      <div className="login-card">
        <h2 className="login-title">Welcome to Twift</h2>
        <p className="login-sub">
          Sign in to extract tokens, or upgrade to Pro for AI-powered semantic labelling.
        </p>

        <button
          className="google-btn"
          onClick={onLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="login-spinner" />
              Connecting...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <ul className="login-features">
          <li><span className="feat-icon free">✔</span> Free: Unlimited heuristic scans</li>
          <li><span className="feat-icon free">✔</span> Free: 3 AI exports per month</li>
          <li><span className="feat-icon pro">✦</span> Pro: Unlimited AI exports</li>
        </ul>
      </div>

      <p className="login-legal">
        By continuing, you agree to the Twift <a href="#">Terms</a> & <a href="#">Privacy Policy</a>.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
