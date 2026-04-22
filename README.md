# Jarvis

Assistente de voz desktop para Windows com `Electron`, `Next.js` e `Flask`.

Jarvis captura sua fala no app desktop, transcreve o audio com Groq Whisper, interpreta o comando com Groq LLaMA, executa a automacao local com `pyautogui` e responde com audio pela ElevenLabs.

## Stack

- `Electron` para janela desktop
- `Next.js` para interface
- `Flask` para API local e automacao
- `Groq` para transcricao e interpretacao
- `ElevenLabs` para resposta em voz
- `PyAutoGUI` para comandos no Windows

## Arquitetura

```text
Electron desktop app
  -> carrega a interface Next.js
  -> inicia o backend Flask localmente

Next.js UI
  -> grava audio pelo microfone
  -> envia o audio para /transcribe
  -> envia o texto final para /execute

Flask API
  -> transcreve com Groq Whisper
  -> interpreta com Groq LLaMA
  -> executa acoes no Windows
  -> gera audio de resposta com ElevenLabs
```

## Requisitos

- Node.js 18+
- Python 3.10+ recomendado
- Windows
- `GROQ_API_KEY`
- `ELEVENLABS_API_KEY` opcional, mas recomendada

## Instalacao

### 1. Dependencias do frontend e Electron

```bash
npm install
```

### 2. Dependencias do backend Python

```bash
cd backend-python
pip install -r requirements.txt
```

### 3. Variaveis de ambiente

```bash
cd backend-python
copy .env.example .env
```

Edite `backend-python/.env` com suas chaves.

## Rodando o app desktop

Na raiz do projeto:

```bash
npm run desktop
```

Esse comando:

1. sobe o Next.js em `http://127.0.0.1:3000`
2. abre o Electron
3. faz o Electron iniciar o Flask em `http://127.0.0.1:5000`

## Fluxo de voz

1. Clique no botao do microfone.
2. Fale normalmente.
3. O app detecta silencio e fecha a captura da frase.
4. O Flask transcreve o audio em `/transcribe`.
5. O texto vai para `/execute`.
6. Jarvis executa o comando e toca a resposta em audio.

## Endpoints locais

- `GET /health`
- `POST /transcribe`
- `POST /execute`

## Comandos de exemplo

- `abre o navegador`
- `abra o whatsapp`
- `nova aba`
- `copiar`
- `colar`
- `escreva bom dia`
- `pressione enter`

## Observacoes

- O reconhecimento de voz nao depende mais de `webkitSpeechRecognition`.
- A ElevenLabs continua sendo apenas a etapa de texto para fala.
- Se o comando `py` nao existir na sua maquina, defina `JARVIS_PYTHON_BIN` antes de abrir o Electron.

## Estrutura

```text
jarvis-simple/
|-- app/
|-- assets/
|-- backend-python/
|   |-- main.py
|   |-- requirements.txt
|   `-- system_prompt.md
|-- components/
|-- electron/
|   |-- main.cjs
|   `-- preload.cjs
|-- scripts/
|   `-- desktop-dev.cjs
`-- README.md
```
