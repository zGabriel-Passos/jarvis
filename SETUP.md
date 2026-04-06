# 🤖 Jarvis — Setup

Assistente de voz com IA (Groq) que controla seu PC.

## 🚀 Como Configurar e Usar

### 1. Instalar dependências Python

```bash
cd backend-python
pip install -r requirements.txt
```

### 2. Configurar a API Key

```bash
cd backend-python
copy .env.example .env
```

Abra o `.env` e cole sua Groq API Key:

```
GROQ_API_KEY=sua_chave_aqui
```

Obtenha uma chave grátis em [console.groq.com](https://console.groq.com).

### 3. Iniciar Backend Python

```bash
cd backend-python
python main.py
```

API rodará em `http://localhost:5000`

### 4. Iniciar Frontend Next.js (outro terminal)

```bash
npm run dev
```

Frontend rodará em `http://localhost:3000`

### 5. Começar a Usar

1. Abra http://localhost:3000
2. Clique no microfone
3. **Fale naturalmente!** — A IA entende qualquer comando

### 💬 Exemplos

| Você fala | A IA faz |
|-----------|----------|
| "Abre o navegador" | Abre o Edge |
| "Escreva hello world" | Digita o texto |
| "Nova aba" | Ctrl+T no navegador |
| "Oi tudo bem?" | Responde em PT-BR |

## 🔧 Arquitetura

- **Frontend**: Next.js + Web Speech API
- **Backend**: Flask + Groq AI + pyautogui
