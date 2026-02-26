/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Tone from 'tone';
import { Camera, Play, Square, RefreshCw, Loader2, Music, Volume2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { detectGrid } from './services/geminiService';

const ROWS = ['Open Hi-Hat', 'Closed Hi-Hat', 'Snare', 'Kick'];
const COLS = 8;

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [grid, setGrid] = useState<boolean[][]>(
    Array(4).fill(null).map(() => Array(8).fill(false))
  );
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sequenceRef = useRef<Tone.Sequence | null>(null);
  const synthsRef = useRef<any>(null);

  // Initialize Audio
  useEffect(() => {
    // Create synths for each row
    const kick = new Tone.MembraneSynth().toDestination();
    const snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
    }).toDestination();
    const closedHiHat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.1, sustain: 0 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    }).toDestination();
    closedHiHat.frequency.value = 200;

    const openHiHat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.5, sustain: 0 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5
    }).toDestination();
    openHiHat.frequency.value = 200;

    synthsRef.current = {
      'Open Hi-Hat': openHiHat,
      'Closed Hi-Hat': closedHiHat,
      'Snare': snare,
      'Kick': kick
    };

    // Create sequence
    sequenceRef.current = new Tone.Sequence(
      (time, step) => {
        setCurrentStep(step);
        grid.forEach((row, rowIndex) => {
          if (row[step]) {
            const instrument = ROWS[rowIndex];
            const synth = synthsRef.current[instrument];
            if (instrument === 'Kick') {
              synth.triggerAttackRelease('C1', '8n', time);
            } else {
              synth.triggerAttackRelease('8n', time);
            }
          }
        });
      },
      [0, 1, 2, 3, 4, 5, 6, 7],
      '8n'
    );

    Tone.getTransport().bpm.value = 120;

    return () => {
      sequenceRef.current?.dispose();
      Object.values(synthsRef.current).forEach((s: any) => s.dispose());
    };
  }, [grid]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setError(null);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please ensure permissions are granted.");
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setCameraActive(false);
  };

  const togglePlay = async () => {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }

    if (isPlaying) {
      Tone.getTransport().stop();
      sequenceRef.current?.stop();
      setIsPlaying(false);
    } else {
      Tone.getTransport().start();
      sequenceRef.current?.start(0);
      setIsPlaying(true);
    }
  };

  const scanGrid = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsScanning(true);
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        const detectedGrid = await detectGrid(base64Image);
        setGrid(detectedGrid);
      }
    } catch (err) {
      console.error("Scan error:", err);
      setError("Failed to scan grid. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const toggleCell = (row: number, col: number) => {
    const newGrid = [...grid];
    newGrid[row] = [...newGrid[row]];
    newGrid[row][col] = !newGrid[row][col];
    setGrid(newGrid);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-4xl mb-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <Music className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Grid Drummer</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => Tone.start()}
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
            title="Enable Audio"
          >
            <Volume2 className="w-5 h-5 opacity-60" />
          </button>
        </div>
      </header>

      <main className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Camera Section */}
        <section className="space-y-4">
          <div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            {!cameraActive ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <Camera className="w-12 h-12 text-zinc-700" />
                <p className="text-zinc-400 text-sm max-w-[200px]">
                  Place your 4x8 grid in front of the camera to scan it.
                </p>
                <button
                  onClick={startCamera}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-full transition-all active:scale-95"
                >
                  Start Camera
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Grid Overlay */}
                <div className="absolute inset-0 grid grid-cols-8 grid-rows-4 opacity-30 pointer-events-none">
                  {Array(32).fill(0).map((_, i) => (
                    <div key={i} className="border border-white/20" />
                  ))}
                </div>
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 px-4">
                  <button
                    onClick={scanGrid}
                    disabled={isScanning}
                    className="flex-1 max-w-[160px] flex items-center justify-center gap-2 px-4 py-3 bg-white text-black font-bold rounded-xl shadow-lg hover:bg-zinc-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isScanning ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-5 h-5" />
                    )}
                    {isScanning ? 'Scanning...' : 'Scan Grid'}
                  </button>
                  <button
                    onClick={stopCamera}
                    className="p-3 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl hover:bg-black/70 transition-colors"
                  >
                    <Square className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex gap-3 items-start"
            >
              <Info className="w-5 h-5 shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="p-6 bg-zinc-900/50 border border-white/5 rounded-2xl space-y-3">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">How to use</h3>
            <ul className="text-sm text-zinc-500 space-y-2">
              <li>1. Draw or arrange a 4x8 grid on a piece of paper.</li>
              <li>2. Place objects (coins, caps) to mark the beats.</li>
              <li>3. Point the camera at the grid and click "Scan Grid".</li>
              <li>4. The top row is Open Hi-Hat, bottom is Kick.</li>
            </ul>
          </div>
        </section>

        {/* Sequencer Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Sequencer</h2>
            <button
              onClick={togglePlay}
              className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all active:scale-95 ${
                isPlaying 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : 'bg-emerald-500 text-black'
              }`}
            >
              {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              {isPlaying ? 'Stop' : 'Play Beat'}
            </button>
          </div>

          <div className="bg-zinc-900 p-4 rounded-3xl border border-white/5 shadow-inner overflow-x-auto">
            <div className="min-w-[400px] space-y-4">
              {grid.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center gap-4">
                  <div className="w-24 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                    {ROWS[rowIndex]}
                  </div>
                  <div className="flex-1 grid grid-cols-8 gap-2">
                    {row.map((active, colIndex) => (
                      <motion.button
                        key={colIndex}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleCell(rowIndex, colIndex)}
                        className={`aspect-square rounded-lg border transition-all duration-200 ${
                          active 
                            ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                            : 'bg-zinc-800 border-white/5'
                        } ${
                          currentStep === colIndex && isPlaying 
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900' 
                            : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 pt-2">
                <div className="w-24" />
                <div className="flex-1 grid grid-cols-8 gap-2">
                  {Array(8).fill(0).map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-1 rounded-full transition-colors ${
                        currentStep === i && isPlaying ? 'bg-white' : 'bg-zinc-800'
                      }`} 
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => setGrid(Array(4).fill(null).map(() => Array(8).fill(false)))}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-4"
            >
              Clear Grid
            </button>
          </div>
        </section>
      </main>

      <footer className="mt-auto pt-12 text-zinc-600 text-[10px] uppercase tracking-[0.2em]">
        Powered by Gemini Vision & Tone.js
      </footer>
    </div>
  );
}
