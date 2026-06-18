import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppContext } from '../kit.js';
import { Analyze } from '../screens-analyze.jsx';

const ctx = {
  mode: 'business', plan: 'free', planAllows: () => false,
  go: () => {}, addClip: () => {}, viewClip: null, setViewClip: () => {},
};

function renderAnalyze() {
  return render(
    <AppContext.Provider value={ctx}>
      <Analyze />
    </AppContext.Provider>
  );
}

describe('Analyze screen (idle)', () => {
  it('renders the record + upload entry points', () => {
    renderAnalyze();
    expect(screen.getByRole('heading', { name: /Analyze a recording/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Record audio/i })).toBeInTheDocument();
    expect(screen.getByText(/Choose audio file/i)).toBeInTheDocument();
  });

  it('hides the native-only device-capture button on the web', () => {
    renderAnalyze();
    expect(screen.queryByText(/Capture meeting audio/i)).toBeNull();
  });
});
