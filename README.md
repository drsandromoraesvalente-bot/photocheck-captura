# Photocheck · Avaliação Completa

Protótipo v0.1 do módulo de captura facial guiada (9 vistas) da Drawn Face Academy.
Abra pelo link do GitHub Pages no celular e permita a câmera.

## Confiabilidade da orientação por voz

A captura possui três recursos independentes:

- **Orientação visual:** permanece disponível quando o áudio falha.
- **Orientação guiada:** tenta `audio/<id>.mp3` e usa `speechSynthesis` do
  aparelho como alternativa. Esta voz não é a identidade vocal da Vick. Sua
  disponibilidade depende do navegador, das vozes instaladas e das políticas de
  reprodução; não há garantia de áudio ou funcionamento offline.
- **Conversa livre:** opcional, depende do agente ElevenLabs configurado via
  `?agente=ID_REAL`. Sem parâmetro, a opção fica oculta e não solicita microfone.
  O ID é público e não é uma credencial; nunca coloque uma chave de API na URL,
  no HTML ou no repositório.

### Recursos externos e implantação

1. Os **39 MP3 do `audio/ROTEIRO.txt` estão ausentes nesta revisão**. Obtenha as
   gravações autorizadas com o responsável pela voz e publique-as com os nomes
   exatos do roteiro, conteúdo MP3 válido e `Content-Type: audio/mpeg`. Não foi
   criada nem imitada a voz da Vick neste patch.
2. Execute `node scripts/check-audio.cjs` para listar arquivos ausentes/vazios.
   Use `node scripts/check-audio.cjs --strict` no deploy quando as gravações
   forem obrigatórias (retorna código 1 se houver ausências). O inventário não
   valida a identidade da voz nem a decodificação: verifique a reprodução real.
3. Para conversa livre, forneça um agente real autorizado, disponível para
   conexão pública por ID, e configure no ElevenLabs os domínios permitidos,
   idioma, voz, mensagem inicial, limites de uso e tratamento das mensagens
   `[ESTADO]`. Agentes privados exigem um backend para emitir URLs assinadas;
   esse fluxo não está implementado. Não há credenciais nem agente fictício
   configurados por este patch.
4. Publique em HTTPS, mantendo `lib/elevenlabs-client-1.27.0.js` e os demais
   recursos locais. O SDK incluído solicita o microfone somente na conversa;
   a câmera usa `audio:false`. Em iframe, o hospedeiro também precisa permitir
   câmera/microfone nas políticas e no atributo `allow`. A orientação guiada
   não depende de permissão de microfone.
5. Avalie o consentimento específico para enviar áudio da conversa ao
   ElevenLabs antes de disponibilizar esse modo a pacientes. O consentimento
   atual para imagens não descreve esse processamento externo.

### Comportamentos de recuperação

- Carregamento do MP3 limitado a 4 s; reprodução/síntese limitada a 20 s por
  frase. Em falha, segue com síntese ou instrução visual, sem travar a captura.
- Erros de mídia ausente/inválida (códigos 3/4) são registrados no console por
  ID e evitados durante a página atual. Não se confunde bloqueio de autoplay
  ou timeout de rede com arquivo comprovadamente ausente. Recarregar a página
  permite tentar novamente após publicar/corrigir os MP3.
- Fila única também para síntese, com callbacks antigos invalidados ao
  interromper, encerrar ou desligar a voz. Não baixa os 39 áudios de uma vez.
- Falha, desconexão, evento offline ou timeout de conexão (12 s) desativam o
  agente e repetem a instrução da vista atual no modo guiado. Não há reconexão
  automática nem novos pedidos de microfone em loop.
- Desligar a voz cancela falas, fila e bipes, e encerra a sessão do agente.
  Religar durante a captura retoma apenas a orientação guiada; uma nova captura
  com conversa habilitada permite tentar novamente o agente.
- Sessões que chegam após cancelamento são encerradas sem assumir a orientação.
  O SDK não expõe cancelamento da promessa `startSession`: um pedido de
  permissão pendente continua sob controle do navegador e recursos internos
  de uma inicialização pendente só são liberados pelo SDK quando ela se resolve
  ou falha. Validar esse intervalo em aparelhos reais antes da produção.
- Encerrar, sair da página ou falhar ao abrir câmera/modelo encerra a conversa.
  A despedida automática pode manter a conversa por até 9 s; desligar a voz ou
  iniciar nova captura cancela essa espera.

### Verificação

Execute `node --test tests/voice.test.cjs` (Node.js 18+). Os testes executam o
bloco real de voz de `index.html` com APIs de navegador/SDK simuladas, sem
câmera, áudio de pacientes, conexão externa ou dependências adicionais.
Cobrem MP3 ausente, autoplay bloqueado, timeout, fila de síntese, conexão
interrompida, microfone negado, conexão tardia, voz desligada e falhas de envio.

**Ainda não validado em dispositivos reais:** Safari/iOS e Chrome/Android.
Antes da publicação, testar em HTTPS: permitir/negar microfone, negar câmera,
voz desligada antes e durante a conexão, modo sem agente, rede desligada no
meio da conversa, MP3 ausente/lento, bloquear e desbloquear tela, encerrar e
refazer uma vista. Confirmar ausência de falas sobrepostas, retomada da vista
correta, disponibilidade dos controles e liberação do indicador de microfone.
Os testes simulados não comprovam comportamento de autoplay, qualidade da voz,
latência do agente ou liberação de hardware em um aparelho real.
