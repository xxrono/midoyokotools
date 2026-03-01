import React from 'react';
import { useAudio } from './hooks/useAudio';
import { useChartState } from './hooks/useChartState';
import { ChartEditor } from './components/ChartEditor';
import { Play, Pause, Square, Upload, Download, Settings, Music, Zap, FileAudio } from 'lucide-react';
import { analyze } from 'web-audio-beat-detector';
import type { HitSoundType } from './hooks/useAudio';

function App() {
  const {
    ready, loadAudioFile, play, pause, stop, isPlaying, currentTime, duration, audioBuffer, playHitSound, seek,
    hitSoundType, setHitSoundType, loadCustomHitSound, customHitSoundBuffer
  } = useAudio();

  const {
    state, updateBpm, updateLanes, updateDivision, addNote, removeNote, exportChart, loadChart
  } = useChartState();

  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadAudioFile(file);
    }
  };

  const handleDetectBPM = async () => {
    if (!audioBuffer) return;
    setIsAnalyzing(true);
    try {
      const detectedBpm = await analyze(audioBuffer);
      updateBpm(Math.round(detectedBpm));
    } catch (err) {
      console.error("BPM detection failed", err);
      alert("Failed to detect BPM from audio. Could not find a clear beat.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExport = () => {
    const data = exportChart();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          loadChart(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-screen w-full bg-background text-text font-sans">
      {/* Sidebar Panel */}
      <div className="w-80 bg-surface border-r border-border flex flex-col pt-4 shadow-xl z-10">
        <div className="px-6 pb-6 border-b border-border">
          <h1 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
            <Music className="w-6 h-6 text-primary" />
            Chart Editor
          </h1>
          <p className="text-sm text-text-muted">Web-based rhythm game authoring</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Audio Section */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
              Audio Source
            </h2>
            <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-xl hover:border-primary transition-colors cursor-pointer group bg-background/50">
              <input type="file" accept="audio/mp3, audio/wav, audio/ogg" className="hidden" onChange={handleAudioUpload} />
              <div className="text-center group-hover:text-primary transition-colors">
                <Upload className="w-6 h-6 mx-auto mb-2 opacity-70" />
                <span className="text-sm font-medium">Select Audio File</span>
              </div>
            </label>

            {ready && (
              <div className="bg-background rounded-lg p-4 flex flex-col gap-3 border border-border">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-primary font-mono">{formatTime(currentTime)}</span>
                  <span className="text-text-muted font-mono">{formatTime(duration)}</span>
                </div>

                {/* Interactive Seekbar */}
                <div className="flex items-center w-full">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.01"
                    value={currentTime}
                    onChange={(e) => seek(Number(e.target.value))}
                    className="w-full h-1.5 bg-surface rounded-full cursor-pointer accent-primary"
                  />
                </div>

                <div className="flex justify-center gap-2 mt-1">
                  <button onClick={isPlaying ? pause : play} className="p-2.5 rounded-full bg-primary hover:bg-primary-hover text-white transition-colors">
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </button>
                  <button onClick={stop} className="p-2.5 rounded-full bg-surface hover:bg-border text-white transition-colors">
                    <Square className="w-5 h-5 fill-current" />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Properties Section */}
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Chart Properties
            </h2>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-text-muted">BPM</label>
                <div className="flex items-center gap-2">
                  {audioBuffer && (
                    <button
                      onClick={handleDetectBPM}
                      disabled={isAnalyzing}
                      className="p-1.5 bg-surface border border-border rounded text-text-muted hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
                      title="Auto Detect BPM"
                    >
                      <Zap className={`w-4 h-4 ${isAnalyzing ? 'animate-pulse text-amber-500' : ''}`} />
                    </button>
                  )}
                  <input
                    type="number"
                    value={state.bpm}
                    onChange={(e) => updateBpm(Number(e.target.value))}
                    className="w-24 bg-background border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary text-right font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-text-muted">Lanes</label>
                <input
                  type="number"
                  value={state.lanes}
                  min={1} max={16}
                  onChange={(e) => updateLanes(Number(e.target.value))}
                  className="w-24 bg-background border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary text-right font-mono"
                />
              </div>

              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-text-muted">Division</label>
                <select
                  value={state.division}
                  onChange={(e) => updateDivision(Number(e.target.value))}
                  className="w-24 bg-background border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary text-right font-mono appearance-none"
                >
                  {[1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64].map(d => (
                    <option key={d} value={d}>1/{d}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-text-muted">Hit Sound</label>
                <select
                  value={hitSoundType}
                  onChange={(e) => setHitSoundType(e.target.value as HitSoundType)}
                  className="w-24 bg-background border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary text-right font-mono appearance-none"
                >
                  <option value="snare">Snare</option>
                  <option value="tick">Tick</option>
                  <option value="click">Click</option>
                  <option value="kick">Kick</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {hitSoundType === 'custom' && (
                <div className="flex justify-between items-center mt-2 p-2 bg-background border border-border rounded">
                  <span className="text-xs font-mono text-text-muted flex-1 truncate max-w-[100px]" title={customHitSoundBuffer ? 'Ready' : 'Not Loaded'}>
                    {customHitSoundBuffer ? 'Sample Ready' : 'Empty'}
                  </span>
                  <label className="flex items-center gap-1 cursor-pointer bg-surface hover:bg-border px-2 py-1 rounded transition-colors text-white border border-border text-xs">
                    <FileAudio className="w-3 h-3" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="audio/mp3, audio/wav, audio/ogg"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) loadCustomHitSound(file);
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-border grid grid-cols-2 gap-3">
          <label className="flex items-center justify-center gap-2 py-2.5 px-4 bg-background border border-border hover:border-primary rounded-lg text-sm font-medium cursor-pointer transition-colors">
            <Download className="w-4 h-4" />
            <span>Import</span>
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 relative flex">
        <ChartEditor
          state={state}
          audioBuffer={audioBuffer}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          onAddNote={addNote}
          onRemoveNote={removeNote}
          playHitSound={playHitSound}
        />
      </div>

    </div>
  );
}

export default App;
