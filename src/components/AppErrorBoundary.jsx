import React from 'react';
import { reportClientError } from '../lib/clientErrorReporter';

const C = {
  forest: '#2C4A38',
  sage: '#7C9E87',
  mint: '#EAF4EE',
  warm: '#FAFCFB',
  gold: '#C9A84C',
  text: '#1A2E22',
};

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error) {
    // React's component stack is intentionally not transmitted because it can
    // contain dynamic component props or other context we do not need for
    // launch crash triage.
    void reportClientError({
      type: 'react_error',
      error,
      fallback: 'React render error',
    });
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    return (
      <main style={{
        minHeight: '100vh',
        background: C.mint,
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        fontFamily: "'Lora', serif",
        color: C.text,
      }}>
        <section style={{
          width: '100%',
          maxWidth: 520,
          background: C.warm,
          border: `1px solid ${C.sage}55`,
          borderRadius: 20,
          padding: '34px 30px',
          textAlign: 'center',
          boxShadow: '0 14px 40px rgba(44,74,56,.12)',
        }}>
          <div aria-hidden="true" style={{ fontSize: 34, marginBottom: 10 }}>🐾</div>
          <h1 style={{
            margin: '0 0 10px',
            color: C.forest,
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            lineHeight: 1.2,
          }}>
            YourPetPass hit a screen error
          </h1>
          <p style={{ margin: '0 0 22px', color: C.sage, lineHeight: 1.7, fontSize: 14.5 }}>
            Reload the app to continue. If you're signed in, a privacy-minimized technical report is sent automatically so we can investigate recurring crashes.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              width: '100%',
              padding: '13px 18px',
              border: 0,
              borderRadius: 12,
              background: C.forest,
              color: '#fff',
              fontFamily: "'Lora', serif",
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              boxShadow: `0 3px 0 ${C.gold}55`,
            }}
          >
            Reload YourPetPass
          </button>
        </section>
      </main>
    );
  }
}
