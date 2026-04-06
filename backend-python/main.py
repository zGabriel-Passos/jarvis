from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import pyautogui as py
import requests
import json
import time
import os
import base64

load_dotenv()

app = Flask(__name__)
CORS(app)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_URL = "https://api.elevenlabs.io/v1/text-to-speech"

def load_system_prompt():
    with open("system_prompt.md", "r", encoding="utf-8") as f:
        return f.read()

def call_groq(user_text):
    system_prompt = load_system_prompt()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text}
        ],
        "temperature": 0.3,
        "max_tokens": 500
    }
    response = requests.post(GROQ_URL, headers=headers, json=payload)
    if response.status_code != 200:
        raise Exception(f"Groq API erro {response.status_code}: {response.text}")
    data = response.json()
    if "choices" not in data:
        raise Exception(f"Sem choices na resposta da Groq: {data}")
    return data["choices"][0]["message"]["content"]

def parse_ai_response(text):
    # try to extract JSON from response
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
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
    # Voz ElevenLabs: Antoni (masculina, calma, boa pra PT-BR)
    voice_id = "ErXwobaYiN019PkySvjV"  # Antoni
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }
    print(f"ElevenLabs TTS: gerando áudio para: {text}")
    response = requests.post(
        f"{ELEVENLABS_URL}/{voice_id}",
        headers=headers,
        json=payload
    )
    if response.status_code == 200:
        audio_b64 = base64.b64encode(response.content).decode("utf-8")
        print(f"ElevenLabs TTS: áudio gerado com sucesso, {len(audio_b64)} chars base64")
        return audio_b64
    else:
        print(f"ElevenLabs TTS: ERRO status {response.status_code}: {response.text}")
    return None

@app.route("/execute", methods=["POST"])
def execute():
    data = request.json
    user_text = data.get("text", "").strip()

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
            "audio": audio_b64
        })

    except Exception as e:
        print(f"Erro: {e}")
        return jsonify({
            "status": "error",
            "speech": "Desculpe, houve um erro. Tente novamente.",
            "audio": None
        })

if __name__ == "__main__":
    app.run(port=5000, debug=True)
