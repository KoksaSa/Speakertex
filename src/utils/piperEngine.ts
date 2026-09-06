// piperEngine.ts — офлайн нейро-TTS (Piper) поверх @diffusionstudio/vits-web.
//
// Синглтон вне React: управляет загрузкой голосовой модели (кэш в OPFS),
// синтезом в воркере (ONNX) и воспроизведением через <audio> —
// playbackRate с preservesPitch даёт замедление 0.5x/0.7x без «букаса».
// Работает только в защищённом контексте (https/localhost), т.к. требует OPFS.

import * as tts from '@diffusionstudio/vits-web';

export type PiperStatus = 'unsupported' | 'idle' | 'downloading' | 'warming' | 'ready' | 'error';

export interface PiperSnapshot {
  enabled: boolean;
  voiceId: string;
  status: PiperStatus;
  progress: number; // 0..100
  error: string | null;
}

/** Голоса Piper по языкам диктовки приложения (ключи = selectedLang) */
export const PIPER_VOICES: Record<string, Array<{ id: tts.VoiceId; label: string }>> = {
  'ru-RU': [
    { id: 'ru_RU-irina-medium', label: 'Ирина (женский)' },
    { id: 'ru_RU-dmitri-medium', label: 'Дмитрий (мужской)' },
    { id: 'ru_RU-denis-medium', label: 'Денис (мужской)' },
    { id: 'ru_RU-ruslan-medium', label: 'Руслан (мужской)' },
  ],
  'en-US': [
    { id: 'en_US-amy-medium', label: 'Amy (female)' },
    { id: 'en_US-ryan-medium', label: 'Ryan (male)' },
    { id: 'en_US-lessac-medium', label: 'Lessac (female)' },
  ],
  'de-DE': [
    { id: 'de_DE-thorsten-medium', label: 'Thorsten (männlich)' },
    { id: 'de_DE-mls-medium', label: 'MLS' },
  ],
  'es-ES': [
    { id: 'es_ES-sharvard-medium', label: 'Sharvard (femenino)' },
    { id: 'es_ES-davefx-medium', label: 'Davefx (masculino)' },
  ],
  'fr-FR': [
    { id: 'fr_FR-siwis-medium', label: 'Siwis (féminin)' },
    { id: 'fr_FR-tom-medium', label: 'Tom (masculin)' },
  ],
  'kk-KZ': [
    { id: 'kk_KZ-issai-high', label: 'ISSAI (high, ~115 МБ)' },
    { id: 'kk_KZ-raya-x_low', label: 'Рая (x_low)' },
  ],
};

export const getVoicesForLang = (lang: string): Array<{ id: tts.VoiceId; label: string }> =>
  PIPER_VOICES[lang] ?? [];

const ALL_VOICE_IDS = () => Object.values(PIPER_VOICES).flat().map((v) => v.id);

const LS_ENABLED = 'piperEnabled';
const LS_VOICE = 'piperVoiceId';

class PiperEngine {
  private enabled = false;
  private voiceId: tts.VoiceId = 'ru_RU-irina-medium';
  private status: PiperStatus = 'idle';
  private progress = 0;
  private error: string | null = null;

  private audio: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;
  private generation = 0; // токен отмены: синтез, начатый ранее, игнорируется
  private onEnd: (() => void) | null = null;
  private paused = false;

  private listeners = new Set<() => void>();
  private snapshot: PiperSnapshot;

  // Отладочный журнал (используется в тестах): кто и когда вызывает play/pause/stop
  private static DEBUG = true;
  private log(ev: string, extra?: object) {
    if (!PiperEngine.DEBUG) return;
    const w = window as unknown as { __piperLog?: unknown[] };
    if (!w.__piperLog) w.__piperLog = [];
    w.__piperLog.push({ ev, t: new Date().toISOString().slice(17, 23), ...extra });
  }

  constructor() {
    try {
      this.enabled = localStorage.getItem(LS_ENABLED) === '1';
      const v = localStorage.getItem(LS_VOICE);
      if (v && ALL_VOICE_IDS().includes(v as tts.VoiceId)) this.voiceId = v as tts.VoiceId;
    } catch {
      /* приватный режим — просто не восстанавливаем */
    }
    if (!(navigator.storage && typeof navigator.storage.getDirectory === 'function')) {
      this.status = 'unsupported';
    }
    this.snapshot = this.buildSnapshot();
    // Piper был включён ранее — готовим движок в фоне (модель уже в OPFS)
    if (this.enabled && this.status === 'idle') void this.prepare();
  }

  // --- подписка для React (useSyncExternalStore) ---

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getSnapshot = (): PiperSnapshot => this.snapshot;

  private buildSnapshot(): PiperSnapshot {
    return {
      enabled: this.enabled,
      voiceId: this.voiceId,
      status: this.status,
      progress: this.progress,
      error: this.error,
    };
  }

  private notify() {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((l) => l());
  }

  // --- состояние ---

  /** Piper активен и готов к синтезу — главный флаг маршрутизации озвучки */
  isActive(): boolean {
    return this.enabled && this.status === 'ready';
  }

  // --- настройки ---

  setEnabled(v: boolean) {
    this.enabled = v;
    try { localStorage.setItem(LS_ENABLED, v ? '1' : '0'); } catch {}
    this.notify();
    if (v && (this.status === 'idle' || this.status === 'error')) {
      void this.prepare();
    }
  }

  setVoice(id: string) {
    if (!ALL_VOICE_IDS().includes(id as tts.VoiceId)) return;
    this.voiceId = id as tts.VoiceId;
    try { localStorage.setItem(LS_VOICE, id); } catch {}
    this.notify();
    // новая модель не скачана — готовим её, если Piper включён
    if (this.enabled) void this.prepare(true);
  }

  // --- загрузка/подготовка модели ---

  /** Скачивает модель (если нужно), прогревает WASM-движок и переходит в ready */
  async prepare(force = false): Promise<void> {
    if (this.status === 'unsupported') return;
    if (this.status === 'downloading' || this.status === 'warming') return;
    if (this.status === 'ready' && !force) return;

    this.error = null;
    this.status = 'downloading';
    this.progress = 0;
    this.notify();

    try {
      // OPFS недоступен (file://, приватные режимы) — getDirectory бросит исключение
      await navigator.storage.getDirectory();

      const stored = (await tts.stored().catch(() => [] as string[])) as string[];
      if (!stored.includes(this.voiceId)) {
        await tts.download(this.voiceId, (p) => {
          this.progress = Math.min(99, Math.round((p.loaded * 100) / Math.max(p.total, 1)));
          this.notify();
        });
      }

      // Прогрев: первая инференция подгружает ORT-wasm и piper-phonemize с CDN;
      // выявляем проблемы (блокировки, отсутствие WASM) до старта диктовки
      this.status = 'warming';
      this.notify();
      await tts.predict({ text: '.', voiceId: this.voiceId });

      this.status = 'ready';
      this.progress = 100;
      this.notify();
    } catch (e) {
      // file:// без OPFS — сообщаем понятным статусом
      this.status = 'unsupported';
      this.error = e instanceof Error ? e.message : String(e);
      this.enabled = false;
      try { localStorage.setItem(LS_ENABLED, '0'); } catch {}
      this.notify();
    }
  }

  /** Удаляет модель из хранилища (освобождение места) */
  async remove(): Promise<void> {
    try { await tts.remove(this.voiceId); } catch {}
    if (this.status === 'ready') {
      this.status = 'idle';
      this.progress = 0;
      this.notify();
    }
  }

  // --- воспроизведение ---

  /**
   * Синтез + воспроизведение. onEnd вызывается по окончании звука
   * (или сразу при ошибке — чтобы цепочка диктовки не зависла).
   * rate — итоговый темп (уже включает множитель скорости диктовки).
   */
  speak(text: string, rate: number, onEnd?: () => void): void {
    if (!this.isActive()) {
      onEnd?.();
      return;
    }
    const gen = ++this.generation;
    this.onEnd = onEnd ?? null;
    this.paused = false;

    tts.predict({ text, voiceId: this.voiceId })
      .then((wav) => {
        if (gen !== this.generation) return; // остановлено/заменено во время синтеза

        if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
        this.audioUrl = URL.createObjectURL(wav);

        const a = this.audio ?? new Audio();
        this.audio = a;
        a.src = this.audioUrl;
        a.playbackRate = Math.min(Math.max(rate, 0.1), 4);
        a.preservesPitch = true; // замедление без искажения тона
        (window as unknown as { __piperAudio?: HTMLAudioElement }).__piperAudio = a; // отладка/тесты
        a.onpause = () => this.log('onpause', { rate: a.playbackRate, t: a.currentTime.toFixed(2), stack: new Error().stack?.split('\n').slice(2, 5).join(' | ') });
        a.onplay = () => this.log('onplay', { rate: a.playbackRate, t: a.currentTime.toFixed(2) });
        a.onended = () => {
          this.log('onended', { rate: a.playbackRate });
          (window as unknown as { __piperLastEnd?: number }).__piperLastEnd = Date.now();
          if (gen !== this.generation) return;
          const cb = this.onEnd;
          this.onEnd = null;
          cb?.();
        };
        if (this.paused) {
          this.log('speak:держим (paused=true)', { rate });
          return; // пауза нажата во время синтеза — ждём resume()
        }

        this.log('speak:play()', { rate });
        a.play().catch((err) => {
          this.log('speak:play() отклонён', { err: String(err) });
          // автоплей-политика/ошибка — не блокируем диктовку
          if (gen !== this.generation) return;
          const cb = this.onEnd;
          this.onEnd = null;
          cb?.();
        });
      })
      .catch(() => {
        if (gen !== this.generation) return;
        const cb = this.onEnd;
        this.onEnd = null;
        cb?.();
      });
  }

  stop() {
    this.log('stop()');
    this.generation++;
    this.onEnd = null;
    this.paused = false;
    if (this.audio) {
      this.audio.pause();
      try { this.audio.currentTime = 0; } catch {}
    }
  }

  pause() {
    this.log('pause()', { stack: new Error().stack?.split('\n').slice(2, 5).join(' | ') });
    this.paused = true;
    if (this.audio && !this.audio.paused) this.audio.pause();
  }

  resume() {
    this.log('resume()', { readyState: this.audio?.readyState });
    this.paused = false;
    if (this.audio && this.audio.readyState >= 2) {
      this.audio.play().catch(() => {});
    }
  }
}

export const piperEngine = new PiperEngine();
