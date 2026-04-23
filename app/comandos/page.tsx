'use client'

import Link from 'next/link'

const commandGroups = {
  conversa: [
    { cmd: ['oi', 'ola', 'hey'], resposta: 'Ola! Sou o Jarvis, seu assistente de voz.' },
    { cmd: ['como voce esta', 'tudo bem'], resposta: 'Estou pronto para executar seus comandos.' },
    { cmd: ['obrigado', 'valeu'], resposta: 'Por nada. Estou aqui para ajudar.' },
  ],
  aplicativos: [
    { cmd: ['abra o whatsapp', 'open whatsapp'], acao: 'Abre o WhatsApp', atalho: 'Win + whatsapp' },
    { cmd: ['abra o navegador', 'open browser'], acao: 'Abre o Edge', atalho: 'Win + edge' },
  ],
  janelas: [
    { cmd: ['feche a janela', 'close window'], acao: 'Fecha a janela ativa', atalho: 'Alt + F4' },
    { cmd: ['minimizar', 'minimize'], acao: 'Minimiza a janela', atalho: 'Win + Down' },
    { cmd: ['maximizar', 'maximize'], acao: 'Maximiza a janela', atalho: 'Win + Up' },
  ],
  navegador: [
    { cmd: ['nova aba', 'new tab'], acao: 'Abre uma nova aba', atalho: 'Ctrl + T' },
    { cmd: ['feche a aba', 'close tab'], acao: 'Fecha a aba atual', atalho: 'Ctrl + W' },
    { cmd: ['atualize a pagina', 'refresh'], acao: 'Recarrega a pagina', atalho: 'F5' },
  ],
  clipboard: [
    { cmd: ['copiar', 'copy'], acao: 'Copia a selecao', atalho: 'Ctrl + C' },
    { cmd: ['colar', 'paste'], acao: 'Cola o conteudo', atalho: 'Ctrl + V' },
  ],
  arquivos: [
    { cmd: ['salvar', 'save'], acao: 'Salva o arquivo', atalho: 'Ctrl + S' },
  ],
  dinamicos: [
    { cmd: ['escreva [texto]', 'write [text]'], exemplo: 'escreva ola mundo', resultado: 'Digita o texto informado' },
    { cmd: ['pressione [tecla]', 'press [key]'], exemplo: 'pressione enter', resultado: 'Pressiona a tecla informada' },
  ],
}

const sections = [
  { key: 'conversa', title: 'Conversa', description: 'Respostas simples para interacoes naturais.' },
  { key: 'aplicativos', title: 'Aplicativos', description: 'Abertura rapida de apps comuns.' },
  { key: 'janelas', title: 'Janelas', description: 'Controle de foco e estado da janela.' },
  { key: 'navegador', title: 'Navegador', description: 'Acoes comuns para abas e pagina.' },
  { key: 'clipboard', title: 'Clipboard', description: 'Fluxo rapido de copia e cola.' },
  { key: 'arquivos', title: 'Arquivos', description: 'Atalhos basicos para salvar.' },
  { key: 'dinamicos', title: 'Comandos dinamicos', description: 'Aceitam texto ou tecla como parametro.' },
] as const

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

function CommandBadge({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
      {text}
    </span>
  )
}

export default function ComandosPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(36,130,192,0.18),_transparent_28%),linear-gradient(180deg,_#07111b_0%,_#04090f_55%,_#02060a_100%)] text-slate-100">
      <div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8">
        <header className="sticky top-4 z-40 rounded-[30px] border border-cyan-400/15 bg-slate-950/80 px-4 py-4 shadow-[0_20px_60px_rgba(2,8,16,0.45)] backdrop-blur-xl sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-lg font-black tracking-[0.45em] text-cyan-200">
                J.A.R.V.I.S
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                <span className="h-2 w-2 rounded-full bg-cyan-300" />
                mapa de comandos
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/25 hover:text-cyan-100"
              >
                <Icon path="M15 19l-7-7 7-7" className="h-4 w-4" />
                Voltar para landing
              </Link>
            </div>
          </div>
        </header>

        <section className="px-1 pb-10 pt-10 sm:pt-14">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[34px] border border-cyan-400/15 bg-slate-950/75 p-6 shadow-[0_22px_55px_rgba(3,12,22,0.35)] backdrop-blur sm:p-8">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cyan-300/75">Biblioteca operacional</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-semibold text-slate-50 sm:text-5xl">
                Todos os comandos que o frontend atual consegue expor com clareza.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                Essa pagina funciona como apoio da landing principal: ela detalha as frases aceitas hoje e ajuda o usuario a testar o Jarvis mais rapido.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-5">
                  <p className="text-[0.68rem] uppercase tracking-[0.25em] text-slate-500">Categorias</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-100">{sections.length}</p>
                </div>
                <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-5">
                  <p className="text-[0.68rem] uppercase tracking-[0.25em] text-slate-500">Comandos-base</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-100">14+</p>
                </div>
                <div className="rounded-[24px] border border-slate-800 bg-slate-900/70 p-5">
                  <p className="text-[0.68rem] uppercase tracking-[0.25em] text-slate-500">Formato</p>
                  <p className="mt-2 text-lg font-semibold text-slate-100">Fala natural e atalhos</p>
                </div>
              </div>
            </div>

            <div className="rounded-[34px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(9,31,47,0.9),rgba(5,15,24,0.98))] p-6 shadow-[0_22px_55px_rgba(3,12,22,0.35)] sm:p-8">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cyan-300/75">Dicas de uso</p>
              <div className="mt-5 space-y-4">
                {[
                  'Fale com frases curtas e objetivas para melhorar a transcricao.',
                  'Espere a resposta terminar antes do proximo comando.',
                  'Comandos dinamicos funcionam melhor com parametros simples.',
                  'Automacoes dependem do foco correto da janela no Windows.',
                ].map((tip, index) => (
                  <div key={tip} className="flex gap-4 rounded-[24px] border border-cyan-400/10 bg-slate-950/45 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-sm font-bold text-cyan-100">
                      0{index + 1}
                    </div>
                    <p className="text-sm leading-7 text-slate-300">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 pb-16">
          {sections.map((section) => {
            const items = commandGroups[section.key]

            return (
              <div
                key={section.key}
                className="rounded-[32px] border border-cyan-400/15 bg-slate-950/72 p-6 shadow-[0_18px_50px_rgba(2,8,16,0.32)] backdrop-blur sm:p-8"
              >
                <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cyan-300/75">{section.title}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-400">{section.description}</p>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {items.length} item(ns)
                  </span>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((item, index) => (
                    <div key={`${section.key}-${index}`} className="rounded-[26px] border border-slate-800 bg-slate-900/72 p-5">
                      <div className="flex flex-wrap gap-2">
                        {item.cmd.map((command, badgeIndex) => (
                          <CommandBadge key={badgeIndex} text={command} />
                        ))}
                      </div>

                      {'resposta' in item ? (
                        <p className="mt-4 text-sm leading-7 text-slate-300">{item.resposta}</p>
                      ) : null}

                      {'acao' in item ? (
                        <>
                          <p className="mt-4 text-base font-semibold text-slate-100">{item.acao}</p>
                          <p className="mt-2 text-sm text-slate-400">{item.atalho}</p>
                        </>
                      ) : null}

                      {'exemplo' in item ? (
                        <>
                          <p className="mt-4 text-sm font-semibold text-slate-100">Exemplo</p>
                          <p className="mt-2 text-sm text-cyan-200">{item.exemplo}</p>
                          <p className="mt-3 text-sm leading-7 text-slate-400">{item.resultado}</p>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      </div>
    </div>
  )
}
