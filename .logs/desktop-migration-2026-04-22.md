# Relatorio de Migracao Desktop

Data: 2026-04-22

## Objetivo

Remover a dependencia direta de reconhecimento de voz do navegador e passar o projeto para um fluxo desktop com Electron.

## O que mudou

- Adicionado `Electron` como container desktop.
- Criado `electron/main.cjs` para abrir a janela e subir o backend Flask.
- Criado `scripts/desktop-dev.cjs` para iniciar Next.js e Electron com um unico comando.
- Substituido `webkitSpeechRecognition` por captura de audio com `MediaRecorder`.
- Adicionado endpoint `POST /transcribe` no Flask usando `https://api.groq.com/openai/v1/audio/transcriptions`.
- Mantido `POST /execute` para interpretar a frase e executar as automacoes.
- Mantida a ElevenLabs como TTS, nao como reconhecimento.
- Atualizada a interface para refletir o modo desktop.
- Atualizado `README.md` com a nova forma de execucao.

## Arquivos alterados

- `package.json`
- `backend-python/main.py`
- `components/LandingPage.tsx`
- `README.md`

## Arquivos novos

- `electron/main.cjs`
- `electron/preload.cjs`
- `scripts/desktop-dev.cjs`
- `.logs/desktop-migration-2026-04-22.md`

## Riscos e proximos passos

- O fluxo atual de desktop esta pronto para desenvolvimento local com `npm run desktop`.
- Empacotamento distribuivel `.exe` ainda nao foi implementado.
- O backend Python ainda depende de Python instalado na maquina do usuario.
- Vale considerar um empacotamento futuro com backend embutido ou instalador dedicado.
