from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import pyautogui as py
import requests
import json
import time
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

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
    data = response.json()
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

        return jsonify({
            "status": "executed",
            "speech": speech
        })

    except Exception as e:
        print(f"Erro: {e}")
        return jsonify({
            "status": "error",
            "speech": "Desculpe, houve um erro. Tente novamente."
        })

if __name__ == "__main__":
    app.run(port=5000, debug=True)
