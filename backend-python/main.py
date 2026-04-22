from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import base64
import io
import json
import os
import time

import pyautogui as py
import requests

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
ELEVENLABS_URL = "https://api.elevenlabs.io/v1/text-to-speech"
TRANSCRIPTION_MODEL = os.getenv("GROQ_TRANSCRIPTION_MODEL", "whisper-large-v3-turbo")

app = Flask(__name__)
CORS(app)


def load_system_prompt():
    prompt_path = os.path.join(BASE_DIR, "system_prompt.md")
    with open(prompt_path, "r", encoding="utf-8") as file:
        return file.read()


def call_groq(user_text):
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY nao configurada.")

    system_prompt = load_system_prompt()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ],
        "temperature": 0.3,
        "max_tokens": 500,
    }
    response = requests.post(GROQ_CHAT_URL, headers=headers, json=payload, timeout=60)
    response.raise_for_status()

    data = response.json()
    if "choices" not in data:
        raise RuntimeError(f"Sem choices na resposta da Groq: {data}")

    return data["choices"][0]["message"]["content"]


def transcribe_audio(uploaded_file):
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY nao configurada.")

    audio_bytes = uploaded_file.read()
    if not audio_bytes:
        raise RuntimeError("Audio vazio recebido para transcricao.")

    uploaded_file.stream.seek(0)

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
    }
    files = {
        "file": (
            uploaded_file.filename or "jarvis-audio.webm",
            io.BytesIO(audio_bytes),
            uploaded_file.mimetype or "audio/webm",
        )
    }
    data = {
        "model": TRANSCRIPTION_MODEL,
        "language": "pt",
        "response_format": "json",
        "temperature": "0",
    }

    response = requests.post(
        GROQ_TRANSCRIBE_URL,
        headers=headers,
        files=files,
        data=data,
        timeout=120,
    )
    response.raise_for_status()

    transcript = response.json().get("text", "").strip()
    if not transcript:
        raise RuntimeError("A transcricao retornou vazia.")

    return transcript


def parse_ai_response(text):
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0].strip()
    return json.loads(text)


def execute_action(action_info):
    action = action_info["action"]
    args = action_info.get("args", [])
    py.PAUSE = 0.1

    if action == "open_app":
        app_name = args[0]
        py.press("win")
        time.sleep(0.5)
        py.write(app_name)
        time.sleep(0.3)
        py.press("enter")
    elif action == "write":
        py.write(args[0])
    elif action == "press":
        py.press(args[0])
    elif action == "hotkey":
        py.hotkey(*args)
    elif action == "sleep":
        time.sleep(args[0])


def synthesize_speech(text):
    if not ELEVENLABS_API_KEY:
        return None

    voice_id = "ErXwobaYiN019PkySvjV"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
        },
    }

    response = requests.post(
        f"{ELEVENLABS_URL}/{voice_id}",
        headers=headers,
        json=payload,
        timeout=60,
    )
    if response.status_code != 200:
        print(f"ElevenLabs TTS erro {response.status_code}: {response.text}")
        return None

    return base64.b64encode(response.content).decode("utf-8")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/transcribe", methods=["POST"])
def transcribe():
    audio = request.files.get("audio")
    if not audio:
        return jsonify({"status": "error", "message": "Arquivo de audio ausente."}), 400

    try:
        transcript = transcribe_audio(audio)
        return jsonify({"status": "ok", "text": transcript})
    except Exception as error:
        print(f"Erro na transcricao: {error}")
        return jsonify({"status": "error", "message": "Nao foi possivel transcrever o audio."}), 500


@app.route("/execute", methods=["POST"])
def execute():
    data = request.json or {}
    user_text = data.get("text", "").strip()
    if not user_text:
        return jsonify({"status": "error", "speech": "Nao recebi nenhum comando.", "audio": None}), 400

    try:
        ai_text = call_groq(user_text)
        ai_data = parse_ai_response(ai_text)

        tools = ai_data.get("tools", [])
        speech = ai_data.get("speech", "Comando executado.")

        for tool in tools:
            execute_action(tool)

        audio_b64 = synthesize_speech(speech)

        return jsonify({
            "status": "executed",
            "speech": speech,
            "audio": audio_b64,
        })
    except Exception as error:
        print(f"Erro: {error}")
        return jsonify({
            "status": "error",
            "speech": "Desculpe, houve um erro. Tente novamente.",
            "audio": None,
        }), 500


if __name__ == "__main__":
    app.run(port=5000, debug=False)
