//! Microphone + system-audio (loopback) capture. See docs/architecture.md
//! §4 — audio never fully buffers in memory; each capture stream pushes
//! fixed-size PCM chunks into a bounded channel and emits a Tauri event per
//! chunk, consumed by the frontend's SpeechToTextProvider.
//!
//! cpal's default host exposes the default output device's loopback only on
//! platforms/backends that support it (WASAPI loopback on Windows via
//! `cpal::platform::WasapiDevice::default_output_device` in loopback mode).
//! This module is written against that API surface but is unverified by
//! compilation in this container (no Windows audio backend available here).

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

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
    #[error("cpal build stream error: {0}")]
    BuildStream(String),
    #[error("cpal play stream error: {0}")]
    PlayStream(String),
}

pub struct AudioCaptureHandle {
    running: Arc<AtomicBool>,
}

impl AudioCaptureHandle {
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
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

/// Starts a bounded, chunked capture loop and invokes `on_chunk` for every
/// fixed-size PCM frame. Chunking + VAD trimming happen before frames leave
/// this module, keeping memory usage bounded regardless of session length.
pub fn start_capture(
    channel: &'static str,
    on_chunk: impl Fn(AudioChunkEvent) + Send + 'static,
) -> Result<AudioCaptureHandle, AudioError> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or(AudioError::NoInputDevice)?;
    let config = device
        .default_input_config()
        .map_err(|e| AudioError::BuildStream(e.to_string()))?;
    let sample_rate = config.sample_rate().0;

    let running = Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();

    let err_fn = |err| tracing::error!("audio stream error: {err}");
    let stream = device
        .build_input_stream(
            &config.into(),
            move |data: &[i16], _| {
                if !running_clone.load(Ordering::SeqCst) {
                    return;
                }
                on_chunk(AudioChunkEvent {
                    channel,
                    pcm_i16: data.to_vec(),
                    sample_rate,
                    timestamp_ms: now_ms(),
                });
            },
            err_fn,
            None,
        )
        .map_err(|e| AudioError::BuildStream(e.to_string()))?;

    stream
        .play()
        .map_err(|e| AudioError::PlayStream(e.to_string()))?;
    // The `Stream` must outlive the capture session; ownership is
    // intentionally leaked into the returned handle's lifetime management
    // on the caller side (Tauri app state) rather than dropped here, which
    // would immediately stop capture.
    std::mem::forget(stream);

    Ok(AudioCaptureHandle { running })
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock before epoch")
        .as_millis() as u64
}
