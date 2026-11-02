// Web Speech API interfaces
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

class SpeechService {
  private recognition: any = null;
  private isListeningActive: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private indianVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.initSpeechSynthesis();
  }

  private initSpeechSynthesis() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        const voices = window.speechSynthesis.getVoices();
        // Look for Indian English voice or high quality English voice
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
      onError('Speech Recognition not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }

    try {
      this.stopListening();
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-IN'; // Indian English

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

  public speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: () => void
  ): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onEnd?.();
        resolve();
        return;
      }

      // Stop any existing speech (Barge-in / interruption)
      this.stopSpeaking();

      // Clean SSML or markdown formatting for speech
      const cleaned = text
        .replace(/\*\*/g, '')
        .replace(/₹/g, 'Rupees ')
        .replace(/•/g, ', ')
        .replace(/6E-512/g, '6 E 5 1 2')
        .replace(/6E-W8/g, '6 E W 8')
        .replace(/BLR/g, 'Bangalore')
        .replace(/GOI|GOX/g, 'Goa');

      const utterance = new SpeechSynthesisUtterance(cleaned);
      if (this.indianVoice) {
        utterance.voice = this.indianVoice;
      }
      utterance.rate = 1.02;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        this.currentUtterance = utterance;
        onStart?.();
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        onEnd?.();
        resolve();
      };

      utterance.onerror = () => {
        this.currentUtterance = null;
        onError?.();
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  public stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }
  }

  public isSpeaking(): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    return window.speechSynthesis.speaking;
  }
}

export const speechService = new SpeechService();
