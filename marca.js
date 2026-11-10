/* =====================================================================
   Kaptora Face Scan — identidade da marca (white label)
   A marca vem de ./marcas/<id>.json (link com ?marca=<id>) e fica guardada
   neste aparelho. ?marca=padrao volta para a marca Kaptora.
   ===================================================================== */
(function(){
  const PADRAO = {
    id: 'kaptora',
    produto: 'Kaptora Face Scan',
    subtitulo: 'Avaliação Facial Completa',
    clinica: 'Drawn Face Academy',
    selo: 'K',
    logo: '',                                   // imagem (data URL ou endereço); vazio = usa o selo
    cores: { primaria: '#162d25', acento: '#ceb78e' },
    assistente: {
      nome: 'Kaptora',
      saudacao: 'Olá, eu sou a Kaptora. Vou te ajudar a fazer as fotos da sua avaliação facial. Leva menos de dois minutos.',
      agente: ''                                // ID do agente de conversa livre no ElevenLabs
    },
    modulos: { telaAoVivo: true, analise: true, metodoDrawnFace: true, fundoEscuro: true, conversaLivre: true },
    consentimento: 'As fotos do rosto e os pontos faciais calculados são dados biométricos, ou seja, dados pessoais sensíveis. Eles serão usados apenas para avaliação, planejamento e acompanhamento do tratamento, ficam guardados com acesso restrito à equipe responsável e podem ser excluídos a pedido da paciente a qualquer momento. Este termo é separado da autorização de uso de imagem em redes sociais.',
    rodape: '',                                 // texto livre do cliente; vazio = só o nome da clínica
    creditoTecnologia: true                     // "Tecnologia Kaptora Face Scan · Aurya Nexus Technologies"
  };
  const CHAVE = 'kaptora-marca', CHAVE_PREVIA = 'kaptora-marca-previa';
  // Servidor de contas do Kaptora (Supabase). A chave publicável é pública por natureza;
  // o que protege os dados são as regras de acesso (RLS) no banco.
  const SB = window.KAPTORA_SUPABASE = { url:'https://vfhayqggbndqfzqvuxbt.supabase.co', chave:'sb_publishable_nyc7oqPxGxXZi0nurJz_AQ_-UxzFs1d' };
  async function doServidor(id, ms = 4000){
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(`${SB.url}/rest/v1/rpc/marca_publica`, { method:'POST', signal:ctl.signal,
        headers:{ apikey:SB.chave, 'Content-Type':'application/json' }, body:JSON.stringify({ p_id:id }) });
      if (!r.ok) return undefined;
      return await r.json();                        // null = não existe no servidor
    } catch(e){ return undefined; }                 // sem internet: undefined
    finally { clearTimeout(t); }
  }
  const ler = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){ return null; } };
  const gravar = (k, v) => { try { v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k); } catch(e){} };
  const mesclar = (base, extra) => {
    const out = Array.isArray(base) ? base.slice() : { ...base };
    Object.entries(extra || {}).forEach(([k, v]) => {
      out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? mesclar(base[k], v) : v;
    });
    return out;
  };
  const limpar = s => String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);

  async function carregar(){
    const p = new URLSearchParams(location.search).get('marca');
    if (p === 'padrao'){ gravar(CHAVE, null); return PADRAO; }
    if (p === '__previa') return mesclar(PADRAO, ler(CHAVE_PREVIA));            // pré-visualização do painel do administrador
    if (p){
      const id = limpar(p), s = await doServidor(id);
      if (s && s.bloqueada) return mesclar(PADRAO, { id, produto:s.produto || PADRAO.produto, bloqueada:true });
      if (s){ const m = mesclar(PADRAO, s); m.id = id; gravar(CHAVE, m); return m; }
      try {
        const r = await fetch(`./marcas/${id}.json`, { cache: 'no-cache' });
        if (r.ok){ const m = mesclar(PADRAO, await r.json()); m.id = id; gravar(CHAVE, m); return m; }
      } catch(e){ console.error('marca', e); }
    }
    const salva = ler(CHAVE);
    if (salva && salva.id && salva.id !== 'kaptora'){
      // Confere no servidor se a marca mudou ou se a licença foi suspensa (sem internet, segue com a guardada)
      const s = await doServidor(salva.id, 2500);
      if (s && s.bloqueada) return mesclar(PADRAO, { id:salva.id, produto:s.produto || salva.produto, bloqueada:true });
      if (s){ const m = mesclar(PADRAO, s); m.id = salva.id; gravar(CHAVE, m); return m; }
    }
    return salva ? mesclar(PADRAO, salva) : PADRAO;
  }

  function aplicar(M){
    if (M.bloqueada){
      const d = document.createElement('div');
      d.setAttribute('role', 'alert');
      d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0a1310;color:#f9f5ed;display:grid;place-items:center;padding:24px;text-align:center;font:16px/1.5 Manrope,system-ui,sans-serif';
      d.innerHTML = '<div style="max-width:420px;display:grid;gap:12px"><div class="k-bloq-nome" style="font:28px Marcellus,serif;text-transform:uppercase;letter-spacing:.04em"></div><p style="margin:0;opacity:.8">O acesso a este sistema está suspenso. Fale com o administrador da sua clínica ou com a Kaptora Face Scan para reativar a licença.</p></div>';
      d.querySelector('.k-bloq-nome').textContent = M.produto || 'Kaptora Face Scan';
      document.body.append(d);
      return;
    }
    // Cores da marca, respeitando o modo claro e o escuro
    const P = (M.cores && M.cores.primaria) || PADRAO.cores.primaria, Ac = (M.cores && M.cores.acento) || PADRAO.cores.acento;
    if (P !== PADRAO.cores.primaria || Ac !== PADRAO.cores.acento){
      const st = document.getElementById('marca-cores') || document.createElement('style'); st.id = 'marca-cores';
      const escuro = `--acento:${Ac};--botao-bg:${Ac};--botao-fg:${P};`;
      st.textContent = `:root{--verde:${P};--ouro:${Ac};--botao-bg:${P};--acento:color-mix(in srgb,${Ac} 72%,#000);--ouro-escuro:color-mix(in srgb,${Ac} 72%,#000)}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${escuro}}}
:root[data-theme="dark"]{${escuro}}`;
      document.head.append(st);
    } else { const st = document.getElementById('marca-cores'); if (st) st.remove(); }
    const titulo = document.querySelector('title');
    if (titulo && titulo.dataset.m) titulo.textContent = titulo.dataset.m === 'painel' ? `${M.produto} · Tela ao vivo` : M.produto;
    estiloMarca();
    textos(document, M);
  }
  // Nome do software no topo: primeira palavra grande, o resto menor (KAPTORA system)
  function estiloMarca(){
    if (document.getElementById('marca-base')) return;
    const st = document.createElement('style'); st.id = 'marca-base';
    st.textContent = `.wordmark{display:inline-flex;align-items:baseline;gap:8px;line-height:1;white-space:nowrap}
.wordmark b{font-family:var(--f-display,'Marcellus',serif);font-weight:400;font-size:26px;letter-spacing:.14em;text-transform:uppercase;color:var(--fg)}
.wordmark small{font-size:11px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--acento,var(--ouro))}
.marca{flex-wrap:wrap;row-gap:4px}
.marca .selo{width:36px;height:36px;font-size:16px}
.marca .marca-sub{flex-basis:100%;padding-left:46px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--fg2)}
.marca-cap.wordmark b{font-size:15px;color:var(--cap-fg,#f9f5ed)}
.marca-cap.wordmark small{font-size:9px}`;
    document.head.prepend(st);
  }
  function textos(raiz, M){
    raiz.querySelectorAll('[data-m]').forEach(el => {
      const t = el.dataset.m;
      if (t === 'produto') el.textContent = M.produto;
      if (t === 'subtitulo'){ el.textContent = M.subtitulo || ''; el.hidden = !M.subtitulo; }
      if (t === 'wordmark'){
        const partes = String(M.produto || 'Kaptora').trim().split(/\s+/);
        el.textContent = ''; const b = document.createElement('b'); b.textContent = partes[0]; el.append(b);
        if (partes.length > 1){ const sm = document.createElement('small'); sm.textContent = partes.slice(1).join(' '); el.append(sm); }
        el.setAttribute('aria-label', M.produto);
      }
      if (t === 'titulo-marca') el.textContent = M.subtitulo ? `${M.produto} · ${M.subtitulo}` : M.produto;
      if (t === 'assistente') el.textContent = M.assistente.nome;
      if (t === 'consentimento') el.textContent = M.consentimento;
      if (t === 'rodape') el.textContent = MARCA_rodape(M);
      if (t === 'selo'){
        el.textContent = '';
        if (M.logo){ const im = document.createElement('img'); im.src = M.logo; im.alt = ''; im.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:50%'; el.append(im); el.style.borderColor = 'transparent'; }
        else el.textContent = M.selo || (M.produto || 'K').trim()[0];
      }
    });
  }
  function MARCA_rodape(M){
    const partes = [M.produto];
    if (M.clinica) partes.push(M.clinica);
    if (M.rodape) partes.push(M.rodape);
    if (M.creditoTecnologia !== false) partes.push(M.id === 'kaptora' ? 'Produzido por Aurya Nexus Technologies' : 'Tecnologia Kaptora Face Scan · Aurya Nexus Technologies');
    return partes.join(' · ');
  }

  window.MARCA_PADRAO = PADRAO;
  window.MARCA_rodape = MARCA_rodape;
  window.MARCA_textos = raiz => { if (window.MARCA){ estiloMarca(); textos(raiz || document, window.MARCA); } };
  window.MARCA_aplicar = M => { const m = mesclar(PADRAO, M || {}); window.MARCA = m; aplicar(m); return m; };
  window.marcaPronta = carregar().then(M => {
    window.MARCA = M;
    const go = () => { if (/admin\.html$/.test(location.pathname)) estiloMarca(); else aplicar(M); };   // o painel do administrador mantém a cara Kaptora
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    return M;
  });
})();
