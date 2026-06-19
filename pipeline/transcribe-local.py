#!/usr/bin/env python
# Local transcription with word timestamps via faster-whisper (CUDA).
# Usage: python transcribe-local.py <audio-or-video> <out.txt> <out_words.json>
# Env: WHISPER_MODEL (large-v3), WHISPER_DEVICE (cuda), WHISPER_COMPUTE (float16)
import sys, os, json

inp, outtxt, outjson = sys.argv[1], sys.argv[2], sys.argv[3]
model_size = os.environ.get("WHISPER_MODEL", "large-v3")
device     = os.environ.get("WHISPER_DEVICE", "cuda")
compute    = os.environ.get("WHISPER_COMPUTE", "float16")

from faster_whisper import WhisperModel
model = WhisperModel(model_size, device=device, compute_type=compute)
segments, info = model.transcribe(inp, word_timestamps=True, vad_filter=True)

words, text = [], []
for seg in segments:
    text.append(seg.text)
    for w in (seg.words or []):
        t = w.word.strip()
        if t:
            words.append({"text": t, "start": round(w.start, 2), "end": round(w.end, 2)})

with open(outtxt, "w", encoding="utf-8") as f:
    f.write(" ".join(text).strip())
with open(outjson, "w", encoding="utf-8") as f:
    json.dump({"words": words, "duration": getattr(info, "duration", 0)}, f)
print(f"transcript: {len(' '.join(text))} chars, {len(words)} words -> {outtxt}")
