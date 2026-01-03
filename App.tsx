
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { TranscriptionSegment } from './types';
import { encode } from './services/audioUtils';
import TranscriptionCard from './components/TranscriptionCard';

const App: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isKeySelecting, setIsKeySelecting] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const currentInputRef = useRef('');

  const stopSession = useCallback(() => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => {
        try { session.close(); } catch (e) { console.debug('Session close err', e); }
      });
      sessionPromiseRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setCurrentTranscription('');
    currentInputRef.current = '';
  }, []);

  const startSession = async () => {
    try {
      setError(null);
      
      if (typeof (window as any).aistudio !== 'undefined') {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          setIsKeySelecting(true);
          await (window as any).aistudio.openSelectKey();
          setIsKeySelecting(false);
        }
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      if (inputAudioContext.state === 'suspended') {
        await inputAudioContext.resume();
      }
      audioContextRef.current = inputAudioContext;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Live Session Opened');
            const source = inputAudioContext.createMediaStreamSource(stream);
            // Ultra-low latency buffer size: 1024 (~64ms)
            const scriptProcessor = inputAudioContext.createScriptProcessor(1024, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            
            scriptProcessor.onaudioprocess = (event) => {
              const inputData = event.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = (inputData[i] * 32767) | 0;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };

              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch(() => {});
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Process incoming transcription chunks immediately
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentInputRef.current += text;
              setCurrentTranscription(currentInputRef.current);
            }

            // Move the current phrase to the history log once the user pauses or the turn ends
            if (message.serverContent?.turnComplete) {
              const finalTranscript = currentInputRef.current.trim();
              if (finalTranscript) {
                setTranscriptions(prev => [
                  {
                    id: Math.random().toString(36).substring(7),
                    text: finalTranscript,
                    timestamp: new Date(),
                    isUser: true
                  },
                  ...prev
                ]);
              }
              currentInputRef.current = '';
              setCurrentTranscription('');
            }
          },
          onerror: (e) => {
            console.error('API WebSocket Error:', e);
            setError('Connection interrupted. Retrying...');
            stopSession();
          },
          onclose: (e) => {
            console.log('Session closed', e);
            setIsRecording(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          // Minimal system instruction to prioritize raw transcription speed
          systemInstruction: "Transcribe audio to Burmese text instantly. Do not reply or translate. Output ONLY Burmese text."
        }
      });

      sessionPromiseRef.current = sessionPromise;
      setIsRecording(true);
    } catch (err: any) {
      console.error('Session Start Error:', err);
      setError('Could not access microphone or connect to AI.');
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopSession();
    } else {
      startSession();
    }
  };

  const copyAllText = async () => {
    const allText = transcriptions.map(t => t.text).join('\n\n');
    try {
      await navigator.clipboard.writeText(allText);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100 flex flex-col items-center p-4 md:p-8 font-sans">
      <header className="w-full max-w-3xl flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white uppercase italic tracking-tighter">Fast Burmese Scribe</h1>
        </div>
        {transcriptions.length > 0 && (
          <button 
            onClick={copyAllText}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-all text-xs font-bold"
          >
            COPY ALL TEXT
          </button>
        )}
      </header>

      <main className="w-full max-w-3xl flex-1 flex flex-col gap-6 relative pb-40">
        {error && (
          <div className="bg-red-500/20 border border-red-500/40 p-4 rounded-xl text-red-300 text-xs text-center">
            {error}
          </div>
        )}

        <div className={`transition-all duration-200 transform ${isRecording ? 'scale-100' : 'scale-95 opacity-50'}`}>
          <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl shadow-xl relative backdrop-blur-sm">
            {isRecording && (
              <div className="absolute top-4 right-6 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Live</span>
              </div>
            )}
            <p className="text-4xl burmese-text text-white leading-snug min-h-[6rem] transition-all duration-75">
              {currentTranscription || <span className="text-slate-700 italic">...</span>}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 max-h-[50vh] pr-2 custom-scrollbar">
          {transcriptions.map((segment) => (
            <TranscriptionCard key={segment.id} segment={segment} />
          ))}
        </div>
      </main>

      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-30">
        <button
          onClick={toggleRecording}
          disabled={isKeySelecting}
          className={`group flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 transform hover:scale-105 active:scale-90 ${
            isRecording 
              ? 'bg-red-600 shadow-[0_0_30px_rgba(220,38,38,0.4)]' 
              : 'bg-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.4)]'
          }`}
        >
          {isRecording ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14c1.657 0 3-1.343 3-3V5a3 3 0 10-6 0v6c0 1.657 1.343 3 3 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4" />
            </svg>
          )}
        </button>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .burmese-text { font-family: 'Padauk', sans-serif; }
      `}</style>
    </div>
  );
};

export default App;
