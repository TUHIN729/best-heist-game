// Sound, synthesised live with WebAudio: no audio files, no network, nothing to load. A soft
// tick for footsteps is skipped (it gets old fast); what remains is a blip for loot, a rising
// two-tone alarm while the meter climbs, a low sting for being caught, a short fanfare for the
// getaway, and a click for each tool. Everything starts on the first user gesture, and M mutes.

export function createAudio() {
  let context = null;
  let muted = false;
  let alarmNodes = null;

  function ensure() {
    if (context === null) {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  }

  function tone(frequency, duration, type, volume, when = 0, slideTo = null) {
    const audio = ensure();
    if (audio === null || muted) return;
    const start = audio.currentTime + when;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo !== null) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  return {
    /** Call from any user gesture: unlocks audio in browsers that need one. */
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopAlarm();
      return muted;
    },
    gold() {
      tone(880, 0.12, 'sine', 0.12);
      tone(1318, 0.18, 'sine', 0.1, 0.07);
    },
    ledger() {
      tone(523, 0.16, 'triangle', 0.14);
      tone(659, 0.16, 'triangle', 0.14, 0.12);
      tone(784, 0.3, 'triangle', 0.14, 0.24);
    },
    door() {
      tone(220, 0.4, 'sawtooth', 0.06, 0, 110);
      tone(440, 0.2, 'sine', 0.08, 0.3);
    },
    tool() {
      tone(1200, 0.08, 'square', 0.05);
      tone(900, 0.1, 'square', 0.05, 0.06);
    },
    caught() {
      tone(196, 0.5, 'sawtooth', 0.14, 0, 98);
      tone(147, 0.7, 'sawtooth', 0.12, 0.15, 73);
    },
    win() {
      tone(523, 0.18, 'triangle', 0.14);
      tone(659, 0.18, 'triangle', 0.14, 0.14);
      tone(784, 0.18, 'triangle', 0.14, 0.28);
      tone(1046, 0.45, 'triangle', 0.14, 0.42);
    },
    /** The alarm hum: two detuned saws whose volume follows the meter. Call every frame. */
    alarm(level) {
      const audio = ensure();
      if (audio === null) return;
      if (muted || level <= 0.25) {
        this.stopAlarm();
        return;
      }
      if (alarmNodes === null) {
        const oscillatorA = audio.createOscillator();
        const oscillatorB = audio.createOscillator();
        const gain = audio.createGain();
        oscillatorA.type = 'sawtooth';
        oscillatorB.type = 'sawtooth';
        oscillatorA.frequency.value = 110;
        oscillatorB.frequency.value = 116;
        gain.gain.value = 0;
        oscillatorA.connect(gain);
        oscillatorB.connect(gain);
        gain.connect(audio.destination);
        oscillatorA.start();
        oscillatorB.start();
        alarmNodes = { oscillatorA, oscillatorB, gain };
      }
      alarmNodes.gain.gain.setTargetAtTime(0.02 + 0.05 * level, audio.currentTime, 0.2);
    },
    stopAlarm() {
      if (alarmNodes === null) return;
      try {
        alarmNodes.gain.gain.setTargetAtTime(0, context.currentTime, 0.05);
        const nodes = alarmNodes;
        alarmNodes = null;
        window.setTimeout(() => {
          try {
            nodes.oscillatorA.stop();
            nodes.oscillatorB.stop();
          } catch {
            // Already stopped.
          }
        }, 300);
      } catch {
        alarmNodes = null;
      }
    },
  };
}
