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
    detail: 'UI desktop e automacao local no mesmo fluxo.',
  },
  {
    title: 'Captura por voz',
    value: 'Deteccao de silencio',
    detail: 'A gravacao fecha a frase automaticamente.',
  },
  {
    title: 'Resposta falada',
    value: 'ElevenLabs + fallback',
    detail: 'Fallback nativo quando necessario.',
  },
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
    cyan: {
      borderColor: 'color-mix(in srgb, var(--accent) 24%, transparent)',
      background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
      color: 'var(--accent)',
    },
    green: {
      borderColor: 'color-mix(in srgb, var(--success) 24%, transparent)',
      background: 'color-mix(in srgb, var(--success) 12%, transparent)',
      color: 'var(--success)',
    },
    amber: {
      borderColor: 'color-mix(in srgb, var(--warning) 24%, transparent)',
      background: 'color-mix(in srgb, var(--warning) 12%, transparent)',
      color: 'var(--warning)',
    },
  }

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
      style={tones[tone]}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {label}
    </span>
  )
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: 'dark' | 'light'
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-11 items-center gap-3 rounded-full border px-4 text-sm font-semibold"
      style={{
        borderColor: 'var(--line)',
        background: 'var(--panel)',
        color: 'var(--foreground)',
      }}
      aria-label={`Alternar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        <Icon
          path={
            theme === 'dark'
              ? 'M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0-1.414 1.414M7.05 16.95l-1.414 1.414M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'
              : 'M21 12.79A9 9 0 1 1 11.21 3c-.04.26-.06.52-.06.79a9 9 0 0 0 9.85 8.99Z'
          }
          className="h-4 w-4"
        />
      </span>
      {theme === 'dark' ? 'Dark' : 'Light'}
    </button>
  )
}

function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-[28px] border ${className}`}
      style={{
        borderColor: 'var(--line)',
        background: 'var(--panel)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {children}
    </section>
  )
}

export default function LandingPage() {
  const [isListening, setIsListening] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('Pronto para ouvir')
  const [isSupported, setIsSupported] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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
    const storedTheme = window.localStorage.getItem('jarvis-theme')
    const initialTheme =
      storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'

    document.documentElement.dataset.theme = initialTheme
    setTheme(initialTheme)

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

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    document.documentElement.dataset.theme = nextTheme
    window.localStorage.setItem('jarvis-theme', nextTheme)
  }

  const activityLabel = isSpeaking
    ? 'Respondendo'
    : isThinking
      ? 'Pensando'
      : isListening
        ? 'Escutando'
        : 'Em espera'

  const activityTone = isSpeaking ? 'green' : isThinking ? 'amber' : 'cyan'

  return (
    <div
      className="min-h-screen"
      style={{
        background: `
          radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 14%),
          linear-gradient(180deg, color-mix(in srgb, var(--background) 86%, black 14%) 0%, var(--background) 100%)
        `,
      }}
    >
      <div className="mx-auto max-w-[1540px] px-4 py-4 sm:px-6 lg:px-8">
        <div
          className="overflow-hidden rounded-[32px] border"
          style={{
            borderColor: 'var(--line)',
            background: 'color-mix(in srgb, var(--panel-strong) 94%, transparent)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <header
            className="flex items-center justify-between gap-4 border-b px-4 py-4 sm:px-6"
            style={{ borderColor: 'var(--line)' }}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMenuOpen((value) => !value)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border xl:hidden"
                style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                aria-label={isMenuOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
                aria-expanded={isMenuOpen}
                aria-controls="jarvis-sidebar"
              >
                <Icon
                  path={isMenuOpen ? 'M6 18 18 6M6 6l12 12' : 'M4 7h16M4 12h16M4 17h16'}
                  className="h-5 w-5"
                />
              </button>

              <div
                className="rounded-2xl border px-4 py-3 text-sm font-bold uppercase tracking-[0.36em]"
                style={{
                  borderColor: 'var(--line-strong)',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-space-mono), monospace',
                }}
              >
                Jarvis
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatusPill label={isListening ? 'online' : 'idle'} tone={isListening ? 'green' : 'cyan'} />
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </header>

          <div className="grid gap-4 p-4 xl:grid-cols-[250px_minmax(0,1fr)_320px] xl:p-6">
            <aside
              id="jarvis-sidebar"
              className={`${isMenuOpen ? 'grid' : 'hidden'} gap-4 xl:grid`}
            >
              <Panel className="p-5">
                <p
                  className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]"
                  style={{ color: 'var(--accent)' }}
                >
                  Features
                </p>
                <div className="mt-4 grid gap-3">
                  {featureCards.map((card) => (
                    <div
                      key={card.title}
                      className="rounded-[22px] border p-4"
                      style={{ borderColor: 'var(--line)', background: 'var(--panel-elevated)' }}
                    >
                      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
                        {card.title}
                      </p>
                      <p className="mt-2 text-sm font-semibold">{card.value}</p>
                      <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                        {card.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="p-5">
                <p
                  className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]"
                  style={{ color: 'var(--accent)' }}
                >
                  Comandos
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {featuredCommands.map((command) => (
                    <span
                      key={command}
                      className="rounded-full border px-3 py-2 text-sm"
                      style={{
                        borderColor: 'var(--line)',
                        background: 'var(--panel-elevated)',
                      }}
                    >
                      {command}
                    </span>
                  ))}
                </div>
                <Link
                  href="/comandos"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
                  style={{ color: 'var(--accent)' }}
                >
                  Ver comandos
                  <Icon path="M5 12h14M13 5l7 7-7 7" className="h-4 w-4" />
                </Link>
              </Panel>
            </aside>

            <main className="min-w-0">
              <Panel className="relative min-h-[680px] overflow-hidden px-5 py-6 sm:px-8">
                <div
                  className="pointer-events-none absolute inset-0 opacity-35"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)',
                    backgroundSize: '42px 42px',
                  }}
                />

                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p
                        className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]"
                        style={{ color: 'var(--accent)' }}
                      >
                        Voice core
                      </p>
                      <h1
                        className="mt-2 text-3xl font-bold uppercase sm:text-4xl"
                        style={{ fontFamily: 'var(--font-space-mono), monospace', letterSpacing: '0.16em' }}
                      >
                        J.A.R.V.I.S
                      </h1>
                    </div>
                    <StatusPill label={activityLabel} tone={activityTone} />
                  </div>

                  <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <div className="relative flex h-[320px] w-[320px] items-center justify-center sm:h-[400px] sm:w-[400px]">
                      {isListening ? (
                        <>
                          <div
                            className="absolute h-[88%] w-[88%] rounded-full border animate-pulse-ring"
                            style={{ borderColor: 'color-mix(in srgb, var(--accent) 26%, transparent)' }}
                          />
                          <div
                            className="absolute h-[70%] w-[70%] rounded-full border animate-pulse-ring [animation-delay:0.6s]"
                            style={{ borderColor: 'color-mix(in srgb, var(--accent) 18%, transparent)' }}
                          />
                        </>
                      ) : null}

                      <div
                        className={`absolute h-[92%] w-[92%] rounded-full border ${isListening ? 'animate-orbit-slow' : ''}`}
                        style={{ borderColor: 'color-mix(in srgb, var(--accent) 16%, transparent)' }}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          void toggleListening()
                        }}
                        disabled={!isSupported}
                        className={`relative flex h-52 w-52 items-center justify-center rounded-full border sm:h-60 sm:w-60 ${
                          isListening ? 'animate-float-core' : 'hover:scale-[1.02]'
                        } ${!isSupported ? 'cursor-not-allowed opacity-55' : ''}`}
                        style={{
                          borderColor: 'color-mix(in srgb, var(--accent) 24%, transparent)',
                          background: `
                            radial-gradient(circle at center, color-mix(in srgb, var(--accent) 24%, transparent), transparent 54%),
                            linear-gradient(180deg, color-mix(in srgb, var(--panel-elevated) 80%, transparent), var(--panel-strong))
                          `,
                          boxShadow: isListening
                            ? '0 0 72px color-mix(in srgb, var(--accent) 18%, transparent)'
                            : 'var(--shadow-sm)',
                          color: 'var(--foreground)',
                        }}
                        aria-label={isListening ? 'Desativar escuta' : 'Ativar escuta'}
                      >
                        <div
                          className={`absolute inset-8 rounded-full border ${isSpeaking ? 'animate-pulse-soft' : ''}`}
                          style={{
                            borderColor: isSpeaking
                              ? 'color-mix(in srgb, var(--success) 28%, transparent)'
                              : 'color-mix(in srgb, var(--accent) 12%, transparent)',
                          }}
                        />
                        <div
                          className="relative flex h-24 w-24 items-center justify-center rounded-full border sm:h-28 sm:w-28"
                          style={{
                            borderColor: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                            background: 'color-mix(in srgb, var(--panel-strong) 88%, transparent)',
                          }}
                        >
                          <Icon
                            path="M12 4a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3Zm6 8a6 6 0 0 1-12 0M12 18v2m-4 0h8"
                            className="h-11 w-11"
                          />
                        </div>
                      </button>
                    </div>

                    <p
                      className="mt-2 text-sm uppercase tracking-[0.28em]"
                      style={{ color: 'var(--muted)', fontFamily: 'var(--font-space-mono), monospace' }}
                    >
                      voice control node
                    </p>
                    <p className="mt-4 max-w-xl text-sm leading-7 sm:text-base" style={{ color: 'var(--muted)' }}>
                      Toque no nucleo para iniciar a escuta continua e acompanhe a resposta do Jarvis em tempo real.
                    </p>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          void toggleListening()
                        }}
                        disabled={!isSupported}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
                        style={{
                          background: 'var(--accent)',
                          color: '#021217',
                          boxShadow: '0 12px 32px color-mix(in srgb, var(--accent) 24%, transparent)',
                        }}
                      >
                        <Icon path="M12 5v14M5 12h14" className="h-4 w-4" />
                        {isListening ? 'Parar assistente' : 'Ativar assistente'}
                      </button>
                      <Link
                        href="/comandos"
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold"
                        style={{ borderColor: 'var(--line)', background: 'var(--panel-elevated)' }}
                      >
                        <Icon path="M4 7h16M4 12h16M4 17h16" className="h-4 w-4" />
                        Comandos
                      </Link>
                    </div>
                  </div>
                </div>
              </Panel>
            </main>

            <aside className="grid gap-4">
              <Panel className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p
                      className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]"
                      style={{ color: 'var(--accent)' }}
                    >
                      Status
                    </p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                      Estado atual do assistente.
                    </p>
                  </div>
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{
                      background: isListening ? 'var(--success)' : 'var(--danger)',
                      boxShadow: isListening ? '0 0 18px var(--success)' : '0 0 18px var(--danger)',
                    }}
                  />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Mic', value: isSupported ? 'Ready' : 'Blocked' },
                    { label: 'Mode', value: isListening ? 'Listening' : 'Standby' },
                    { label: 'Parser', value: isThinking ? 'Running' : 'Idle' },
                    { label: 'Speech', value: isSpeaking ? 'Output' : 'Mute' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[20px] border p-4"
                      style={{ borderColor: 'var(--line)', background: 'var(--panel-elevated)' }}
                    >
                      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
                        {item.label}
                      </p>
                      <p
                        className="mt-2 text-sm font-semibold uppercase"
                        style={{ fontFamily: 'var(--font-space-mono), monospace' }}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="p-5">
                <p
                  className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]"
                  style={{ color: 'var(--accent)' }}
                >
                  Console
                </p>
                <div
                  className="mt-4 rounded-[22px] border p-4"
                  style={{ borderColor: 'var(--line)', background: 'var(--panel-elevated)' }}
                >
                  <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
                    Status atual
                  </p>
                  <p className="mt-3 text-lg font-semibold">{status}</p>
                </div>
                <div
                  className="mt-3 rounded-[22px] border p-4"
                  style={{ borderColor: 'var(--line)', background: 'var(--panel-elevated)' }}
                >
                  <p className="text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
                    Ultima transcricao
                  </p>
                  <p className="mt-3 min-h-24 text-sm leading-7">
                    {transcript || 'Quando voce falar, a frase capturada aparecera aqui.'}
                  </p>
                </div>
              </Panel>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
