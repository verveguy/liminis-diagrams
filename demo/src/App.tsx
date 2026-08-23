import { useMemo, useState } from 'react';
import { parseC4 } from '@liminis/diagrams/core';
import { C4InteractiveRenderer, C4ErrorDisplay } from '@liminis/diagrams/react';
import { PRESETS } from './presets';

type Positions = Record<string, { x: number; y: number }>;

export default function App() {
  const [presetIndex, setPresetIndex] = useState(0);
  const [source, setSource] = useState(PRESETS[0].source);
  const [positions, setPositions] = useState<Positions>({});
  const [isEditMode, setIsEditMode] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const { diagram, errors } = useMemo(() => parseC4(source), [source]);

  function selectPreset(index: number) {
    setPresetIndex(index);
    setSource(PRESETS[index].source);
    // A new diagram has its own element IDs — carrying over positions from a
    // different preset would apply stale coordinates to unrelated elements.
    setPositions({});
  }

  const pageBg = isDarkMode ? '#1a1a1a' : '#ffffff';
  const pageFg = isDarkMode ? '#e0e0e0' : '#1a1a1a';
  const paneBorder = isDarkMode ? '#3a3a3a' : '#d0d0d0';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: pageBg,
        color: pageFg,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '0.75rem 1rem',
          borderBottom: `1px solid ${paneBorder}`,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1rem' }}>@liminis/diagrams demo</h1>

        <label>
          Preset:{' '}
          <select
            value={presetIndex}
            onChange={(e) => selectPreset(Number(e.target.value))}
          >
            {PRESETS.map((preset, index) => (
              <option key={preset.name} value={index}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <input
            type="checkbox"
            checked={isEditMode}
            onChange={(e) => setIsEditMode(e.target.checked)}
          />{' '}
          Edit mode (drag to reposition — this demo keeps positions in memory
          only)
        </label>

        <label>
          <input
            type="checkbox"
            checked={isDarkMode}
            onChange={(e) => setIsDarkMode(e.target.checked)}
          />{' '}
          Dark mode
        </label>

        <button type="button" onClick={() => setPositions({})}>
          Reset layout
        </button>
      </header>

      <main style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <textarea
          aria-label="C4-PlantUML source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          spellCheck={false}
          style={{
            width: '40%',
            height: '100%',
            resize: 'none',
            border: 'none',
            borderRight: `1px solid ${paneBorder}`,
            padding: '1rem',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '13px',
            backgroundColor: pageBg,
            color: pageFg,
            outline: 'none',
          }}
        />

        <div style={{ width: '60%', height: '100%', overflow: 'auto', padding: '1rem' }}>
          {diagram && errors.length === 0 ? (
            <C4InteractiveRenderer
              diagram={diagram}
              isDarkMode={isDarkMode}
              isEditMode={isEditMode}
              manualPositions={positions}
              onPositionChange={setPositions}
            />
          ) : (
            <C4ErrorDisplay errors={errors} isDarkMode={isDarkMode} />
          )}
        </div>
      </main>
    </div>
  );
}
