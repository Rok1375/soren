import { useEffect, useRef, useState } from 'react';

/**
 * PremiumWaveform - Real-time audio visualization component
 * Features:
 * - CRT scanline overlay with subtle animation
 * - Dynamic waveform that responds to audio activity
 * - Transmission countdown timer
 * - Premium tactical aesthetic
 */
export function PremiumWaveform({ 
  active = false, 
  busy = false,
  isTransmitting = false,
  transmissionStartTime = null
}) {
  const bars = Array.from({ length: 31 }, (_, index) => index);
  const [transmissionTime, setTransmissionTime] = useState(0);
  const [audioLevels, setAudioLevels] = useState(new Array(31).fill(18));
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);

  // Transmission timer
  useEffect(() => {
    if (isTransmitting && transmissionStartTime) {
      const interval = setInterval(() => {
        setTransmissionTime(Date.now() - transmissionStartTime);
      }, 100);
      return () => clearInterval(interval);
    } else if (!isTransmitting) {
      setTransmissionTime(0);
    }
  }, [isTransmitting, transmissionStartTime]);

  // Audio visualization
  useEffect(() => {
    if (!active) {
      // Reset to static bars when not active
      setAudioLevels(new Array(31).fill(18));
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    // Initialize audio context for real-time visualization
    const initAudioVisualization = async () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 64;
          analyserRef.current.smoothingTimeConstant = 0.8;
        }

        // Get local stream for visualization
        if (!streamRef.current && navigator.mediaDevices) {
          try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ 
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
              } 
            });
            
            if (sourceRef.current) {
              sourceRef.current.disconnect();
            }
            sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
            sourceRef.current.connect(analyserRef.current);
          } catch (err) {
            console.warn('Audio visualization mic access denied:', err);
            // Fall back to simulated visualization
            startSimulatedVisualization();
            return;
          }
        } else if (streamRef.current) {
          if (sourceRef.current) {
            sourceRef.current.disconnect();
          }
          sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
          sourceRef.current.connect(analyserRef.current);
        }

        // Start visualization loop
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        
        const updateVisualization = () => {
          if (analyserRef.current && active) {
            analyserRef.current.getByteFrequencyData(dataArray);
            
            const newLevels = Array.from({ length: 31 }, (_, i) => {
              const dataIndex = Math.min(i, dataArray.length - 1);
              const baseHeight = 14;
              const dynamicHeight = busy 
                ? Math.floor((dataArray[dataIndex] / 255) * 35) 
                : Math.floor((dataArray[dataIndex] / 255) * 25);
              return baseHeight + dynamicHeight;
            });
            
            setAudioLevels(newLevels);
          }
          animationFrameRef.current = requestAnimationFrame(updateVisualization);
        };
        
        updateVisualization();
      } catch (err) {
        console.warn('Audio visualization setup failed:', err);
        startSimulatedVisualization();
      }
    };

    const startSimulatedVisualization = () => {
      const simulateAudioLevels = () => {
        if (!active) return;
        
        const newLevels = Array.from({ length: 31 }, (_, i) => {
          const baseHeight = 14;
          const noise = Math.random() * (busy ? 40 : 20);
          const wave = Math.sin((Date.now() / 200) + (i * 0.4)) * (busy ? 15 : 8);
          return Math.min(48, Math.max(14, baseHeight + noise + wave));
        });
        
        setAudioLevels(newLevels);
        animationFrameRef.current = requestAnimationFrame(simulateAudioLevels);
      };
      
      simulateAudioLevels();
    };

    initAudioVisualization();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      // Don't close audioContext as it may be reused
    };
  }, [active, busy, isTransmitting]);

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const millis = Math.floor((ms % 1000) / 10);
    return `${seconds.toString().padStart(2, '0')}:${millis.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative">
      {/* CRT Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-2xl">
        {/* Static scanlines */}
        <div className="absolute inset-0 opacity-10" 
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
          }}
        />
        {/* Animated scanline */}
        <div 
          className="absolute inset-x-0 h-px animate-scanline"
          style={{
            background: `linear-gradient(90deg, transparent, ${busy ? 'rgba(245, 158, 11, 0.4)' : 'rgba(124, 255, 107, 0.3)'}, transparent)`
          }}
        />
      </div>

      {/* Waveform Container */}
      <div className="flex h-20 items-center justify-center gap-1 rounded-2xl border border-white/10 bg-black/40 px-3 relative overflow-hidden">
        {/* Subtle glow background */}
        <div 
          className={`absolute inset-0 transition-opacity duration-300 ${
            active ? 'opacity-30' : 'opacity-5'
          }`}
          style={{
            background: `radial-gradient(ellipse at center ${busy ? 'rgba(245, 158, 11, 0.15)' : 'rgba(124, 255, 107, 0.1)'}, transparent 70%)`
          }}
        />
        
        {bars.map((bar) => {
          const delay = `${(bar % 9) * 60}ms`;
          const height = audioLevels[bar] || 18;
          return (
            <span
              key={bar}
              className={`w-1.5 rounded-full transition-all duration-75 ${
                busy 
                  ? 'bg-tactical-amber shadow-[0_0_8px_rgba(245,158,11,0.6)]' 
                  : 'bg-tactical-green shadow-[0_0_8px_rgba(124,255,107,0.5)]'
              }`}
              style={{ 
                height: `${height}px`,
                animationDelay: delay
              }}
            />
          );
        })}
      </div>

      {/* Transmission Timer Display */}
      {isTransmitting && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-tactical-green/30 bg-tactical-green/10 px-2.5 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-tactical-green" />
            <span className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-tactical-green">
              TX: {formatTime(transmissionTime)}
            </span>
          </div>
        </div>
      )}

      {/* Reception indicator */}
      {active && !isTransmitting && busy && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-tactical-amber/30 bg-tactical-amber/10 px-2.5 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-tactical-amber" />
            <span className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-tactical-amber">
              RX: {formatTime(transmissionTime)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
