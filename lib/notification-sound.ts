let audioContext: AudioContext | null = null;
let lastPlayedAt = 0;

export function playNotificationSound() {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastPlayedAt < 900) return;
  lastPlayedAt = now;

  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextCtor) return;

    audioContext ??= new AudioContextCtor();

    const context = audioContext;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      1174,
      context.currentTime + 0.08
    );

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  } catch {
    // Browsers can block audio until the user has interacted with the page.
  }
}
