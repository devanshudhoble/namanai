// Web Speech & Sarvam AI Integration Service
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

import { backendTts } from './agentApi';
import { analytics } from './analytics';

/** Language used for both STT (Web Speech) and TTS (Sarvam). Set from the dialect picker. */
export type VoiceLanguage = 'en-IN' | 'hi-IN';

class SpeechService {
  private recognition: any = null;
  private isListeningActive: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private indianVoice: SpeechSynthesisVoice | null = null;
  private isAudioPlaying: boolean = false;
  private language: VoiceLanguage = 'en-IN';

  public setLanguage(lang: VoiceLanguage) {
    this.language = lang;
  }

  constructor() {
    this.initSpeechSynthesis();
  }

  private initSpeechSynthesis() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        const voices = window.speechSynthesis.getVoices();
        this.indianVoice =
          voices.find((v) => v.lang.includes('en-IN')) ||
          voices.find((v) => v.name.includes('India') || v.name.includes('Ravi') || v.name.includes('Kavya')) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          null;
      };
    }
  }

  public isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as IWindow;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (err: string) => void,
    onEnd: () => void
  ) {
    if (typeof window === 'undefined') return;
    const win = window as unknown as IWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      onError('Speech Recognition not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      this.stopListening();
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.language; // en-IN or hi-IN (Hinglish works best with hi-IN)

      this.recognition.onstart = () => {
        this.isListeningActive = true;
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          onResult(finalTranscript.trim(), true);
        } else if (interimTranscript) {
          onResult(interimTranscript.trim(), false);
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          onError(event.error);
        }
      };

      this.recognition.onend = () => {
        this.isListeningActive = false;
        onEnd();
      };

      this.recognition.start();
    } catch (err: any) {
      onError(err.message || 'Failed to start microphone');
    }
  }

  public stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
      this.recognition = null;
    }
    this.isListeningActive = false;
  }

  public async speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: () => void
  ): Promise<void> {
    // Stop any existing speech / audio (Barge-in capability)
    this.stopSpeaking();

    // Clean formatting for speech
    const cleaned = text
      .replace(/\*\*/g, '')
      .replace(/₹/g, 'Rupees ')
      .replace(/•/g, ', ')
      // Spell out PNR / flight codes so TTS reads them character by character
      .replace(/([A-Z0-9]{2})-([A-Z0-9]{3,4})/g, (_m, a, b) => `${a.split('').join(' ')} ${b.split('').join(' ')}`);

    // 1. Try Sarvam AI Bulbul TTS (Neural Indian Voice)
    const sarvamAudioBase64 = await this.fetchSarvamTTS(cleaned);
    if (sarvamAudioBase64) {
      try {
        const audio = new Audio(`data:audio/wav;base64,${sarvamAudioBase64}`);
        this.currentAudioElement = audio;

        audio.onplay = () => {
          this.isAudioPlaying = true;
          onStart?.();
        };

        audio.onended = () => {
          this.isAudioPlaying = false;
          this.currentAudioElement = null;
          onEnd?.();
        };

        audio.onerror = () => {
          this.isAudioPlaying = false;
          this.currentAudioElement = null;
          this.fallbackBrowserTTS(cleaned, onStart, onEnd, onError);
        };

        await audio.play();
        return;
      } catch (err) {
        console.warn('Sarvam audio playback failed, falling back to browser TTS:', err);
      }
    }

    // 2. Fallback to Browser Native TTS
    this.fallbackBrowserTTS(cleaned, onStart, onEnd, onError);
  }

  // Sarvam Bulbul TTS via our backend proxy (key stays server-side). Measures time-to-audio.
  private async fetchSarvamTTS(text: string): Promise<string | null> {
    const t0 = performance.now();
    const audio = await backendTts(text.slice(0, 480), this.language);
    if (audio) analytics.timing('tts_ms', performance.now() - t0);
    return audio;
  }

  private fallbackBrowserTTS(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: () => void
  ) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.indianVoice) {
      utterance.voice = this.indianVoice;
    }
    utterance.rate = 1.02;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.currentUtterance = utterance;
      this.isAudioPlaying = true;
      onStart?.();
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      this.isAudioPlaying = false;
      onEnd?.();
    };

    utterance.onerror = () => {
      this.currentUtterance = null;
      this.isAudioPlaying = false;
      onError?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking() {
    // Cancel Sarvam audio if playing
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch (e) {
        // ignore
      }
      this.currentAudioElement = null;
    }

    // Cancel browser synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }

    this.isAudioPlaying = false;
  }

  public isSpeaking(): boolean {
    if (this.isAudioPlaying) return true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }
}

export const speechService = new SpeechService();
