//! Voice activity detection and fixed-size chunking for the capture pipeline.
//!
//! Deliberately dependency-free (std only) so this DSP logic can be compiled
//! and unit-tested on its own — `rustc --test src/audio/vad.rs` — without the
//! Tauri/cpal toolchain the rest of the crate needs.

/// Root-mean-square amplitude of a PCM frame, normalized to 0.0..=1.0.
pub fn rms(samples: &[i16]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_squares: f64 = samples
        .iter()
        .map(|&s| {
            let normalized = f64::from(s) / f64::from(i16::MAX);
            normalized * normalized
        })
        .sum();
    ((sum_squares / samples.len() as f64).sqrt()) as f32
}

#[derive(Debug, Clone, Copy)]
pub struct VadConfig {
    /// RMS below this counts as silence.
    pub rms_threshold: f32,
    /// Keep passing audio for this many chunks after speech stops, so word
    /// endings and short pauses mid-sentence are not clipped off.
    pub hangover_chunks: u32,
}

impl Default for VadConfig {
    fn default() -> Self {
        Self {
            rms_threshold: 0.01,
            hangover_chunks: 8,
        }
    }
}

/// Energy-based voice activity detector with a hangover tail.
#[derive(Debug)]
pub struct Vad {
    config: VadConfig,
    hangover_remaining: u32,
}

impl Vad {
    pub fn new(config: VadConfig) -> Self {
        Self {
            config,
            hangover_remaining: 0,
        }
    }

    /// Returns true if this chunk should be forwarded to speech-to-text.
    /// Silence past the hangover window is dropped, which is what keeps idle
    /// stretches of an interview from being uploaded and billed.
    pub fn accepts(&mut self, samples: &[i16]) -> bool {
        if rms(samples) >= self.config.rms_threshold {
            self.hangover_remaining = self.config.hangover_chunks;
            true
        } else if self.hangover_remaining > 0 {
            self.hangover_remaining -= 1;
            true
        } else {
            false
        }
    }

    pub fn reset(&mut self) {
        self.hangover_remaining = 0;
    }
}

/// Accumulates the variable-length buffers cpal hands us into fixed-size
/// chunks, so downstream STT sees a steady frame size and memory stays
/// bounded regardless of how long the session runs.
#[derive(Debug)]
pub struct Chunker {
    target_len: usize,
    buffer: Vec<i16>,
}

impl Chunker {
    pub fn new(target_len: usize) -> Self {
        assert!(target_len > 0, "chunk length must be non-zero");
        Self {
            target_len,
            buffer: Vec::with_capacity(target_len * 2),
        }
    }

    /// Chunk length in samples for `chunk_ms` of mono audio at `sample_rate`.
    pub fn from_duration(sample_rate: u32, chunk_ms: u32) -> Self {
        let len = (sample_rate as usize * chunk_ms as usize) / 1000;
        Self::new(len.max(1))
    }

    /// Feeds samples in and returns every chunk that became complete.
    pub fn push(&mut self, samples: &[i16]) -> Vec<Vec<i16>> {
        self.buffer.extend_from_slice(samples);
        let mut chunks = Vec::new();
        while self.buffer.len() >= self.target_len {
            chunks.push(self.buffer.drain(..self.target_len).collect());
        }
        chunks
    }

    /// Returns whatever partial audio is left, e.g. when capture stops.
    pub fn flush(&mut self) -> Option<Vec<i16>> {
        if self.buffer.is_empty() {
            None
        } else {
            Some(std::mem::take(&mut self.buffer))
        }
    }

    pub fn buffered_len(&self) -> usize {
        self.buffer.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tone(len: usize, amplitude: i16) -> Vec<i16> {
        (0..len)
            .map(|i| if i % 2 == 0 { amplitude } else { -amplitude })
            .collect()
    }

    #[test]
    fn rms_of_silence_is_zero() {
        assert_eq!(rms(&vec![0i16; 128]), 0.0);
    }

    #[test]
    fn rms_of_empty_frame_is_zero() {
        assert_eq!(rms(&[]), 0.0);
    }

    #[test]
    fn rms_of_full_scale_square_wave_is_one() {
        let value = rms(&tone(128, i16::MAX));
        assert!((value - 1.0).abs() < 1e-3, "expected ~1.0, got {value}");
    }

    #[test]
    fn rms_grows_with_amplitude() {
        let quiet = rms(&tone(128, 1_000));
        let loud = rms(&tone(128, 20_000));
        assert!(loud > quiet);
    }

    #[test]
    fn vad_accepts_speech_and_rejects_sustained_silence() {
        let mut vad = Vad::new(VadConfig {
            rms_threshold: 0.01,
            hangover_chunks: 2,
        });
        let silence = vec![0i16; 128];

        assert!(vad.accepts(&tone(128, 20_000)), "loud frame must pass");
        // Hangover keeps the tail alive for exactly two more silent chunks.
        assert!(vad.accepts(&silence));
        assert!(vad.accepts(&silence));
        assert!(!vad.accepts(&silence), "silence past hangover must be dropped");
    }

    #[test]
    fn vad_hangover_resets_on_new_speech() {
        let mut vad = Vad::new(VadConfig {
            rms_threshold: 0.01,
            hangover_chunks: 1,
        });
        let silence = vec![0i16; 128];

        assert!(vad.accepts(&tone(128, 20_000)));
        assert!(vad.accepts(&silence));
        assert!(!vad.accepts(&silence));
        // Speech again re-arms the full hangover budget.
        assert!(vad.accepts(&tone(128, 20_000)));
        assert!(vad.accepts(&silence));
        assert!(!vad.accepts(&silence));
    }

    #[test]
    fn vad_rejects_silence_from_the_start() {
        let mut vad = Vad::new(VadConfig::default());
        assert!(!vad.accepts(&vec![0i16; 256]));
    }

    #[test]
    fn chunker_emits_only_complete_chunks() {
        let mut chunker = Chunker::new(4);
        assert!(chunker.push(&[1, 2, 3]).is_empty(), "partial chunk must not emit");
        let chunks = chunker.push(&[4, 5]);
        assert_eq!(chunks, vec![vec![1, 2, 3, 4]]);
        assert_eq!(chunker.buffered_len(), 1);
    }

    #[test]
    fn chunker_emits_multiple_chunks_from_one_large_push() {
        let mut chunker = Chunker::new(2);
        let chunks = chunker.push(&[1, 2, 3, 4, 5, 6, 7]);
        assert_eq!(chunks, vec![vec![1, 2], vec![3, 4], vec![5, 6]]);
        assert_eq!(chunker.buffered_len(), 1);
    }

    #[test]
    fn chunker_flush_returns_remainder_then_nothing() {
        let mut chunker = Chunker::new(4);
        chunker.push(&[1, 2, 3]);
        assert_eq!(chunker.flush(), Some(vec![1, 2, 3]));
        assert_eq!(chunker.flush(), None);
    }

    #[test]
    fn chunker_from_duration_computes_sample_count() {
        // 20 ms at 48 kHz is 960 samples.
        let chunker = Chunker::from_duration(48_000, 20);
        assert_eq!(chunker.target_len, 960);
    }

    #[test]
    fn chunker_memory_stays_bounded_across_a_long_stream() {
        let mut chunker = Chunker::new(160);
        for _ in 0..1_000 {
            chunker.push(&[7i16; 100]);
        }
        // Whatever we feed in, at most one incomplete chunk is ever retained.
        assert!(chunker.buffered_len() < 160);
    }
}
