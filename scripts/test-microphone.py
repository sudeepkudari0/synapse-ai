# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "sounddevice",
#     "soundfile",
#     "requests",
#     "numpy",
# ]
# ///
import sounddevice as sd
import soundfile as sf
import requests
import queue
import io
import time
import numpy as np

SERVER_URL = "http://127.0.0.1:8178/inference"
SAMPLE_RATE = 16000
CHANNELS = 1
CHUNK_DURATION = 1.5  # send 1.5 second chunks

print("========================================")
print(" Moonshine Streaming Microphone Test")
print("========================================")
print(f"Server URL: {SERVER_URL}")
print(f"Sending audio chunks every {CHUNK_DURATION} seconds")
print("Press Ctrl+C to stop.\n")

audio_queue = queue.Queue()

def audio_callback(indata, frames, time, status):
    if status:
        print(status)
    audio_queue.put(indata.copy())

def send_to_server(audio_data):
    # Convert numpy array to WAV in memory
    buffer = io.BytesIO()
    sf.write(buffer, audio_data, SAMPLE_RATE, format='WAV', subtype='PCM_16')
    buffer.seek(0)
    
    try:
        start_time = time.time()
        files = {'file': ('chunk.wav', buffer, 'audio/wav')}
        response = requests.post(SERVER_URL, files=files)
        latency = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            text = result.get('text', '').strip()
            if text:
                print(f"[Latency: {latency:.3f}s] Transcription: {text}")
            else:
                print(f"[Latency: {latency:.3f}s] (silence)")
        else:
            print(f"Server Error {response.status_code}: {response.text}")
    except requests.exceptions.ConnectionError:
        print("Waiting for server to start... Connection failed.")
    except Exception as e:
        print(f"Request failed: {e}")

try:
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=CHANNELS, callback=audio_callback):
        print("🎤 Listening... Please speak into your microphone!")
        while True:
            chunk = []
            frames_to_collect = int(SAMPLE_RATE * CHUNK_DURATION)
            collected_frames = 0
            
            while collected_frames < frames_to_collect:
                data = audio_queue.get()
                chunk.append(data)
                collected_frames += len(data)
                
            audio_data = np.concatenate(chunk)
            send_to_server(audio_data)

except KeyboardInterrupt:
    print("\nTest stopped by user.")
