/** Blend a loop tail into its head once. Finished one-shots keep their original samples. */
export function blendLoopSamples(input: Float32Array, overlap: number) {
  overlap = Math.max(
    2,
    Math.min(Math.floor(overlap), Math.floor(input.length / 4)),
  );
  if (input.length < 8) return input.slice();
  const length = input.length - overlap,
    output = input.slice(overlap);
  for (let i = 0; i < overlap; i++) {
    const u = i / (overlap - 1),
      ease = u * u * (3 - 2 * u);
    output[length - overlap + i] =
      input[length + i] * (1 - ease) + input[i] * ease;
  }
  return output;
}
export function blendAudioLoop(
  audio: BaseAudioContext,
  buffer: AudioBuffer,
  seconds = 0.2,
) {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    blendLoopSamples(buffer.getChannelData(i), buffer.sampleRate * seconds),
  );
  const loop = audio.createBuffer(
    buffer.numberOfChannels,
    channels[0].length,
    buffer.sampleRate,
  );
  channels.forEach((channel, i) => loop.getChannelData(i).set(channel));
  return loop;
}
