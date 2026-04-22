'use client'

import { useEffect, useRef, useState } from 'react'

const BACKEND_URL = 'http://127.0.0.1:5000'
const SILENCE_MS = 1200
const MIN_AUDIO_SIZE = 1024

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

  return (
    <div className="min-h-screen bg-[#1a1614]">
      <nav className="fixed top-0 w-full bg-[#1a1614]/80 backdrop-blur-xl border-b border-white/5 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-br from-[#d4724a] to-[#b85a35] rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <span className="text-[#f0ebe4] font-bold text-xl">Jarvis</span>
          </div>
          <button className="bg-[#d4724a] hover:bg-[#c26640] text-white px-6 py-2.5 rounded-full font-semibold transition-all hover:shadow-lg hover:shadow-[#d4724a]/30">
            App Desktop
          </button>
        </div>
      </nav>

      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#d4724a]/10 border border-[#d4724a]/20 rounded-full mb-8">
            <div className="w-2 h-2 bg-[#d4724a] rounded-full animate-pulse"></div>
            <span className="text-[#d4724a] text-sm font-medium">Electron + Next.js + Flask</span>
          </div>

          <h1 className="text-6xl md:text-7xl font-bold text-[#f0ebe4] mb-6 leading-[1.1] font-(family-name:--font-caveat)">
            Seu PC obedece
            <br />
            sua voz
          </h1>

          <p className="text-xl text-[#a09080] mb-12 max-w-2xl mx-auto leading-relaxed">
            Jarvis agora roda como aplicativo desktop. O Electron segura a interface, o Flask executa os comandos no Windows e a ElevenLabs continua cuidando da voz de resposta.
          </p>

          <div className="max-w-lg mx-auto mb-12">
            <div className="bg-[#2a2520] border border-white/5 rounded-3xl p-10 shadow-2xl">
              <button
                onClick={() => {
                  void toggleListening()
                }}
                disabled={!isSupported}
                className={`w-40 h-40 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${isListening
                  ? 'bg-linear-to-br from-red-500 to-red-600 animate-pulse shadow-2xl shadow-red-500/40 scale-105'
                  : 'bg-linear-to-br from-[#d4724a] to-[#b85a35] hover:scale-110 shadow-2xl shadow-[#d4724a]/40'
                  } ${!isSupported ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <svg className="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              <div className="mt-8 text-center">
                <p className="text-[#a09080] text-sm mb-2">Status</p>
                <p className="text-[#f0ebe4] font-semibold text-lg">{status}</p>
              </div>

              {(isThinking || isSpeaking) && (
                <div className="mt-4 flex justify-center gap-3 text-sm text-[#d4724a]">
                  {isThinking && <span>Pensando</span>}
                  {isSpeaking && <span>Respondendo</span>}
                </div>
              )}

              {transcript && (
                <div className="mt-6 p-4 bg-[#d4724a]/10 border border-[#d4724a]/20 rounded-2xl">
                  <p className="text-[#d4724a] text-sm mb-1 font-medium">Voce disse:</p>
                  <p className="text-[#f0ebe4]">{transcript}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-6 justify-center text-[#a09080] text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#d4724a]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Sem browser</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#d4724a]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Transcricao via Groq</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#d4724a]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Automacao local</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-[#2a2520]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-[#d4724a] text-center mb-20 font-(family-name:--font-caveat)">Como Funciona</h2>

          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-0.5 bg-linear-to-r from-transparent via-[#d4724a]/30 to-transparent"></div>

            {[
              { num: '1', title: 'Grave sua fala', desc: 'O Electron captura o audio localmente e encerra a frase quando detecta silencio.' },
              { num: '2', title: 'Jarvis interpreta', desc: 'O Flask envia a transcricao para a Groq, decide a acao e gera a resposta.' },
              { num: '3', title: 'Seu PC executa', desc: 'PyAutoGUI aplica o comando no Windows e a ElevenLabs devolve a resposta em voz.' },
            ].map((step, index) => (
              <div key={index} className="text-center relative">
                <div className="w-20 h-20 bg-linear-to-br from-[#d4724a] to-[#b85a35] rounded-full flex items-center justify-center text-3xl font-bold text-white mx-auto mb-6 shadow-lg shadow-[#d4724a]/30 relative z-10">
                  {step.num}
                </div>
                <h3 className="text-xl font-bold text-[#f0ebe4] mb-3">{step.title}</h3>
                <p className="text-[#a09080] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-[#d4724a] text-center mb-20 font-(family-name:--font-caveat)">Por Que Jarvis</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: 'Fluxo desktop real', desc: 'A interface agora sobe em Electron, sem depender de abrir um navegador para operar o assistente.' },
              { title: 'Captura desacoplada do browser', desc: 'A fala vira arquivo de audio local e segue para o Flask, removendo a dependencia de webkitSpeechRecognition.' },
              { title: 'Feedback por voz', desc: 'A ElevenLabs continua gerando audio natural para confirmar cada acao executada no computador.' },
              { title: 'Arquitetura simples', desc: 'Next.js cuida da UI, Electron empacota a janela desktop e Flask fica responsavel pela automacao e IA.' },
            ].map((feature, index) => (
              <div key={index} className="bg-[#2a2520] border border-white/5 rounded-2xl p-8 hover:border-[#d4724a]/30 transition-all">
                <h3 className="text-xl font-bold text-[#f0ebe4] mb-3">{feature.title}</h3>
                <p className="text-[#a09080] leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-[#2a2520]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-[#d4724a] text-center mb-20">Comandos Disponiveis</h2>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              { cmd: 'abra o whatsapp', icon: '💬' },
              { cmd: 'nova aba', icon: '🌐' },
              { cmd: 'copiar', icon: '📋' },
              { cmd: 'colar', icon: '📌' },
              { cmd: 'salvar', icon: '💾' },
              { cmd: 'minimizar', icon: '🔽' },
              { cmd: 'escreva [texto]', icon: '✍️' },
              { cmd: 'pressione [tecla]', icon: '⌨️' },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-4 bg-[#1a1614] border border-white/5 rounded-xl p-4 hover:border-[#d4724a]/30 transition-all">
                <span className="text-3xl">{item.icon}</span>
                <span className="text-[#f0ebe4] font-medium">{item.cmd}</span>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <a href="/comandos" className="text-[#d4724a] hover:text-[#c26640] font-semibold inline-flex items-center gap-2">
              Ver todos os comandos
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-linear-to-br from-[#2a2520] to-[#1a1614] border-2 border-[#d4724a]/30 rounded-3xl p-12 text-center shadow-2xl shadow-[#d4724a]/20">
            <h2 className="text-4xl md:text-5xl font-bold text-[#f0ebe4] mb-4">Pronto para comecar?</h2>
            <p className="text-[#a09080] text-lg mb-8 max-w-2xl mx-auto">
              Inicie o modo de escuta e fale naturalmente. O Jarvis vai gravar a frase, transcrever, decidir a acao e responder sem sair do app desktop.
            </p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="bg-[#d4724a] hover:bg-[#c26640] text-white px-10 py-4 rounded-full font-bold text-lg transition-all hover:shadow-xl hover:shadow-[#d4724a]/40 hover:-translate-y-1"
            >
              Ativar Jarvis
            </button>
          </div>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-linear-to-br from-[#d4724a] to-[#b85a35] rounded-lg"></div>
            <span className="text-[#f0ebe4] font-bold">Jarvis</span>
          </div>
          <p className="text-[#a09080] text-sm">© 2026 Jarvis. Assistente desktop por voz para Windows.</p>
        </div>
      </footer>
    </div>
  )
}
