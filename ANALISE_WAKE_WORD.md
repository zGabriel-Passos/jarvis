# Análise e Plano de Implementação: Wake Word "Jarvis" com Gerenciamento de Sessão Inteligente

## 📋 Resumo do Problema
O usuário possui um assistente de voz Jarvis (Next.js + Electron + Flask) que atualmente:
- Ativa/desativa o microfone via botão manual (`toggleListening()`)
- Processa continuamente todo áudio capturado enquanto ativo
- Não possui detecção de palavra-chave (wake word)
- Risco significativo de consumo desnecessário de tokens quando deixado ativo acidentalmente

**Cenário específico de preocupação:**
1. Usuário diz: "Jarvis, que horas são?"
2. Jarvis responde
3. Usuário pergunta: "e o dia?"
4. Jarvis responde
5. Usuário passa 8 minutos conversando com amigos em casa
6. **Problema**: Se o assistente ficar ativo por 10 minutos após a última interação, ele continuará:
   - Transcrevendo toda a conversa com amigos
   - Enviando áudio para o backend Flask
   - Tentando interpretar como comandos
   - Gastando tokens da API (OpenAI/ElevenLabs/etc) desnecessariamente
   - Possivelmente executando ações indesejadas

## ❌ Por Que um Timeout Simples de 10 Minutos Não Resolve
Implementar apenas um `setTimeout(() => stopListening(), 10 * 60 * 1000)` após a ativação criaria exatamente o problema que queremos evitar:

| Estado | Duração | O Que Acontece | Consumo de Tokens |
|--------|---------|----------------|-------------------|
| Após último comando | 0-10 min | Processa **TODO** o áudio capturado | **Alto** (transcrição + interpretação contínua) |
| Após 10 min | - | Desliga automaticamente | Zero (mas já foi tarde demais) |

**Resultado**: Durante os 8 minutos de conversa com amigos, tokens seriam gastos desnecessariamente.

## ✅ Solução Proposta: Modelo de Três Estados com Detecção de Wake Word
Assistentes de voz comerciais (Alexa, Google Assistant, Siri) usam esse modelo para equilibrar usabilidade e eficiência:

### Estados do Sistema
| Estado | O Que Faz | Quando Transiciona | Duração Típica | Consumo de Recursos |
|--------|-----------|-------------------|----------------|---------------------|
| **1. ESPERANDO_PALAVRA_CHAVE** | Apenas detecta "Jarvis" (processamento mínimo de áudio) | → Detecta "Jarvis" na transcrição | Indefinido (até ativação) | **Muito Baixo** (chunks curtos, apenas verificação de string) |
| **2. SESSÃO_CONVERSAÇÃO_ATIVA** | Processa comandos normalmente (responde a follow-ups sem wake word) | → Após comando processado + silêncio curto | 10-20s de inatividade | **Baixo-Médio** (transcrição completa, mas apenas durante janela curta) |
| **3. INATIVO** | Totalmente desativado (requer ação manual para reativar) | → Botão de parar manual ou timeout extremo | Até ativar novamente | **Zero** (microfone fechado) |

### Workflow Detalhado do Seu Caso de Uso
```
[ESPERANDO_PALAVRA_CHAVE] 
    ↓ (Sistema ouvindo levemente apenas por "Jarvis" - nada é enviado para transcrição completa)
    ↓ (Detecta "Jarvis" em áudio ambiente)
[SESSÃO_CONVERSAÇÃO_ATIVA] 
    ↓ (Processa "que horas são?" → responde ao usuário)
    ↓ (Processa "e o dia?" → responde + **reseta timer de inatividade**)
    ↓ (15 segundos de silêncio após última fala)
[ESPERANDO_PALAVRA_CHAVE] 
    ↓ (Sistema retorna ao modo de detecção leve)
    ↓ (Durante 8 minutos de conversa com amigos:)
    │   ├── Apenas verifica ocasionalmente se áudio contém "jarvis"
    │   ├── NÃO envia áudio para transcrição completa
    │   ├── NÃO envia para backend Flask
    │   ├── NÃO gastam tokens da API
    │   └── Consumo de recursos: mínimo (similar a ficar em espera)
    ↓ (Usuário diz "Jarvis, que horas são?" novamente)
[SESSÃO_CONVERSAÇÃO_ATIVA] 
    ↓ (Processa normalmente)
```

### Fluxo de Transições
```
ESPERANDO_PALAVRA_CHAVE 
    ⟶ (detecta "Jarvis") 
SESSÃO_CONVERSAÇÃO_ATIVA 
    ⟶ (INACTIVITY_TIMEOUT_MS sem fala) 
ESPERANDO_PALAVRA_CHAVE 
    ⟶ (botão parar manual) 
INATIVO 
    ⟶ (botão iniciar manual) 
ESPERANDO_PALAVRA_CHAVE
```

## 🔧 Implementação Técnica em `components/LandingPage.tsx`

### 1. Novos Estados e Variáveis
```typescript
type AssistantState = 
  | 'WAITING_FOR_WAKE_WORD'  // Ouvindo apenas por "Jarvis" (modo baixa potência)
  | 'ACTIVE_SESSION'         // Processando comandos (janela de follow-up)
  | 'INACTIVE';              // Totalmente desativado

const [state, setState] = useState<AssistantState>('WAITING_FOR_WAKE_WORD');
const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
const INACTIVITY_TIMEOUT_MS = 15000; // 15 segundos para voltar à espera
const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
```

### 2. Lógica do Timer de Inatividade
```typescript
const resetInactivityTimer = () => {
  if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
  inactivityTimerRef.current = setTimeout(() => {
    if (state === 'ACTIVE_SESSION') {
      setState('WAITING_FOR_WAKE_WORD');
      // IMPORTANTE: Manter microfone aberto, mas mudar para modo de detecção leve
      void startWakeWordDetectionCycle(); // Novo ciclo otimizado para wake word
    }
  }, INACTIVITY_TIMEOUT_MS);
};

const clearInactivityTimer = () => {
  if (inactivityTimerRef.current) {
    clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = null;
  }
};
```

### 3. Modo de Detecção Leve (para estado `WAITING_FOR_WAKE_WORD`)
Modificar o ciclo de gravação existente para:
- **Quando state === 'WAITING_FOR_WAKE_WORD':**
  - Usar chunks de áudio MUITO curtos (500ms-1s)
  - Transcrever apenas esses chunks curtos
  - Verificar se a transcrição contém "jarvis" (case insensitive, com tolerância)
  - **NÃO** enviar para processamento de comando ou síntese de resposta
  - Apenas atualizar estado interno quando detectado
- **Ao detectar "Jarvis":**
  ```typescript
  setState('ACTIVE_SESSION');
  setSessionStartTime(Date.now());
  resetInactivityTimer(); // Inicia timer de follow-up
  // Ativar modo de assistente completo (igual ao toggleListening atual)
  void startFullListeningCycle();
  ```

### 4. Durante `SESSÃO_CONVERSAÇÃO_ATIVA`
- Após cada comando processado com sucesso:
  ```typescript
  setSessionStartTime(Date.now()); // Resetar timer de inatividade
  resetInactivityTimer(); // Reiniciar contagem de 15s
  ```
- Manter todo o fluxo atual de transcrição → execução → resposta

### 5. Encerramento da Sessão (retorno a `WAITING_FOR_WAKE_WORD`)
- Quando o timer de inatividade expira:
  ```typescript
  setState('WAITING_FOR_WAKE_WORD');
  setSessionStartTime(null);
  clearInactivityTimer();
  stopFullListeningCycle(); // Para o processamento completo
  void startWakeWordDetectionCycle(); // Inicia modo leve de detecção
  ```

### 6. Feedback Visual Distinto por Estado
Adicionar indicadores visuais claros:
- **ESPERANDO_PALAVRA_CHAVE**: Ícone suave, pulsação lenta, cor neutra (ex: cinza)
- **SESSÃO_CONVERSAÇÃO_ATIVA**: Ícone vibrante, pulsação normal, cor acento (ex: azul)
- **INATIVO**: Estado atual do botão de parar (vermelho/opaco)

### 7. Integração com Código Existente
Preservar totalmente:
- Toda a lógica de transcrição (`transcribeAudio`)
- Toda a lógica de execução de comandos (`executeCommand`)
- Toda a lógica de síntese de voz (`playAssistantSpeech` e `speakFallback`)
- Controle de microfone e detecção de silêncio existente
- Estados `isListening`, `isThinking`, `isSpeaking` (refatorados para funcionar dentro dos novos estados)

## ✅ Benefícios dessa Abordagem

| Benefício | Descrição |
|-----------|-----------|
| **🔒 Privacidade** | Microfone só processa áudio completo após detecção confirmada de "Jarvis" |
| **💰 Eficiência de Tokens** | Zero gasto durante conversas alheias; apenas durante janelas curtas de follow-up |
| **🛡️ Segurança** | Eliminada risco de execução acidental de comandos de conversas ambientais |
| **🗣️ Naturalidade** | Permite conversação fluida ("Jarvis, X?" → "Y?" → "Z?") sem repetir wake word |
| **⚡ Performance** | Modo de espera consome mínimo de CPU/bateria |
| **🔄 Compatibilidade** | Mantém 100% da funcionalidade atual de comandos e resposta de voz |

## 📝 Próximos Passos para Implementação

Quando retomarmos o trabalho, devemos:

1. **Backup atual**: Criar branch `feature/wake-word-implementation`
2. **Modificar LandingPage.tsx**:
   - Adicionar os tipos e estados novos
   - Implementar os timers de inatividade
   - Refatorar `startRecordingCycle()` para ter dois modos:
     * `startWakeWordDetectionCycle()` (chunks curtos, apenas verificação de "Jarvis")
     * `startFullListeningCycle()` (fluxo atual completo)
   - Adicionar lógica de transição entre estados
   - Atualizar feedback visual baseado no estado
3. **Testar cenários**:
   - Ativação por "Jarvis" seguida de follow-up rápido
   - Timeout de inatividade retornando ao modo wake word
   - Conversas ambientais não ativando o assistente
   - Botão manual de parar/iniciar funcionando corretamente
4. **Documentar uso**: Atualizar README com novas instruções de ativação

## 📌 Observações Importantes

- **O "10 minutos" mencionado inicialmente foi um mal-entendido**: O que precisamos na verdade é de um **timeout curto de inatividade (15s)** para encerrar a sessão ativa, **não** de um timeout longo que deixa o assistente ouvindo tudo.
- **A detecção de wake word deve ser feita client-side** inicialmente (verificando transcrições curtas) para máxima privacidade e latência zero.
- **O backend Flask permanece inalterado** - toda a lógica de transcrição e execução de comandos continua exatamente como está.
- **Este design é extensível**: Futuramente podemos adicionar wake words personalizadas ou múltiplas palavras de ativação.

---
*Análise gerada em 2026-04-30 como referência para desenvolvimento contínuo do projeto Jarvis. Este documento preserva todo o contexto das discussões para evitar retrabalho e consumo desnecessário de tokens em sessões futuras.*