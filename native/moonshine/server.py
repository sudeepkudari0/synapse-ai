import os
import io
import argparse
import soundfile as sf
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

# Force ONNX Runtime to use CUDA
os.environ["CUDA_VISIBLE_DEVICES"] = "0" 

app = FastAPI()
transcriber = None

@app.on_event("startup")
def initialize_model():
    global transcriber
    from moonshine_voice.download import get_model_for_language
    from moonshine_voice import ModelArch
    from moonshine_voice.transcriber import Transcriber
    
    print("Loading Moonshine v2 (streaming-medium) on CUDA...")
    
    path, arch = get_model_for_language('en', ModelArch.MEDIUM_STREAMING)
    
    try:
        transcriber = Transcriber(
            model_path=str(path),
            model_arch=arch,
            options={"providers": ["CUDAExecutionProvider", "CPUExecutionProvider"]}
        )
    except Exception as e:
        print(f"Warning, failed with providers option: {e}")
        transcriber = Transcriber(model_path=str(path), model_arch=arch)

    print("Model loaded successfully.")

@app.post("/inference")
async def inference(file: UploadFile = File(...)):
    if not transcriber:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        audio_bytes = await file.read()
        audio_data, sample_rate = sf.read(io.BytesIO(audio_bytes), dtype='float32')
        
        if len(audio_data.shape) > 1:
            audio_data = audio_data.mean(axis=1)

        # Run transcription using transcribe_without_streaming
        audio_list = audio_data.tolist()
        res = transcriber.transcribe_without_streaming(audio_list, sample_rate=int(sample_rate))
        
        segments = []
        text_parts = []
        
        if hasattr(res, 'lines') and res.lines:
            for line in res.lines:
                words = []
                line_text_parts = []
                if hasattr(line, 'words') and line.words:
                    for w in line.words:
                        w_text = w.text if hasattr(w, 'text') else str(w)
                        words.append({
                            "word": w_text,
                            "start": w.start_time if hasattr(w, 'start_time') else 0,
                            "end": w.end_time if hasattr(w, 'end_time') else 0
                        })
                        line_text_parts.append(w_text.strip())
                
                # If we collected words, join them, else fallback to line.text
                line_str = " ".join(line_text_parts) if line_text_parts else (line.text if hasattr(line, 'text') else str(line))
                text_parts.append(line_str)
                
                segments.append({
                    "text": line_str,
                    "start": line.start_time if hasattr(line, 'start_time') else 0,
                    "words": words
                })
        
        text_out = " ".join(text_parts).strip()
        
        # Fallback if no lines were parsed
        if not text_out:
            text_out = str(res)
            import re
            text_out = re.sub(r'\[\d+(\.\d+)?s\]', '', text_out).strip()
            
        return {"text": text_out, "segments": segments}

    except Exception as e:
        import traceback
        print(f"Transcription error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def health():
    return {"status": "ok", "model": "moonshine-streaming-medium"}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', type=str, default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8178)
    args, unknown = parser.parse_known_args() 

    print(f"Starting FastAPI server on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
