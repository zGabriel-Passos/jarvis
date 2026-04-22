'use client';

import Link from 'next/link';

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
};

function CommandBadge({ text }: { text: string }) {
  return (
    <span className="bg-[#d4724a]/20 text-[#d4724a] px-3 py-1 rounded-full text-sm font-medium">
      &quot;{text}&quot;
    </span>
  );
}

export default function ComandosPage() {
  return (
    <div className="min-h-screen bg-[#1a1614] text-[#f0ebe4]">
      <header className="border-b border-white/5 sticky top-0 bg-[#1a1614]/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-linear-to-br from-[#d4724a] to-[#b85a35] rounded-full flex items-center justify-center">
              <span className="text-xl">Mic</span>
            </div>
            <span className="text-xl font-bold">Jarvis</span>
          </Link>
          <Link href="/" className="text-[#a09080] hover:text-[#d4724a] transition-colors">
            Voltar
          </Link>
        </div>
      </header>

      <section className="py-16 px-6 text-center border-b border-white/5">
        <h1 className="text-5xl md:text-6xl font-bold text-[#d4724a] mb-4">Comandos Disponiveis</h1>
        <p className="text-[#a09080] text-lg max-w-2xl mx-auto">
          Estes sao os exemplos principais para o modo desktop do Jarvis.
        </p>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-16 space-y-16">
        <section>
          <h2 className="text-3xl font-bold text-[#d4724a] mb-8">Conversa</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {commandGroups.conversa.map((item, index) => (
              <div key={index} className="bg-[#2a2520] border border-white/5 rounded-xl p-6 hover:border-[#d4724a]/30 transition-all">
                <div className="flex flex-wrap gap-2 mb-3">
                  {item.cmd.map((command, badgeIndex) => (
                    <CommandBadge key={badgeIndex} text={command} />
                  ))}
                </div>
                <p className="text-[#a09080]">{item.resposta}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-[#d4724a] mb-8">Aplicativos</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {commandGroups.aplicativos.map((item, index) => (
              <div key={index} className="bg-[#2a2520] border border-white/5 rounded-xl p-6 hover:border-[#d4724a]/30 transition-all">
                <div className="flex flex-wrap gap-2 mb-3">
                  {item.cmd.map((command, badgeIndex) => (
                    <CommandBadge key={badgeIndex} text={command} />
                  ))}
                </div>
                <p className="text-[#f0ebe4] mb-1">{item.acao}</p>
                <p className="text-[#a09080] text-sm">{item.atalho}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-[#d4724a] mb-8">Janelas</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {commandGroups.janelas.map((item, index) => (
              <div key={index} className="bg-[#2a2520] border border-white/5 rounded-xl p-6 hover:border-[#d4724a]/30 transition-all">
                <div className="flex flex-wrap gap-2 mb-3">
                  {item.cmd.map((command, badgeIndex) => (
                    <CommandBadge key={badgeIndex} text={command} />
                  ))}
                </div>
                <p className="text-[#f0ebe4] mb-1">{item.acao}</p>
                <p className="text-[#a09080] text-sm">{item.atalho}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-[#d4724a] mb-8">Navegador</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {commandGroups.navegador.map((item, index) => (
              <div key={index} className="bg-[#2a2520] border border-white/5 rounded-xl p-6 hover:border-[#d4724a]/30 transition-all">
                <div className="flex flex-wrap gap-2 mb-3">
                  {item.cmd.map((command, badgeIndex) => (
                    <CommandBadge key={badgeIndex} text={command} />
                  ))}
                </div>
                <p className="text-[#f0ebe4] mb-1">{item.acao}</p>
                <p className="text-[#a09080] text-sm">{item.atalho}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-[#d4724a] mb-8">Clipboard</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {commandGroups.clipboard.map((item, index) => (
              <div key={index} className="bg-[#2a2520] border border-white/5 rounded-xl p-6 hover:border-[#d4724a]/30 transition-all">
                <div className="flex flex-wrap gap-2 mb-3">
                  {item.cmd.map((command, badgeIndex) => (
                    <CommandBadge key={badgeIndex} text={command} />
                  ))}
                </div>
                <p className="text-[#f0ebe4] mb-1">{item.acao}</p>
                <p className="text-[#a09080] text-sm">{item.atalho}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-[#d4724a] mb-8">Arquivos</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {commandGroups.arquivos.map((item, index) => (
              <div key={index} className="bg-[#2a2520] border border-white/5 rounded-xl p-6 hover:border-[#d4724a]/30 transition-all">
                <div className="flex flex-wrap gap-2 mb-3">
                  {item.cmd.map((command, badgeIndex) => (
                    <CommandBadge key={badgeIndex} text={command} />
                  ))}
                </div>
                <p className="text-[#f0ebe4] mb-1">{item.acao}</p>
                <p className="text-[#a09080] text-sm">{item.atalho}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-bold text-[#d4724a] mb-8">Comandos dinamicos</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {commandGroups.dinamicos.map((item, index) => (
              <div key={index} className="bg-[#2a2520] border border-white/5 rounded-xl p-6 hover:border-[#d4724a]/30 transition-all">
                <div className="flex flex-wrap gap-2 mb-3">
                  {item.cmd.map((command, badgeIndex) => (
                    <CommandBadge key={badgeIndex} text={command} />
                  ))}
                </div>
                <p className="text-[#f0ebe4] mb-2">
                  Exemplo: <span className="text-[#d4724a]">&quot;{item.exemplo}&quot;</span>
                </p>
                <p className="text-[#a09080]">{item.resultado}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-linear-to-br from-[#2a2520] to-[#1a1614] border-2 border-[#d4724a]/30 rounded-3xl p-12">
          <h2 className="text-3xl font-bold text-[#d4724a] mb-8 text-center">Dicas de uso</h2>
          <div className="grid md:grid-cols-2 gap-8 text-[#a09080]">
            <div className="space-y-2">
              <p>Fale claramente e aguarde a resposta terminar.</p>
              <p>Use frases curtas para acertos melhores.</p>
              <p>Evite ruido de fundo durante a captura.</p>
            </div>
            <div className="space-y-2">
              <p>Comandos dinamicos funcionam melhor com texto objetivo.</p>
              <p>O backend precisa estar com as chaves configuradas.</p>
              <p>Algumas automacoes dependem do foco correto na janela do Windows.</p>
            </div>
          </div>
        </section>
      </div>

      <footer className="py-12 px-6 border-t border-white/5 text-center">
        <p className="text-[#a09080]">Jarvis desktop com Next.js, Electron e Python.</p>
      </footer>
    </div>
  );
}
