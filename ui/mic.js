class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Int16Array(320);
    this.used = 0;
    this.phase = 0;
    this.sum = 0;
    this.count = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const sample of channel) {
      this.sum += sample;
      this.count++;
      this.phase += 16000;
      if (this.phase < sampleRate) continue;
      this.phase -= sampleRate;
      const value = Math.max(-1, Math.min(1, this.sum / this.count));
      this.chunk[this.used++] = value * (value < 0 ? 32768 : 32767);
      this.count = 0;
      this.sum = 0;
      if (this.used === this.chunk.length) {
        this.port.postMessage(this.chunk.buffer, [this.chunk.buffer]);
        this.chunk = new Int16Array(320);
        this.used = 0;
      }
    }
    return true;
  }
}

registerProcessor('mithra-microphone', MicrophoneProcessor);
