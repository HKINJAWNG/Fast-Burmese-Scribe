
export interface TranscriptionSegment {
  id: string;
  text: string;
  timestamp: Date;
  isUser: boolean;
}

export interface AudioConfig {
  sampleRate: number;
  bufferSize: number;
}
