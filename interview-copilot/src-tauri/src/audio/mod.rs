//! Microphone + system-audio (loopback) capture. See docs/architecture.md
//! §4 — audio never fully buffers in memory: the cpal callback feeds a
//! `Chunker` that emits fixed-size frames, a `Vad` drops sustained silence,
//! and only surviving chunks are handed to the frontend's
//! SpeechToTextProvider as Tauri events.
//!
//! The capture stream is owned by a dedicated thread because `cpal::Stream`
//! is not `Send` on all platforms and therefore cannot live in Tauri's
//! managed state. The thread holds it until the stop flag flips, at which
//! point the stream is dropped normally.
//!
//! Unverified by compilation in this container (no Windows audio backend);
//! the DSP in `vad.rs` is dependency-free and *is* unit-tested here.

pub mod vad;

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Duration;

use vad::{Chunker, Vad, VadConfig};

/// Frame size handed to speech-to-text. 200 ms balances STT accuracy against
/// the latency budget in docs/requirements.md.
const CHUNK_MS: u32 = 200;

#[derive(Debug, Clone, Serialize)]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct AudioChunkEvent {
    pub channel: &'static str, // "microphone" | "system"
    pub pcm_i16: Vec<i16>,
    pub sample_rate: u32,
    pub timestamp_ms: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum AudioError {
    #[error("no input device available")]
    NoInputDevice,
    #[error("no output device available for loopback capture")]
    NoOutputDevice,
    #[error("unsupported sample format: {0}")]
    UnsupportedSampleFormat(String),
    #[error("cpal build stream error: {0}")]
    BuildStream(String),
    #[error("cpal play stream error: {0}")]
    PlayStream(String),
    #[error("capture thread failed to start")]
    ThreadStartFailed,
}

/// Stops the capture thread (and drops its stream) when told to, and on drop.
pub struct AudioCaptureHandle {
    running: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl AudioCaptureHandle {
    pub fn stop(&mut self) {
        self.running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.thread.take() {
            let _ = handle.join();
        }
    }
}

impl Drop for AudioCaptureHandle {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn list_devices() -> Result<Vec<AudioDeviceInfo>, AudioError> {
    use cpal::traits::{DeviceTrait, HostTrait};
    let host = cpal::default_host();
    let default_input_name = host.default_input_device().and_then(|d| d.name().ok());

    let devices = host
        .input_devices()
        .map_err(|_| AudioError::NoInputDevice)?
        .filter_map(|device| {
            let name = device.name().ok()?;
            let is_default = Some(&name) == default_input_name.as_ref();
            Some(AudioDeviceInfo {
                id: name.clone(),
                name,
                is_default,
            })
        })
        .collect();

    Ok(devices)
}

/// Starts capture on a dedicated thread. `on_chunk` is invoked once per
/// fixed-size chunk that survives voice-activity detection.
pub fn start_capture(
    channel: &'static str,
    on_chunk: impl Fn(AudioChunkEvent) + Send + 'static,
) -> Result<AudioCaptureHandle, AudioError> {
    let running = Arc::new(AtomicBool::new(true));
    let running_thread = running.clone();
    // The stream is built on the capture thread, so startup errors have to be
    // reported back here rather than returned directly.
    let (ready_tx, ready_rx) = mpsc::channel::<Result<(), AudioError>>();

    let thread = thread::spawn(move || {
        let stream = match build_stream(channel, running_thread.clone(), on_chunk) {
            Ok(stream) => {
                let _ = ready_tx.send(Ok(()));
                stream
            }
            Err(error) => {
                let _ = ready_tx.send(Err(error));
                return;
            }
        };

        while running_thread.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(50));
        }
        drop(stream);
    });

    match ready_rx.recv() {
        Ok(Ok(())) => Ok(AudioCaptureHandle {
            running,
            thread: Some(thread),
        }),
        Ok(Err(error)) => Err(error),
        Err(_) => Err(AudioError::ThreadStartFailed),
    }
}

fn build_stream(
    channel: &'static str,
    running: Arc<AtomicBool>,
    on_chunk: impl Fn(AudioChunkEvent) + Send + 'static,
) -> Result<cpal::Stream, AudioError> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or(AudioError::NoInputDevice)?;
    let supported = device
        .default_input_config()
        .map_err(|e| AudioError::BuildStream(e.to_string()))?;
    let sample_rate = supported.sample_rate().0;
    let sample_format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();

    let mut chunker = Chunker::from_duration(sample_rate, CHUNK_MS);
    let mut vad = Vad::new(VadConfig::default());

    // Shared by both sample-format branches: chunk, gate on VAD, emit.
    let mut process = move |samples: &[i16]| {
        if !running.load(Ordering::SeqCst) {
            return;
        }
        for chunk in chunker.push(samples) {
            if !vad.accepts(&chunk) {
                continue;
            }
            on_chunk(AudioChunkEvent {
                channel,
                pcm_i16: chunk,
                sample_rate,
                timestamp_ms: now_ms(),
            });
        }
    };

    let err_fn = |err| tracing::error!("audio stream error: {err}");

    let stream = match sample_format {
        cpal::SampleFormat::I16 => device
            .build_input_stream(&config, move |data: &[i16], _| process(data), err_fn, None)
            .map_err(|e| AudioError::BuildStream(e.to_string()))?,
        // Windows shared-mode WASAPI most often hands back f32, so this is the
        // common path rather than a fallback.
        cpal::SampleFormat::F32 => device
            .build_input_stream(
                &config,
                move |data: &[f32], _| {
                    let converted: Vec<i16> = data.iter().copied().map(f32_to_i16).collect();
                    process(&converted);
                },
                err_fn,
                None,
            )
            .map_err(|e| AudioError::BuildStream(e.to_string()))?,
        other => return Err(AudioError::UnsupportedSampleFormat(format!("{other:?}"))),
    };

    stream
        .play()
        .map_err(|e| AudioError::PlayStream(e.to_string()))?;
    Ok(stream)
}

fn f32_to_i16(sample: f32) -> i16 {
    (sample.clamp(-1.0, 1.0) * f32::from(i16::MAX)) as i16
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock before epoch")
        .as_millis() as u64
}
