/**
 * Hands microphone audio to the side panel as 16-bit PCM.
 *
 * It is a file in the extension package, not a Blob, because the extension's
 * content security policy only allows scripts from the package itself. The
 * context that loads it runs at 24 kHz, so no resampling is needed here.
 */
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      const pcm = new Int16Array(channel.length);
      for (let i = 0; i < channel.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, channel[i]));
        pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}

registerProcessor('pcm-capture', PcmCapture);
