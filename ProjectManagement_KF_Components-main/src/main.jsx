import React, { StrictMode } from 'react';
import './i18n';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { SDKWrapper } from './sdk/index.js';

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error?.message || error || 'Unknown error') };
  }

  componentDidCatch(error) {
    // Keep a clear trace in Kissflow preview console.
    console.error('Root render failed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, fontFamily: 'Inter, sans-serif', color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12 }}>
          Component failed to render.
          <div style={{ marginTop: 8, fontSize: 12, color: '#7f1d1d' }}>{this.state.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

function resolveMountNode() {
  const existing = document.getElementById('root') || document.getElementById('app');
  if (existing) return existing;
  const created = document.createElement('div');
  created.id = 'root';
  document.body.appendChild(created);
  return created;
}

const mountNode = resolveMountNode();

createRoot(mountNode).render(
  <StrictMode>
    <RootErrorBoundary>
      <SDKWrapper>
        <App />
      </SDKWrapper>
    </RootErrorBoundary>
  </StrictMode>,
);
