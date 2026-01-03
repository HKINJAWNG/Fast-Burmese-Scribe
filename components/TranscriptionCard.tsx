
import React, { useState } from 'react';
import { TranscriptionSegment } from '../types';

interface TranscriptionCardProps {
  segment: TranscriptionSegment;
}

const TranscriptionCard: React.FC<TranscriptionCardProps> = ({ segment }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(segment.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl mb-4 group hover:border-blue-500 transition-all duration-300">
      <div className="flex justify-between items-start mb-2">
        <span className="text-slate-400 text-xs font-mono">
          {segment.timestamp.toLocaleTimeString()}
        </span>
        <button
          onClick={copyToClipboard}
          className="text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1 text-sm bg-slate-700/50 px-2 py-1 rounded"
        >
          {copied ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <p className="text-lg text-slate-100 burmese-text break-words whitespace-pre-wrap leading-relaxed">
        {segment.text}
      </p>
    </div>
  );
};

export default TranscriptionCard;
