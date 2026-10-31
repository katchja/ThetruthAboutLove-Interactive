/**
 * Decodes a recorded audio Blob (e.g. audio/webm or audio/mp4 from MediaRecorder)
 * and resamples/encodes it into a 24kHz 16-bit mono LINEAR16 WAV file,
 * matching Google Cloud Text-to-Speech Instant Custom Voice requirements.
 */
export async function encodeBlobToLinear16Wav(
  blob: Blob,
  targetSampleRate = 24000
): Promise<{
  wavBlob: Blob;
  base64Content: string;
  dataUrl: string;
  durationSeconds: number;
}> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();

  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const durationSeconds = decodedBuffer.duration;
    const totalSamples = Math.max(1, Math.ceil(durationSeconds * targetSampleRate));

    // OfflineAudioContext resamples to 24kHz mono cleanly
    const offlineCtx = new OfflineAudioContext(1, totalSamples, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const channelData = renderedBuffer.getChannelData(0);

    // Peak normalize softly if very quiet so voice cloning gets optimal signal
    let maxPeak = 0;
    for (let i = 0; i < channelData.length; i++) {
      const abs = Math.abs(channelData[i]);
      if (abs > maxPeak) maxPeak = abs;
    }
    const gain = maxPeak > 0.02 && maxPeak < 0.85 ? 0.88 / maxPeak : 1.0;

    // Build 44-byte RIFF WAV header + 16-bit PCM payload
    const numSamples = channelData.length;
    const bytesPerSample = 2;
    const dataByteLength = numSamples * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataByteLength);
    const view = new DataView(buffer);

    const writeAscii = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + dataByteLength, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = LINEAR16 PCM)
    view.setUint16(22, 1, true); // NumChannels (1 = mono)
    view.setUint32(24, targetSampleRate, true); // SampleRate (24000 Hz)
    view.setUint32(28, targetSampleRate * bytesPerSample, true); // ByteRate
    view.setUint16(32, bytesPerSample, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    writeAscii(36, 'data');
    view.setUint32(40, dataByteLength, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i] * gain));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }

    const wavBlob = new Blob([buffer], { type: 'audio/wav' });
    const base64Content = arrayBufferToBase64(buffer);
    const dataUrl = `data:audio/wav;base64,${base64Content}`;

    return {
      wavBlob,
      base64Content,
      dataUrl,
      durationSeconds,
    };
  } finally {
    if (audioCtx.state !== 'closed') {
      await audioCtx.close().catch(() => {});
    }
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return window.btoa(binary);
}
