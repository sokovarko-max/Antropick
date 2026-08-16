// Обёртка над Web Speech API (webkitSpeechRecognition): слушает микрофон пользователя
// и стримит распознанный текст. Работает только в браузерах с поддержкой (Chrome/Edge на десктопе
// и Android; в Safari/iOS распознавание речи ограничено или недоступно).

class SpeechEngine {
  constructor({ lang, onFinal, onInterim, onStateChange, onError }) {
    this.lang = lang;
    this.onFinal = onFinal || (() => {});
    this.onInterim = onInterim || (() => {});
    this.onStateChange = onStateChange || (() => {});
    this.onError = onError || (() => {});
    this.recognition = null;
    this.wantListening = false;
    this._restartTimer = null;
  }

  static isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  _build() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0].transcript;
        if (res.isFinal) this.onFinal(text.trim());
        else interim += text;
      }
      if (interim) this.onInterim(interim.trim());
    };

    rec.onerror = (e) => {
      // 'no-speech' и 'aborted' — нормальная часть цикла прослушивания, не показываем как ошибку
      if (e.error !== 'no-speech' && e.error !== 'aborted') this.onError(e.error);
    };

    rec.onend = () => {
      if (this.wantListening) {
        // движок сам завершает сессию через некоторое время — перезапускаем, пока пользователь не остановил вручную
        this._restartTimer = setTimeout(() => { if (this.wantListening) this._startInternal(); }, 250);
      } else {
        this.onStateChange('stopped');
      }
    };

    return rec;
  }

  _startInternal() {
    this.recognition = this._build();
    try {
      this.recognition.start();
      this.onStateChange('listening');
    } catch (e) {
      // start() может бросить InvalidStateError, если вызван повторно слишком быстро
    }
  }

  start() {
    if (!SpeechEngine.isSupported()) {
      this.onError('unsupported');
      return;
    }
    this.wantListening = true;
    this._startInternal();
  }

  stop() {
    this.wantListening = false;
    clearTimeout(this._restartTimer);
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }
  }

  setLang(lang) {
    this.lang = lang;
    if (this.wantListening) {
      this.stop();
      this.wantListening = true;
      this._startInternal();
    }
  }
}
