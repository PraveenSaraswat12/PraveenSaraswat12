import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

class Boundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#f4f1ea', fontFamily: 'Inter, sans-serif', background: '#0c0e1c', padding: 24 }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ opacity: 0.7, fontSize: 14 }}>{String(this.state.err)}</p>
            <button onClick={() => location.reload()} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, border: 0, background: '#3a6df4', color: '#fff', cursor: 'pointer' }}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </React.StrictMode>
);

// drop the boot splash once React mounts
requestAnimationFrame(() => {
  setTimeout(() => document.getElementById('boot')?.classList.add('gone'), 250);
});
