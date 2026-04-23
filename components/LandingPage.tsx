'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const BACKEND_URL = 'http://127.0.0.1:5000'
const SILENCE_MS = 1200
const MIN_AUDIO_SIZE = 1024

const featuredCommands = [
  'abra o whatsapp',
  'nova aba',
  'copiar',
  'colar',
  'salvar',
  'pressione enter',
]

const featureCards = [
  {
    title: 'Stack ativa',
    value: 'Next.js + Electron + Flask',
    detail: 'UI moderna, janela desktop e automacao local no mesmo fluxo.',
  },
  {
    title: 'Captura por voz',
    value: 'Deteccao de silencio',
    detail: 'A gravacao fecha a frase automaticamente antes de enviar.',
  },
  {
    title: 'Resposta falada',
    value: 'ElevenLabs + fallback',
    detail: 'Quando necessario, o sintetizador nativo assume a resposta.',
  },
]

const steps = [
  {
    title: 'Escuta local',
    text: 'O app abre o microfone, detecta voz e encerra a captura no momento certo.',
  },
  {
    title: 'Interpretacao',
    text: 'O backend transcreve, entende a intencao e escolhe a acao adequada.',
  },
  {
    title: 'Execucao',
    text: 'Jarvis responde em voz e dispara a automacao direto no seu Windows.',
  },
]

const benefits = [
  'Landing page e painel do assistente no mesmo frontend.',
  'Experiencia mobile-friendly sem perder a presenca de app desktop.',
  'Estados visuais claros para ouvindo, pensando e respondendo.',
  'CTA, prova tecnica e comandos rapidos integrados na mesma tela.',
]

function base64ToAudioBlob(base64: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: 'audio/mpeg' })
}

function getSupportedMimeType() {
  const mimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ]

  if (typeof MediaRecorder === 'undefined') {
    return ''
  }

  return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? ''
}

function Icon({
  path,
  className = 'h-5 w-5',
}: {
  path: string
  className?: string
}) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </svg>
  )
}

function StatusPill({
  label,
  tone = 'cyan',
}: {
  label: string
  tone?: 'cyan' | 'green' | 'amber'
}) {
  const tones = {
    cyan: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-200',
    green: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
    amber: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  }

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${tones[tone]}`}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  )
}

function InfoCard({
  title,
  value,
  detail,
}: {
  title: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-[28px] border border-cyan-400/15 bg-slate-950/70 p-5 shadow-[0_18px_45px_rgba(3,12,22,0.35)] backdrop-blur">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">{title}</p>
      <p className="mt-3 text-lg font-semibold text-slate-100">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  )
}

export default function LandingPage() {
  const [isListening, setIsListening] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('Pronto para ouvir')
  const [isSupported, setIsSupported] = useState(true)

  const assistantActiveRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const shouldProcessRecordingRef = useRef(false)
  const speechDetectedRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  const clearSilenceTimeout = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
  }

  const stopVolumeMonitor = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    clearSilenceTimeout()

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined)
      audioContextRef.current = null
    }

    analyserRef.current = null
  }

  const releaseMicrophone = () => {
    stopVolumeMonitor()

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    mediaRecorderRef.current = null
    recordedChunksRef.current = []
    speechDetectedRef.current = false
  }

  const stopPlayback = () => {
    window.speechSynthesis.cancel()

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }

    setIsSpeaking(false)
  }

  const startRecordingCycle = async () => {
    if (!assistantActiveRef.current || mediaRecorderRef.current || isThinking || isSpeaking) {
      return
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined' || typeof MediaRecorder === 'undefined') {
      setIsSupported(false)
      setStatus('Captura de audio nao suportada neste ambiente')
      assistantActiveRef.current = false
      setIsListening(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      streamRef.current = stream
      recordedChunksRef.current = []
      shouldProcessRecordingRef.current = true
      speechDetectedRef.current = false

      const mimeType = getSupportedMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        stopVolumeMonitor()
        const shouldProcess = shouldProcessRecordingRef.current
        const audioBlob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' })

        releaseMicrophone()

        if (!shouldProcess || audioBlob.size < MIN_AUDIO_SIZE) {
          if (assistantActiveRef.current && !isThinking && !isSpeaking) {
            setStatus('Ouvindo...')
            window.setTimeout(() => {
              void startRecordingCycle()
            }, 250)
          }
          return
        }

        await processAudioCommand(audioBlob)
      }

      recorder.start()
      setStatus('Ouvindo...')

      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      audioContextRef.current = audioContext
      analyserRef.current = analyser

      const samples = new Uint8Array(analyser.frequencyBinCount)

      const monitor = () => {
        const currentAnalyser = analyserRef.current
        if (!currentAnalyser || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
          return
        }

        currentAnalyser.getByteTimeDomainData(samples)

        let total = 0
        for (let i = 0; i < samples.length; i++) {
          const normalized = (samples[i] - 128) / 128
          total += normalized * normalized
        }

        const rms = Math.sqrt(total / samples.length)
        const isSpeech = rms > 0.025

        if (isSpeech) {
          speechDetectedRef.current = true
          clearSilenceTimeout()
          if (status !== 'Ouvindo...') {
            setStatus('Ouvindo...')
          }
        } else if (speechDetectedRef.current && !silenceTimeoutRef.current) {
          silenceTimeoutRef.current = setTimeout(() => {
            silenceTimeoutRef.current = null
            stopCurrentRecording(true)
          }, SILENCE_MS)
        }

        animationFrameRef.current = requestAnimationFrame(monitor)
      }

      animationFrameRef.current = requestAnimationFrame(monitor)
    } catch {
      assistantActiveRef.current = false
      setIsListening(false)
      setStatus('Nao foi possivel acessar o microfone')
    }
  }

  const speakFallback = (text: string) =>
    new Promise<void>((resolve) => {
      stopPlayback()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'pt-BR'
      utterance.rate = 1.05
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => {
        setIsSpeaking(false)
        resolve()
      }
      utterance.onerror = () => {
        setIsSpeaking(false)
        resolve()
      }

      window.speechSynthesis.speak(utterance)
    })

  const playAssistantSpeech = async (text: string, audioBase64: string | null) => {
    if (!audioBase64) {
      await speakFallback(text)
      return
    }

    stopPlayback()

    try {
      const audioBlob = base64ToAudioBlob(audioBase64)
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)

      audioRef.current = audio
      audioUrlRef.current = audioUrl

      await new Promise<void>((resolve) => {
        audio.onplay = () => setIsSpeaking(true)
        audio.onended = () => {
          setIsSpeaking(false)
          stopPlayback()
          resolve()
        }
        audio.onerror = () => {
          setIsSpeaking(false)
          stopPlayback()
          resolve()
        }

        audio.play().catch(() => {
          setIsSpeaking(false)
          stopPlayback()
          resolve()
        })
      })
    } catch {
      await speakFallback(text)
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    const formData = new FormData()
    formData.append('audio', audioBlob, 'jarvis-command.webm')

    const response = await fetch(`${BACKEND_URL}/transcribe`, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()
    if (!response.ok || data.status !== 'ok') {
      throw new Error(data.message ?? 'Falha ao transcrever audio')
    }

    return data.text as string
  }

  const executeCommand = async (text: string) => {
    const response = await fetch(`${BACKEND_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.speech ?? 'Falha ao executar comando')
    }

    return data
  }

  const processAudioCommand = async (audioBlob: Blob) => {
    try {
      setIsThinking(true)
      setStatus('Transcrevendo...')
      const spokenText = await transcribeAudio(audioBlob)
      setTranscript(spokenText)

      setStatus('Pensando...')
      const result = await executeCommand(spokenText)

      if (result.status === 'executed') {
        setStatus('Executado')
        await playAssistantSpeech(result.speech, result.audio ?? null)
      } else {
        setStatus('Erro ao processar')
        if (result.speech) {
          await playAssistantSpeech(result.speech, result.audio ?? null)
        }
      }
    } catch {
      setStatus('Erro ao processar audio')
    } finally {
      setIsThinking(false)
      if (assistantActiveRef.current) {
        setStatus('Ouvindo...')
        window.setTimeout(() => {
          void startRecordingCycle()
        }, 250)
      }
    }
  }

  const stopCurrentRecording = (shouldProcess: boolean) => {
    shouldProcessRecordingRef.current = shouldProcess

    const recorder = mediaRecorderRef.current
    if (!recorder) {
      if (!shouldProcess) {
        releaseMicrophone()
      }
      return
    }

    if (recorder.state !== 'inactive') {
      recorder.stop()
    }
  }

  const toggleListening = async () => {
    if (!isSupported) {
      setStatus('Captura de audio nao suportada neste ambiente')
      return
    }

    if (assistantActiveRef.current) {
      assistantActiveRef.current = false
      setIsListening(false)
      setIsThinking(false)
      stopCurrentRecording(false)
      releaseMicrophone()
      stopPlayback()
      setStatus('Parado')
      return
    }

    assistantActiveRef.current = true
    setIsListening(true)
    setStatus('Ouvindo...')
    await startRecordingCycle()
  }

  useEffect(() => {
    const canUseDesktopAudio =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices !== 'undefined' &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined'

    setIsSupported(canUseDesktopAudio)
    if (!canUseDesktopAudio) {
      setStatus('Captura de audio nao suportada neste ambiente')
    }

    return () => {
      assistantActiveRef.current = false
      stopCurrentRecording(false)
      releaseMicrophone()
      stopPlayback()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activityLabel = isSpeaking
    ? 'Respondendo'
    : isThinking
      ? 'Pensando'
      : isListening
        ? 'Escutando'
        : 'Em espera'

  const activityTone = isSpeaking ? 'green' : isThinking ? 'amber' : 'cyan'

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(36,130,192,0.18),_transparent_32%),linear-gradient(180deg,_#07111b_0%,_#04090f_46%,_#02060a_100%)] text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <header className="animate-fade-up mb-6 rounded-[30px] border border-cyan-400/15 bg-slate-950/80 px-4 py-4 shadow-[0_20px_60px_rgba(2,8,16,0.45)] backdrop-blur-xl sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-lg font-black tracking-[0.45em] text-cyan-200">
                J.A.R.V.I.S
              </div>
              <StatusPill label={isListening ? 'online' : 'standby'} tone={isListening ? 'green' : 'cyan'} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-cyan-400/15 bg-slate-900/70 px-4 py-3">
                <p className="text-[0.68rem] uppercase tracking-[0.28em] text-slate-500">Modo</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">Landing + painel do assistente</p>
              </div>
              <div className="rounded-2xl border border-cyan-400/15 bg-slate-900/70 px-4 py-3">
                <p className="text-[0.68rem] uppercase tracking-[0.28em] text-slate-500">Voz</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">pt-BR com fallback local</p>
              </div>
              <div className="rounded-2xl border border-cyan-400/15 bg-slate-900/70 px-4 py-3 sm:col-span-2 xl:col-span-1">
                <p className="text-[0.68rem] uppercase tracking-[0.28em] text-slate-500">Status</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{status}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="items-start gap-6 xl:grid xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <aside className="animate-fade-up space-y-5 [animation-delay:0.08s]">
            <div className="rounded-[32px] border border-cyan-400/15 bg-slate-950/75 p-5 shadow-[0_22px_55px_rgba(3,12,22,0.35)] backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cyan-300/75">Painel de recursos</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-100">Funcionalidades ativas</h2>
                </div>
                <Icon path="M4 12h16M12 4v16" className="h-5 w-5 text-cyan-300/70" />
              </div>
              <div className="mt-5 grid gap-4">
                {featureCards.map((card) => (
                  <InfoCard key={card.title} {...card} />
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-cyan-400/15 bg-slate-950/75 p-5 backdrop-blur">
              <div className="flex items-center gap-3">
                <Icon path="M8 12h8M12 8v8M5 5l14 14" className="h-5 w-5 text-cyan-300" />
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cyan-300/75">Comandos rapidos</p>
                  <p className="text-sm text-slate-400">Exemplos que ja funcionam no app.</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {featuredCommands.map((command) => (
                  <span
                    key={command}
                    className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100"
                  >
                    {command}
                  </span>
                ))}
              </div>
              <Link
                href="/comandos"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition hover:text-cyan-100"
              >
                Ver lista completa
                <Icon path="M5 12h14M13 5l7 7-7 7" className="h-4 w-4" />
              </Link>
            </div>
          </aside>

          <main className="animate-fade-up rounded-[36px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(4,12,20,0.86),rgba(2,8,14,0.96))] px-6 py-8 shadow-[0_28px_90px_rgba(2,8,16,0.5)] backdrop-blur [animation-delay:0.14s] sm:px-10">
            <div className="mx-auto max-w-4xl text-center">
              <StatusPill label="assistente de voz desktop" tone="cyan" />
              <h1 className="mt-6 text-4xl font-black tracking-[0.14em] text-slate-50 sm:text-5xl lg:text-6xl">
                J.A.R.V.I.S
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                Uma landing page com cara de sistema operacional: captura de voz, automacao local e feedback falado dentro de um frontend mais moderno, limpo e responsivo.
              </p>
            </div>

            <div className="relative mx-auto mt-10 flex min-h-[420px] max-w-4xl items-center justify-center overflow-hidden rounded-[40px] border border-cyan-400/10 bg-[radial-gradient(circle_at_center,_rgba(37,169,255,0.12),_transparent_38%),linear-gradient(180deg,_rgba(5,12,20,0.85),_rgba(3,8,14,0.95))] px-6 py-12">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(73,191,255,0.12),_transparent_20%)]" />
              <div className="pointer-events-none absolute inset-x-10 top-0 h-24 bg-[radial-gradient(circle_at_top,_rgba(120,210,255,0.16),_transparent_68%)] blur-2xl" />
              <div className={`pointer-events-none absolute h-[320px] w-[320px] rounded-full border transition-all duration-500 ${isListening ? 'animate-orbit-slow border-cyan-300/60 shadow-[0_0_90px_rgba(56,189,248,0.2)]' : 'border-cyan-400/20'}`} />
              <div className={`pointer-events-none absolute h-[250px] w-[250px] rounded-full border transition-all duration-500 ${isThinking ? 'animate-pulse-soft border-amber-300/55' : 'border-cyan-400/15'}`} />
              <div className={`pointer-events-none absolute h-[180px] w-[180px] rounded-full border transition-all duration-500 ${isSpeaking ? 'animate-pulse-soft border-emerald-300/60' : 'border-cyan-400/10'}`} />

              <div className="relative z-10 text-center animate-fade-up [animation-delay:0.22s]">
                <button
                  type="button"
                  onClick={() => {
                    void toggleListening()
                  }}
                  disabled={!isSupported}
                  className={`group relative flex h-48 w-48 items-center justify-center rounded-full border text-cyan-50 transition duration-300 sm:h-56 sm:w-56 ${
                    isListening
                      ? 'animate-float-core border-cyan-200/50 bg-cyan-400/15 shadow-[0_0_80px_rgba(56,189,248,0.24)]'
                      : 'border-cyan-400/25 bg-cyan-400/10 hover:scale-[1.03] hover:border-cyan-200/40 hover:bg-cyan-400/14'
                  } ${!isSupported ? 'cursor-not-allowed opacity-50' : ''}`}
                  aria-label={isListening ? 'Desativar escuta' : 'Ativar escuta'}
                >
                  <div className={`absolute inset-5 rounded-full border border-cyan-200/10 ${isListening ? 'animate-pulse-soft' : ''}`} />
                  <div className={`absolute inset-10 rounded-full border border-cyan-200/15 ${isListening ? 'animate-orbit-slow' : ''}`} />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-cyan-200/25 bg-slate-900/50">
                    <Icon
                      path="M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3Zm6 8a6 6 0 0 1-12 0M12 18v2m-4 0h8"
                      className="h-11 w-11"
                    />
                  </div>
                </button>

                <h2 className="mt-10 text-3xl font-black tracking-[0.18em] text-slate-100 sm:text-4xl">
                  J.A.R.V.I.S
                </h2>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <StatusPill label={activityLabel} tone={activityTone} />
                  {transcript ? <StatusPill label="ultima fala capturada" tone="cyan" /> : null}
                </div>
                <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-slate-400 sm:text-base">
                  Toque no nucleo para iniciar a escuta continua. O backend transcreve, executa e devolve a resposta em voz.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      void toggleListening()
                    }}
                    disabled={!isSupported}
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon path="M12 5v14M5 12h14" className="h-4 w-4" />
                    {isListening ? 'Parar assistente' : 'Ativar assistente'}
                  </button>
                  <Link
                    href="/comandos"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100"
                  >
                    <Icon path="M4 7h16M4 12h16M4 17h16" className="h-4 w-4" />
                    Ver comandos
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-[28px] border border-cyan-400/15 bg-slate-950/75 p-5 transition-transform duration-300 hover:-translate-y-1">
                <p className="text-[0.68rem] uppercase tracking-[0.25em] text-slate-500">Compatibilidade</p>
                <p className="mt-2 text-base font-semibold text-slate-100">Windows desktop</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">Pensado para uso real com automacao local e janela empacotada via Electron.</p>
              </div>
              <div className="rounded-[28px] border border-cyan-400/15 bg-slate-950/75 p-5 transition-transform duration-300 hover:-translate-y-1">
                <p className="text-[0.68rem] uppercase tracking-[0.25em] text-slate-500">Entrada</p>
                <p className="mt-2 text-base font-semibold text-slate-100">Microfone com deteccao de pausa</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">Nada de manter botao pressionado para cada frase.</p>
              </div>
              <div className="rounded-[28px] border border-cyan-400/15 bg-slate-950/75 p-5 transition-transform duration-300 hover:-translate-y-1">
                <p className="text-[0.68rem] uppercase tracking-[0.25em] text-slate-500">Saida</p>
                <p className="mt-2 text-base font-semibold text-slate-100">Voz de retorno e status na interface</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">O usuario ve o fluxo e escuta a confirmacao no mesmo painel.</p>
              </div>
            </div>
          </main>

          <aside className="animate-fade-up space-y-5 [animation-delay:0.18s]">
            <div className="rounded-[32px] border border-cyan-400/15 bg-slate-950/75 p-5 shadow-[0_22px_55px_rgba(3,12,22,0.35)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cyan-300/75">Conversa</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-100">Centro de resposta</h2>
                </div>
                <StatusPill label={activityLabel} tone={activityTone} />
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-[26px] border border-cyan-400/15 bg-cyan-400/10 p-5">
                  <p className="text-sm leading-8 text-cyan-50">
                    Ola, sou o JARVIS. O frontend foi redesenhado para funcionar como landing page e painel operacional no mesmo lugar.
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-cyan-200/65">Mensagem inicial</p>
                </div>

                <div className="rounded-[26px] border border-slate-800 bg-slate-900/80 p-5">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Status atual</p>
                  <p className="mt-3 text-lg font-semibold text-slate-100">{status}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {isSupported
                      ? 'Microfone e gravacao disponiveis neste ambiente.'
                      : 'Este ambiente nao suporta captura de audio com MediaRecorder.'}
                  </p>
                </div>

                <div className="rounded-[26px] border border-slate-800 bg-slate-900/80 p-5">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Ultima transcricao</p>
                  <p className="mt-3 min-h-24 text-sm leading-7 text-slate-300">
                    {transcript || 'Quando voce falar, a frase capturada aparecera aqui.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-cyan-400/15 bg-slate-950/75 p-5 backdrop-blur">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cyan-300/75">Pipeline</p>
              <div className="mt-5 space-y-4">
                {steps.map((step, index) => (
                  <div key={step.title} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-sm font-bold text-cyan-100">
                      0{index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-100">{step.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-8 items-stretch gap-6 lg:grid lg:grid-cols-[1.2fr_0.8fr]">
          <div className="animate-fade-up rounded-[34px] border border-cyan-400/15 bg-slate-950/70 p-6 shadow-[0_18px_55px_rgba(2,8,16,0.38)] backdrop-blur [animation-delay:0.26s] sm:p-8">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cyan-300/75">Por que esse layout funciona</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-100 sm:text-4xl">Uma landing que ja parece o produto.</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {benefits.map((item) => (
                <div key={item} className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-5 transition-transform duration-300 hover:-translate-y-1">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-300" />
                    <p className="text-sm leading-7 text-slate-300">{item}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-fade-up flex h-full flex-col justify-between rounded-[34px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(10,34,51,0.92),rgba(5,15,24,0.98))] p-6 shadow-[0_18px_55px_rgba(2,8,16,0.38)] [animation-delay:0.32s] sm:p-8">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cyan-300/75">CTA</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-50">Pronto para testar no desktop?</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Ative o assistente, fale um comando curto e acompanhe todo o fluxo direto nessa interface.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  void toggleListening()
                }}
                disabled={!isSupported}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon path="M12 5v14M5 12h14" className="h-4 w-4" />
                {isListening ? 'Continuar ouvindo' : 'Ligar Jarvis agora'}
              </button>
              <Link
                href="/comandos"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/20 px-6 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/10"
              >
                <Icon path="M4 7h16M4 12h16M4 17h16" className="h-4 w-4" />
                Abrir mapa de comandos
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
