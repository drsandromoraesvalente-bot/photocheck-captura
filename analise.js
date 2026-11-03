/* =====================================================================
   DF Análise — módulo de análise facial 2D do Kaptora System
   Mede a face nas fotos de frente e de perfil a partir dos 478 pontos do
   MediaPipe, desenha cada medida sobre a foto, dá nota de 0 a 10, permite
   ajustar os pontos à mão e simula mento, papada e malar.
   Valores de referência: iniciais, a validar pelo método Drawn Face.
   ===================================================================== */

const IRIS_MM = 11.7;            // diâmetro médio da íris, usado como régua
const MAX_LADO = 1000;           // resolução de trabalho da foto (px)

/* ---------- Textos clínicos (editáveis) ---------- */
const TEXTOS = {
  eline: {
    nome: 'Linha E (nariz–queixo)',
    sobre: 'Linha da ponta do nariz até o ponto mais projetado do queixo. Mostra o equilíbrio entre nariz, lábios e mento no perfil.',
    leitura: 'Nos perfis equilibrados, os dois lábios ficam um pouco atrás da linha: o superior cerca de 4 mm e o inferior cerca de 2 mm.',
    ref: 'Ricketts RM. Esthetics, environment, and the law of lip relation. Am J Orthod, 1968.',
    caminho: 'Lábios muito à frente da linha costumam indicar mento retraído. Projetar o mento costuma equilibrar melhor que mexer nos lábios.'
  },
  mento: {
    nome: 'Projeção do mento',
    sobre: 'Linha vertical que desce do ponto abaixo do nariz (subnasal), com a cabeça nivelada. Mede onde o queixo fica em relação a ela.',
    leitura: 'Queixo tocando a linha ou um pouco atrás dela é considerado equilibrado. Muito atrás indica mento retraído.',
    ref: 'Baseado no meridiano zero de González-Ulloa.',
    caminho: 'Mento retraído: discutir projeção do mento (lipoenxertia ou implante) na avaliação Drawn Face.'
  },
  cervical: {
    nome: 'Ângulo cervicomentoniano',
    sobre: 'Ângulo entre a linha de baixo do queixo e a linha do pescoço. É o que define o contorno entre rosto e pescoço.',
    leitura: 'Entre 105° e 120° é o padrão de pescoço jovem e definido. Acima de 120° o ângulo abre: papada, flacidez ou acúmulo de gordura.',
    ref: 'Ellenbogen R, Karlin JV. Visual criteria for success in restoring the youthful neck. Plast Reconstr Surg, 1980.',
    caminho: 'Ângulo aberto por gordura submentoniana é indicação central da lipoescultura cervical Drawn Face.',
    manual: 'Os pontos do pescoço são estimados. Toque em “Ajustar pontos” e posicione-os no contorno real do pescoço.'
  },
  nasolabial: {
    nome: 'Ângulo nasolabial',
    sobre: 'Ângulo entre a base do nariz e o lábio superior.',
    leitura: 'Faixa de referência usual: 90° a 110°. Abaixo, nariz caído ou lábio projetado; acima, ponta do nariz muito elevada.',
    ref: 'Faixa de referência usual na literatura de análise facial.',
    caminho: 'Medida de leitura do perfil; orienta a conversa sobre nariz e lábio.'
  },
  cantal: {
    nome: 'Inclinação dos olhos',
    sobre: 'Ângulo entre o canto interno e o canto externo do olho, em relação à horizontal.',
    leitura: 'Canto externo um pouco mais alto que o interno (positivo) transmite olhar descansado. Negativo transmite olhar cansado ou triste.',
    ref: 'Referência a calibrar com o método Drawn Face.',
    caminho: 'Inclinação negativa pode ser suavizada com sustentação do terço superior e lateral da face.'
  },
  malar: {
    nome: 'Altura do malar',
    sobre: 'Onde fica a parte mais larga do rosto, entre a linha das pupilas (100%) e a linha do lábio superior (0%).',
    leitura: 'Malar mais alto, perto da linha dos olhos, é associado a um terço médio mais jovem e projetado.',
    ref: 'Referência visual inicial; calibrar com o método Drawn Face.',
    caminho: 'Malar baixo ou sem volume: lipoenxertia malar com a gordura da própria paciente, rica em células-tronco.'
  },
  tercos: {
    nome: 'Terço inferior (1 : 2)',
    sobre: 'Divide o terço inferior: do subnasal à boca e da boca ao mento.',
    leitura: 'A proporção de referência é 1 para 2: a parte de baixo cerca de o dobro da de cima.',
    ref: 'Legan HL, Burstone CJ. Soft tissue cephalometric analysis for orthognathic surgery. J Oral Surg, 1980.',
    caminho: 'Mento curto ou pouco projetado reduz a parte de baixo e pede avaliação de mento.'
  },
  mandibula: {
    nome: 'Mandíbula ÷ malar',
    sobre: 'Largura do rosto na mandíbula dividida pela largura no malar.',
    leitura: 'Valores altos indicam terço inferior mais largo ou pesado. Valores moderados desenham o formato em V.',
    ref: 'Referência inicial; calibrar com o método Drawn Face.',
    caminho: 'Terço inferior pesado por gordura é indicação da lipoescultura facial Drawn Face.'
  },
  escleral: {
    nome: 'Branco abaixo da íris',
    sobre: 'Distância entre a borda de baixo da íris e a pálpebra inferior.',
    leitura: 'O normal é a pálpebra tocar a íris, sem faixa branca. Faixa branca visível deixa o olhar cansado ou assustado.',
    ref: 'Referência a calibrar com o método Drawn Face.',
    caminho: 'Exposição escleral pede avaliação de sustentação da pálpebra inferior e do terço médio.'
  },
  simetria: {
    nome: 'Simetria',
    sobre: 'Compara pontos do lado direito com o espelho do lado esquerdo em relação à linha média.',
    leitura: 'Desvio médio até 1,5% da largura do rosto é considerado discreto.',
    ref: 'Referência inicial; calibrar com o método Drawn Face.',
    caminho: 'Assimetrias e defeitos de formação podem ser corrigidos no redesenho Drawn Face.'
  }
};

/* ---------- Utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const fmt = (n, c = 1) => (n < 0 ? '−' : '') + Math.abs(n).toFixed(c).replace('.', ',');
const fmtS = (n, c = 1) => (n > 0 ? '+' : '') + fmt(n, c);
const faixa = (v, a, b, perda) => Math.max(0, Math.min(10, v < a ? 10 - (a - v) * perda : v > b ? 10 - (v - b) * perda : 10));
const linear = (v, a, b) => Math.max(0, Math.min(10, (v - a) / (b - a) * 10));
function anguloEm(c, p, q){ // ângulo em c entre c→p e c→q (graus)
  const a1 = Math.atan2(p.y - c.y, p.x - c.x), a2 = Math.atan2(q.y - c.y, q.x - c.x);
  let d = Math.abs(a1 - a2) * 180 / Math.PI; return d > 180 ? 360 - d : d;
}
const esperaQuadro = () => new Promise(r => requestAnimationFrame(r));

/* ---------- Estado ---------- */
const A = {
  config:null, mostrar:null, aoVoltar:null, paciente:'',
  lm:null,                         // FaceLandmarker em modo imagem
  vista:'frente',
  dados:{ frente:null, perfil:null }, // { img, W, H, original(ImageData), lm, pts, escala, sF, estimados:Set, ok }
  sim:{ z1:0, z2:0, z21:0, z3:0, z4:0, z5:0, z6:0, T:0, ZG:0, M:0, OL1:0, SN:0, ME:0 },
  tecnica:'',                      // modelo de técnica aplicado no planejamento
  grade:false,                     // grade de terços e quintos (vista de frente)
  mapa:false,                      // Drawn Face Points + LipoGraft Codes
  desenhando:false, corTraco:'#ceb78e', desenhos:{ frente:[], perfil:[] }, traco:null,
  sel:null, ajustando:false, antes:false, arrastando:null, renderPendente:false
};

// Marca (white label) e módulo do método Drawn Face (mapa de zonas + planejamento DF)
const marca = () => A.marca || window.MARCA || { produto:'Kaptora System', modulos:{ metodoDrawnFace:true } };
const metodoDF = () => !marca().modulos || marca().modulos.metodoDrawnFace !== false;

/* ---------- Detector ---------- */
async function detector(){
  if (A.lm) return A.lm;
  const { FaceLandmarker, FilesetResolver } = await import(A.config.bundle);
  const arquivos = await FilesetResolver.forVisionTasks(A.config.wasm);
  const opc = { baseOptions:{ modelAssetPath:A.config.modelo, delegate:'GPU' }, runningMode:'IMAGE', numFaces:1,
    minFaceDetectionConfidence:0.3, minFacePresenceConfidence:0.3 };
  try { A.lm = await FaceLandmarker.createFromOptions(arquivos, opc); }
  catch(e){ opc.baseOptions.delegate = 'CPU'; A.lm = await FaceLandmarker.createFromOptions(arquivos, opc); }
  return A.lm;
}

/* ---------- Carregar foto ---------- */
async function carregarFoto(vista, blob){
  const bmp = await createImageBitmap(blob);
  const esc = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
  const W = Math.round(bmp.width * esc), H = Math.round(bmp.height * esc);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d', { willReadFrequently:true }); cx.drawImage(bmp, 0, 0, W, H);
  const d = { img:cv, W, H, original:cx.getImageData(0, 0, W, H), lm:null, pts:null, escala:null, sF:1, estimados:new Set(), ok:false, blob };
  A.dados[vista] = d;
  try {
    const det = await detector();
    const res = det.detect(cv);
    if (res.faceLandmarks && res.faceLandmarks.length){
      d.lm = res.faceLandmarks[0].map(p => ({ x:p.x * W, y:p.y * H, z:p.z * W }));
      d.ok = true;
    }
  } catch(e){ console.error(e); }
  montarPontos(vista);
}

/* ---------- Pontos nomeados ---------- */
function irisInfo(lm){
  // Raio = metade do MAIOR diâmetro do anel: de perfil a íris achata na horizontal, mas não na vertical
  const anel = (c, ids) => ({ c:lm[c], r: Math.max(dist(lm[ids[0]], lm[ids[2]]), dist(lm[ids[1]], lm[ids[3]])) / 2 });
  return [anel(468, [469,470,471,472]), anel(473, [474,475,476,477])];
}
function montarPontos(vista){
  const d = A.dados[vista]; const { W, H } = d;
  const P = {};
  if (!d.lm){
    // Sem detecção: modelo padrão no centro da foto para ajuste manual
    const c = { x:W/2, y:H/2 }, u = Math.min(W, H) / 10;
    if (vista === 'frente'){
      Object.assign(P, { olhoD_ext:{x:c.x-2.2*u,y:c.y-1.6*u}, olhoD_int:{x:c.x-.8*u,y:c.y-1.6*u}, olhoE_int:{x:c.x+.8*u,y:c.y-1.6*u}, olhoE_ext:{x:c.x+2.2*u,y:c.y-1.6*u},
        pupilaD:{x:c.x-1.5*u,y:c.y-1.6*u}, pupilaE:{x:c.x+1.5*u,y:c.y-1.6*u}, zigD:{x:c.x-3.2*u,y:c.y-.6*u}, zigE:{x:c.x+3.2*u,y:c.y-.6*u},
        gonD:{x:c.x-2.6*u,y:c.y+1.8*u}, gonE:{x:c.x+2.6*u,y:c.y+1.8*u}, glabela:{x:c.x,y:c.y-2.4*u}, subnasal:{x:c.x,y:c.y+.4*u},
        labioSup:{x:c.x,y:c.y+.9*u}, estomio:{x:c.x,y:c.y+1.2*u}, mento:{x:c.x,y:c.y+3.2*u} });
    } else {
      Object.assign(P, { pronasal:{x:c.x+2*u,y:c.y}, subnasal:{x:c.x+1.2*u,y:c.y+.6*u}, labioSup:{x:c.x+1.3*u,y:c.y+1.1*u}, labioInf:{x:c.x+1.2*u,y:c.y+1.7*u},
        pogonio:{x:c.x+1*u,y:c.y+2.6*u}, mento:{x:c.x+.6*u,y:c.y+3.1*u}, cervical:{x:c.x-1*u,y:c.y+3.6*u}, pescoco:{x:c.x-1.3*u,y:c.y+5.5*u} });
    }
    d.pts = P; d.escala = IRIS_MM / (Math.min(W, H) * 0.045); d.sF = 1;
    Object.keys(P).forEach(k => d.estimados.add(k));
    return;
  }
  const lm = d.lm;
  const iris = irisInfo(lm);
  if (vista === 'frente'){
    // Íris da esquerda da imagem = olho direito da paciente
    const [i1, i2] = iris[0].c.x < iris[1].c.x ? iris : [iris[1], iris[0]];
    const rMed = (i1.r + i2.r) / 2;
    d.escala = IRIS_MM / (2 * rMed);             // mm por pixel
    const olhoD = lm[33].x < lm[263].x;           // olho direito da paciente na esquerda da imagem
    Object.assign(P, {
      olhoD_ext:lm[olhoD?33:263], olhoD_int:lm[olhoD?133:362], olhoE_int:lm[olhoD?362:133], olhoE_ext:lm[olhoD?263:33],
      pupilaD:i1.c, pupilaE:i2.c,
      irisD_inf:{ x:i1.c.x, y:i1.c.y + i1.r }, irisE_inf:{ x:i2.c.x, y:i2.c.y + i2.r },
      palpD_inf:lm[olhoD?145:374], palpE_inf:lm[olhoD?374:145],
      zigD:lm[234].x < lm[454].x ? lm[234] : lm[454], zigE:lm[234].x < lm[454].x ? lm[454] : lm[234],
      gonD:lm[172].x < lm[397].x ? lm[172] : lm[397], gonE:lm[172].x < lm[397].x ? lm[397] : lm[172],
      glabela:lm[9], subnasal:lm[2], labioSup:lm[0], estomio:mid(lm[13], lm[14]), mento:lm[152],
      malarD:lm[117].x < lm[346].x ? lm[117] : lm[346], malarE:lm[117].x < lm[346].x ? lm[346] : lm[117]
    });
  } else {
    // Perfil: sentido do rosto pela posição do nariz em relação ao centro dos pontos
    const mx = lm.reduce((s, p) => s + p.x, 0) / lm.length;
    d.sF = lm[1].x > mx ? 1 : -1;
    const maiorIris = iris[0].r > iris[1].r ? iris[0] : iris[1];
    d.escala = IRIS_MM / (2 * maiorIris.r);
    const queixo = [152, 175, 199, 200, 18].map(i => lm[i]);
    const pog = queixo.reduce((b, p) => (p.x * d.sF > b.x * d.sF ? p : b), queixo[0]);
    const M = lm[152], faceH = dist(lm[10], lm[152]);
    // Pescoço: não existe na malha facial; estimativa inicial para ajuste manual
    const C = { x:M.x - d.sF * faceH * 0.30, y:M.y + faceH * 0.10 };
    const N = { x:C.x - d.sF * faceH * 0.06, y:C.y + faceH * 0.38 };
    Object.assign(P, { pronasal:lm[1], subnasal:lm[2], labioSup:lm[0], labioInf:lm[17], pogonio:pog, mento:M,
      cervical:{ x:Math.max(0, Math.min(W, C.x)), y:Math.min(H - 1, C.y) }, pescoco:{ x:Math.max(0, Math.min(W, N.x)), y:Math.min(H - 1, N.y) } });
    d.estimados.add('cervical'); d.estimados.add('pescoco');
    // Encosta os pontos da linha média no contorno real do perfil (borda rosto/fundo)
    ['pronasal', 'subnasal', 'labioSup', 'labioInf', 'pogonio'].forEach(n => { P[n] = encostarNoContorno(d, P[n], faceH); });
  }
  // cópia independente para permitir arrastar
  d.pts = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, { x:p.x, y:p.y }]));
}

// Procura, na horizontal, a borda mais forte entre o rosto e o fundo perto do ponto
function encostarNoContorno(d, p, faceH){
  const { W, H } = d, px = d.original.data, sF = d.sF;
  const lum = (x, y) => { x = Math.max(0, Math.min(W - 1, x | 0)); y = Math.max(0, Math.min(H - 1, y | 0)); const i = (y * W + x) * 4; return 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; };
  const linhaLum = x => (lum(x, p.y - 1) + lum(x, p.y) + lum(x, p.y + 1)) / 3;
  const alcance = Math.round(faceH * 0.06);
  let melhor = 0, melhorX = p.x;
  for (let t = -Math.round(alcance * 0.3); t <= alcance; t++){
    const x = p.x + sF * t, g = Math.abs(linhaLum(x + sF * 2) - linhaLum(x - sF * 2));
    if (g > melhor){ melhor = g; melhorX = x; }
  }
  return melhor > 18 ? { x:melhorX, y:p.y } : p;   // só move se a borda for nítida
}

/* ---------- Planejamento: regiões, ações e modelos de técnica ---------- */
// Plano único por paciente (vale para frente e perfil): zonas Drawn Face Points (lipoescultura)
// e regiões LipoGraft Codes (lipoenxertia), com os nomes do método.
const SIM_VAZIO = () => ({ z1:0, z2:0, z21:0, z3:0, z4:0, z5:0, z6:0, T:0, ZG:0, M:0, OL1:0, SN:0, ME:0 });
// [chave, rótulo, ação, mínimo, máximo, passo, unidade]
const GRUPOS = [
  { titulo:'Lipoescultura · Drawn Face Points', itens:[
    ['z1', 'Zona 1', 'retirar', 0, 1, 0.05, '%'],
    ['z2', 'Zona 2', 'retirar', 0, 1, 0.05, '%'],
    ['z21', 'Zona 2.1', 'retirar', 0, 1, 0.05, '%'],
    ['z3', 'Zona 3', 'retirar', 0, 1, 0.05, '%'],
    ['z4', 'Zona 4', 'retirar', 0, 1, 0.05, '%'],
    ['z5', 'Zona 5', 'retirar', 0, 1, 0.05, '%'],
    ['z6', 'Zona 6', 'retirar', 0, 1, 0.05, '%'] ] },
  { titulo:'Lipoenxertia · LipoGraft Codes', itens:[
    ['T', 'T', 'repor', 0, 1, 0.05, '%'],
    ['ZG', 'ZG', 'repor', 0, 1, 0.05, '%'],
    ['M', 'M', 'repor', 0, 1, 0.05, '%'],
    ['OL1', 'OL1', 'repor', 0, 1, 0.05, '%'],
    ['SN', 'SN', 'repor', 0, 1, 0.05, '%'],
    ['ME', 'ME', 'projetar', 0, 10, 0.5, 'mm'] ] }
];
const ITENS = GRUPOS.flatMap(g => g.itens);
const ACAO = { retirar:'Retirar volume', repor:'Repor volume', projetar:'Projetar', suavizar:'Suavizar sombra' };
// Modelos de partida (ilustrativos). Os valores devem ser calibrados pelo método Drawn Face.
const TECNICAS = {
  'Drawn Face cervicofacial': { z1:.8, z2:.5, z21:.4, z3:.4, z4:.7, z5:.3, z6:.3, T:.4, ZG:.4, M:.5, OL1:.4, SN:.3, ME:3 },
  'Só lipoenxertia (LipoGraft)': { z1:0, z2:0, z21:0, z3:0, z4:0, z5:0, z6:0, T:.4, ZG:.4, M:.5, OL1:.5, SN:.5, ME:4 }
};
// Como cada zona/código move a imagem na simulação
function efeitos(vista){
  const P = A.sim;
  return vista === 'perfil'
    ? { mento:P.ME, papada:P.z1, jowlP:P.z4 }
    : { temporas:P.T, malar:Math.max(P.M, P.ZG), olheira:P.OL1, sulco:Math.max(P.SN, P.z3 * 0.6), jowls:P.z4, submento:P.z1, angulo:P.z2, lateral:P.z5, pescoco:P.z21 };
}
/* ---------- Mapa Drawn Face Points + LipoGraft Codes sobre a foto ---------- */
// Pares espelhados da malha (lado direito do paciente → lado esquerdo)
const ESPELHO = {234:454,93:323,132:361,58:288,172:397,136:365,150:379,149:378,176:400,148:377,127:356,117:346,123:352,147:376,187:411,205:425,206:426,207:427,129:358,61:291,137:366,177:401,215:435,138:367,135:364,170:395,203:423,98:327,64:294,50:280,142:371,121:350,193:417,143:372,213:433,31:261,116:345,57:287,43:273,204:424,211:431,108:337,107:336,139:368,37:267,84:314,212:432,227:447,21:251,54:284,169:394};
const IDX = (lado, i) => lado === 'D' ? i : (ESPELHO[i] ?? i);
// Lado do paciente mais visível na foto (no perfil só um lado aparece)
function ladoVisivel(d){ const f = d.lm; return dist(f[234], f[1]) >= dist(f[454], f[1]) ? 'D' : 'E'; }
const ZONAS_DF = [
  // [rótulo, cor, chave do plano, índices (lado direito do paciente)]
  ['5', '#a5d63c', 'z5', [31, 143, 127, 234, 123, 117]],
  ['6', null, 'z6', [129, 50, 123, 147, 187, 205, 203]],
  ['3', '#6f88a8', 'z3', [129, 203, 205, 187, 147, 137, 177, 213, 207, 206, 98]],
  ['4', '#f5b63a', 'z4', [206, 207, 213, 177, 215, 138, 135, 136, 150, 149, 170, 211, 204, 43, 57]],
  ['2', '#e8457a', 'z2', [234, 93, 132, 58, 172, 138, 215, 177, 137]]
];
const CODIGOS = [ // [código, chave do plano ou null, índice (lado direito do paciente)]
  ['F', null, 108], ['G', null, 107], ['OB', null, 193], ['OL1', 'OL1', 121], ['M', 'M', 142], ['ZG', 'ZG', 116], ['T', 'T', 139],
  ['N2', null, 197], ['N1', null, 164], ['FP', null, 64], ['SN', 'SN', -1], ['LS', null, 37], ['LI', null, 84],
  ['MN', null, 204], ['SLM', null, 18], ['ME', 'ME', 199], ['MB1', null, 176], ['MB2', null, 136]
];
function poligonosDF(d, vista){
  const f = d.lm; if (!f) return [];
  const hh = dist(f[10], f[152]), cima = { x:(f[152].x - f[168].x) / dist(f[152], f[168]), y:(f[152].y - f[168].y) / dist(f[152], f[168]) };
  const desce = (q, k, tras = { x:0, y:0 }, kt = 0) => ({ x:q.x + cima.x * hh * k + tras.x * hh * kt, y:q.y + cima.y * hh * k + tras.y * hh * kt });
  const lados = vista === 'perfil' ? [ladoVisivel(d)] : ['D', 'E'];
  const out = [];
  lados.forEach(L => {
    const P = i => f[IDX(L, i)];
    ZONAS_DF.forEach(([rot, cor, k, idx]) => out.push({ rot, cor, k, pts:idx.map(P) }));
    // 2.1: abaixo do ângulo, ao longo do pescoço
    const tv = { x:P(234).x - f[1].x, y:P(234).y - f[1].y }, tn = Math.hypot(tv.x, tv.y) || 1, tras = { x:tv.x / tn, y:tv.y / tn };
    out.push({ rot:'2.1', cor:'#e8457a', k:'z21', pts:[P(172), P(136), desce(P(136), 0.42), desce(P(172), 0.55, tras, 0.06)] });
  });
  // 1: submento / cervical
  if (vista === 'perfil'){
    const L = lados[0], P = i => f[IDX(L, i)], pt = d.pts || {};
    const frente = [pt.mento, pt.cervical, pt.pescoco].filter(Boolean);
    out.push({ rot:'1', cor:'#7d8a5a', k:'z1', pts:[P(136), P(150), P(149), P(176), P(148), f[152], ...frente, desce(P(136), 0.42)] });
  } else {
    const borda = [136, 150, 149, 176, 148].map(i => f[i]).concat([f[152]], [377, 400, 378, 379, 365].map(i => f[i]));
    out.push({ rot:'1', cor:'#7d8a5a', k:'z1', pts:[...borda, desce(f[365], 0.28), desce(f[152], 0.30), desce(f[136], 0.28)] });
  }
  return out;
}
function desenharMapa(cx, d, vista, u, texto){
  const zs = poligonosDF(d, vista); if (!zs.length) return;
  const ordem = ['1', '2.1', '2', '4', '3', '5', '6'];
  zs.sort((a, b) => ordem.indexOf(a.rot) - ordem.indexOf(b.rot)).forEach(z => {
    const ativo = A.sim[z.k] > 0;
    cx.beginPath(); z.pts.forEach((q, i) => i ? cx.lineTo(q.x, q.y) : cx.moveTo(q.x, q.y)); cx.closePath();
    if (z.cor){ cx.globalAlpha = ativo ? 0.30 + A.sim[z.k] * 0.30 : 0.22; cx.fillStyle = z.cor; cx.fill(); cx.globalAlpha = 1; }
    cx.setLineDash(z.cor ? [] : [6 * u, 4 * u]); cx.lineWidth = (ativo ? 2 : 1.2) * u; cx.strokeStyle = z.cor || '#111'; cx.stroke(); cx.setLineDash([]);
    const c = z.pts.reduce((a, q) => ({ x:a.x + q.x / z.pts.length, y:a.y + q.y / z.pts.length }), { x:0, y:0 });
    texto(z.rot, { x:c.x - 5 * u, y:c.y + 5 * u }, '#ffffff');
  });
  if (vista !== 'frente' || !d.lm) return;
  const f = d.lm;
  CODIGOS.forEach(([cod, k, i]) => {
    const q = i < 0 ? (() => { const m = mid(f[129], f[61]); return { x:m.x - dist(f[234], f[454]) * 0.03, y:m.y }; })() : f[i];
    const ativo = k && A.sim[k] > 0;
    cx.beginPath(); cx.fillStyle = ativo ? '#4fb3a9' : 'rgba(255,255,255,.85)'; cx.arc(q.x, q.y, 3 * u, 0, Math.PI * 2); cx.fill();
    texto(cod, { x:q.x + 5 * u, y:q.y - 4 * u }, ativo ? '#4fb3a9' : '#ffffff');
  });
}

const simAtiva = () => Object.values(A.sim).some(x => x);

// Regiões de sombra (olheira e sulco): clareia de leve a sombra, simulando profundidade corrigida
function luzes(vista){
  const d = A.dados[vista]; if (!d || !d.lm || vista !== 'frente' || A.antes) return [];
  const s = efeitos('frente'), lm = d.lm, out = [];
  const w = dist(lm[234], lm[454]), meio = lm[168].x;
  if (s.olheira) [[33, 133, 145], [263, 362, 374]].forEach(([a, b, c]) => {
    const ew = dist(lm[a], lm[b]);
    out.push({ x:lm[c].x, y:lm[c].y + ew * 0.38, rx:ew * 0.6, ry:ew * 0.22, ang:0, k:s.olheira });
  });
  if (s.sulco) [[129, 61], [358, 291]].forEach(([a, b]) => {
    const P1 = lm[a], P2 = lm[b], m = mid(P1, P2), lado = m.x < meio ? -1 : 1;
    out.push({ x:m.x + lado * w * 0.02, y:m.y, rx:dist(P1, P2) * 0.6, ry:w * 0.035, ang:Math.atan2(P2.y - P1.y, P2.x - P1.x), k:s.sulco });
  });
  return out;
}
function iluminar(img, W, H, ls){
  const o = img.data;
  ls.forEach(L => {
    const R = Math.max(L.rx, L.ry) * 2, co = Math.cos(-L.ang), si = Math.sin(-L.ang);
    const x0 = Math.max(0, Math.floor(L.x - R)), x1 = Math.min(W - 1, Math.ceil(L.x + R));
    const y0 = Math.max(0, Math.floor(L.y - R)), y1 = Math.min(H - 1, Math.ceil(L.y + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++){
      const dx = x - L.x, dy = y - L.y, u = dx * co - dy * si, v = dx * si + dy * co;
      const e = (u * u) / (L.rx * L.rx) + (v * v) / (L.ry * L.ry); if (e > 4) continue;
      const wgt = Math.exp(-e * 1.2) * L.k * 0.35, j = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) o[j + c] += wgt * (255 - o[j + c]);
    }
  });
}

/* ---------- Pontos com a simulação aplicada ---------- */
function alcas(vista){
  const d = A.dados[vista]; if (!d || !d.pts) return [];
  const p = d.pts, s = efeitos(vista), px = mm => mm / d.escala;
  const h = [];
  if (vista === 'perfil'){
    if (s.mento){
      const r = dist(p.subnasal, p.mento) * 0.55;
      h.push({ x:p.pogonio.x, y:p.pogonio.y, dx:d.sF * px(s.mento), dy:0, r, ponto:'pogonio' });
      h.push({ x:p.mento.x, y:p.mento.y, dx:d.sF * px(s.mento) * 0.8, dy:0, r:r * 0.8, ponto:'mento' });
    }
    if (s.papada){
      const a = dist(p.mento, p.cervical);
      const Q = { x:p.mento.x - d.sF * a * 0.92, y:p.mento.y + a * 0.10 };
      const dx = (Q.x - p.cervical.x) * s.papada, dy = (Q.y - p.cervical.y) * s.papada;
      h.push({ x:p.cervical.x, y:p.cervical.y, dx, dy, r:a * 0.45, ponto:'cervical' });
      const m = mid(p.mento, p.cervical);
      h.push({ x:m.x, y:m.y, dx:dx * 0.55, dy:dy * 0.55, r:a * 0.35 });
    }
    if (d.lm && s.jowlP){         // zona 4 no perfil: a borda da mandíbula sobe
      const lado = ladoVisivel(d), up = px(2.5) * s.jowlP, f = d.lm;
      [IDX(lado, 150), IDX(lado, 149), IDX(lado, 136)].forEach(i => h.push({ x:f[i].x, y:f[i].y, dx:0, dy:-up, r:dist(p.subnasal, p.mento) * 0.45 }));
    }
  } else {
    const lm = d.lm, w = dist(p.zigD, p.zigE), meio = lm ? lm[168].x : (p.zigD.x + p.zigE.x) / 2;
    const lado = q => q.x < meio ? -1 : 1;   // -1 = metade esquerda da imagem
    if (s.malar && p.malarD){
      const up = px(3) * s.malar, out = px(1.5) * s.malar;
      h.push({ x:p.malarD.x, y:p.malarD.y, dx:-out, dy:-up, r:w * 0.11, ponto:'malarD' });
      h.push({ x:p.malarE.x, y:p.malarE.y, dx:out, dy:-up, r:w * 0.11, ponto:'malarE' });
      h.push({ x:p.zigD.x, y:p.zigD.y, dx:-out * 0.5, dy:-up, r:w * 0.10, ponto:'zigD' });
      h.push({ x:p.zigE.x, y:p.zigE.y, dx:out * 0.5, dy:-up, r:w * 0.10, ponto:'zigE' });
    }
    if (lm && s.temporas){        // repor: o contorno da têmpora expande para fora
      const out = px(3) * s.temporas;
      [lm[21], lm[251]].forEach(q => h.push({ x:q.x, y:q.y, dx:lado(q) * out, dy:0, r:w * 0.09 }));
      [lm[54], lm[284]].forEach(q => h.push({ x:q.x, y:q.y, dx:lado(q) * out * 0.5, dy:0, r:w * 0.08 }));
    }
    if (s.jowls){                 // retirar: o contorno da mandíbula recolhe para dentro e sobe
      const inn = px(3) * s.jowls, up = px(1.5) * s.jowls;
      h.push({ x:p.gonD.x, y:p.gonD.y, dx:inn, dy:-up, r:w * 0.10, ponto:'gonD' });
      h.push({ x:p.gonE.x, y:p.gonE.y, dx:-inn, dy:-up, r:w * 0.10, ponto:'gonE' });
      if (lm) [lm[136], lm[365]].forEach(q => h.push({ x:q.x, y:q.y, dx:-lado(q) * inn, dy:-up, r:w * 0.09 }));
    }
    if (lm && s.angulo){          // zona 2: contorno posterior do ramo recolhe
      const inn = px(2) * s.angulo;
      [lm[132], lm[361], lm[58], lm[288]].forEach(q => h.push({ x:q.x, y:q.y, dx:-lado(q) * inn, dy:0, r:w * 0.08 }));
    }
    if (lm && s.lateral){         // zona 5: face lateral do zigoma recolhe
      const inn = px(1.5) * s.lateral;
      [lm[234], lm[454], lm[227], lm[447]].forEach(q => h.push({ x:q.x, y:q.y, dx:-lado(q) * inn, dy:0, r:w * 0.08 }));
    }
    if (lm && s.pescoco){         // zona 2.1: contorno lateral do pescoço abaixo do ângulo
      const inn = px(2.5) * s.pescoco, hh = dist(lm[10], lm[152]);
      [lm[172], lm[397]].forEach(q => h.push({ x:q.x, y:q.y + hh * 0.18, dx:-lado(q) * inn, dy:0, r:w * 0.10 }));
    }
    if (lm && s.submento){        // retirar: o contorno de baixo do queixo sobe
      const up = px(2.5) * s.submento;
      [lm[148], lm[176], lm[377], lm[400]].forEach(q => h.push({ x:q.x, y:q.y, dx:0, dy:-up, r:w * 0.07 }));
    }
  }
  return h;
}
function pontosSimulados(vista){
  const d = A.dados[vista]; const q = Object.fromEntries(Object.entries(d.pts).map(([k, p]) => [k, { ...p }]));
  if (A.antes) return q;
  alcas(vista).forEach(h => { if (h.ponto && q[h.ponto]){ q[h.ponto].x += h.dx; q[h.ponto].y += h.dy; } });
  return q;
}

/* ---------- Medidas ---------- */
function distanciaComSinal(P, A1, B1, sF){ // distância de P à reta A1–B1; + = à frente (lado para onde o rosto aponta)
  const vx = B1.x - A1.x, vy = B1.y - A1.y, L = Math.hypot(vx, vy) || 1;
  let nx = -vy / L, ny = vx / L;
  if (nx * sF < 0){ nx = -nx; ny = -ny; }   // normal apontando para a frente do rosto
  return (P.x - A1.x) * nx + (P.y - A1.y) * ny;
}
// Inclinação de cada olho, corrigindo a inclinação da cabeça pela linha dos cantos internos
function inclinacaoCantal(p){
  const roll = Math.atan2(p.olhoE_int.y - p.olhoD_int.y, p.olhoE_int.x - p.olhoD_int.x);
  const c = Math.cos(-roll), s = Math.sin(-roll), r = q => ({ x:q.x * c - q.y * s, y:q.x * s + q.y * c });
  const um = (ext, int) => { const e = r(ext), i = r(int); return Math.atan2(i.y - e.y, Math.abs(e.x - i.x)) * 180 / Math.PI; };
  return (um(p.olhoD_ext, p.olhoD_int) + um(p.olhoE_ext, p.olhoE_int)) / 2;
}
function medidas(vista){
  const d = A.dados[vista]; if (!d || !d.pts) return [];
  const p = pontosSimulados(vista), e = d.escala, mm = px => px * e;
  const out = [];
  if (vista === 'perfil'){
    // Linha E
    const ds = mm(distanciaComSinal(p.labioSup, p.pronasal, p.pogonio, d.sF));
    const di = mm(distanciaComSinal(p.labioInf, p.pronasal, p.pogonio, d.sF));
    const notaE = Math.min(faixa(ds, -6, -2, 1.4), faixa(di, -4, 0, 1.4));
    out.push({ id:'eline', valor:di, unidade:'mm', texto:`sup. ${fmtS(ds)} mm · inf. ${fmtS(di)} mm`,
      rotulo: di > 0 ? 'Lábios à frente' : di < -4 ? 'Lábios atrás' : 'Equilibrado', nota:notaE,
      barra:{ min:-12, max:8, a:-4, b:0, ladoMin:'atrás', ladoMax:'à frente' } });
    // Projeção do mento (vertical do subnasal)
    const proj = mm((p.pogonio.x - p.subnasal.x) * d.sF);
    out.push({ id:'mento', valor:proj, unidade:'mm', texto:`${fmtS(proj)} mm`,
      rotulo: proj < -6 ? 'Retraído' : proj < -3 ? 'Levemente atrás' : proj > 2 ? 'Projetado' : 'Equilibrado', nota:faixa(proj, -3, 1, 1),
      barra:{ min:-20, max:8, a:-3, b:1, ladoMin:'atrás', ladoMax:'à frente' } });
    // Cervicomentoniano
    const ang = anguloEm(p.cervical, p.mento, p.pescoco);
    out.push({ id:'cervical', valor:ang, unidade:'°', texto:`${fmt(ang, 0)}°`,
      rotulo: ang > 130 ? 'Aberto' : ang > 120 ? 'Levemente aberto' : ang < 100 ? 'Fechado' : 'Definido', nota:faixa(ang, 105, 120, 0.4),
      barra:{ min:85, max:160, a:105, b:120, ladoMin:'fechado', ladoMax:'aberto' }, estimado: d.estimados.has('cervical') || d.estimados.has('pescoco') });
    // Nasolabial
    const nl = anguloEm(p.subnasal, p.pronasal, p.labioSup);
    out.push({ id:'nasolabial', valor:nl, unidade:'°', texto:`${fmt(nl, 0)}°`,
      rotulo: nl < 90 ? 'Fechado' : nl > 110 ? 'Aberto' : 'Na faixa', nota:faixa(nl, 90, 110, 0.35),
      barra:{ min:60, max:140, a:90, b:110, ladoMin:'fechado', ladoMax:'aberto' } });
  } else {
    const cantal = inclinacaoCantal(p);
    out.push({ id:'cantal', valor:cantal, unidade:'°', texto:`${fmtS(cantal)}°`,
      rotulo: cantal < 0 ? 'Negativa' : cantal < 4 ? 'Neutra' : 'Positiva', nota:faixa(cantal, 4, 8, 1.2),
      barra:{ min:-8, max:14, a:4, b:8, ladoMin:'para baixo', ladoMax:'para cima' } });
    // Altura do malar
    const yPup = (p.pupilaD.y + p.pupilaE.y) / 2, yLab = p.labioSup.y, yZig = (p.zigD.y + p.zigE.y) / 2;
    const alt = (yLab - yZig) / (yLab - yPup) * 100;
    out.push({ id:'malar', valor:alt, unidade:'%', texto:`${fmt(alt, 0)}%`,
      rotulo: alt >= 78 ? 'Alto' : alt >= 66 ? 'Médio' : 'Baixo', nota:linear(alt, 55, 85),
      barra:{ min:40, max:100, a:75, b:100, ladoMin:'baixo', ladoMax:'alto' } });
    // Terço inferior 1:2
    const sup = dist(p.subnasal, p.estomio), inf = dist(p.estomio, p.mento), raz = inf / sup;
    out.push({ id:'tercos', valor:raz, unidade:'', texto:`1 : ${fmt(raz, 2)}`,
      rotulo: raz < 1.8 ? 'Parte de baixo curta' : raz > 2.2 ? 'Parte de baixo longa' : 'Proporcional', nota:faixa(raz, 1.8, 2.2, 8),
      barra:{ min:1.2, max:2.8, a:1.8, b:2.2, ladoMin:'curta', ladoMax:'longa' } });
    // Mandíbula ÷ malar
    const rm = dist(p.gonD, p.gonE) / dist(p.zigD, p.zigE);
    out.push({ id:'mandibula', valor:rm, unidade:'', texto:fmt(rm, 2),
      rotulo: rm > 0.9 ? 'Terço inferior largo' : rm < 0.7 ? 'Afilado' : 'Formato em V', nota:faixa(rm, 0.72, 0.86, 25),
      barra:{ min:0.6, max:1.05, a:0.72, b:0.86, ladoMin:'afilado', ladoMax:'largo' } });
    // Exposição escleral inferior
    if (p.irisD_inf && p.palpD_inf){
      const gD = mm(p.palpD_inf.y - p.irisD_inf.y), gE = mm(p.palpE_inf.y - p.irisE_inf.y), g = Math.max(gD, gE);
      out.push({ id:'escleral', valor:g, unidade:'mm', texto:`${fmt(Math.max(0, g))} mm`,
        rotulo: g > 1 ? 'Faixa branca visível' : g > 0.4 ? 'Faixa discreta' : 'Sem faixa branca', nota:faixa(g, -3, 0.4, 3),
        barra:{ min:-2, max:3, a:-2, b:0.4, ladoMin:'cobre', ladoMax:'faixa' } });
    }
    // Simetria (pontos originais da malha)
    if (d.lm){
      const lm = d.lm, A1 = lm[168], B1 = lm[152];
      const vx = B1.x - A1.x, vy = B1.y - A1.y, L2 = vx * vx + vy * vy;
      const espelho = q => { const t = ((q.x - A1.x) * vx + (q.y - A1.y) * vy) / L2; const fx = A1.x + t * vx, fy = A1.y + t * vy; return { x:2 * fx - q.x, y:2 * fy - q.y }; };
      const pares = [[33,263],[133,362],[234,454],[172,397],[61,291],[50,280],[70,300],[58,288]];
      const larg = dist(lm[234], lm[454]);
      const dev = pares.reduce((s, [i, j]) => s + dist(lm[i], espelho(lm[j])), 0) / pares.length / larg * 100;
      out.push({ id:'simetria', valor:dev, unidade:'%', texto:`${fmt(dev)}%`,
        rotulo: dev <= 1.5 ? 'Simétrico' : dev <= 3 ? 'Assimetria discreta' : 'Assimetria evidente', nota:faixa(dev, 0, 1.5, 1.5),
        barra:{ min:0, max:6, a:0, b:1.5, ladoMin:'simétrico', ladoMax:'assimétrico' } });
    }
  }
  return out;
}

/* ---------- Deformação da foto (simulação) ---------- */
function deformar(d, hs){
  const { W, H } = d, src = d.original.data;
  const out = new ImageData(new Uint8ClampedArray(src), W, H);
  if (!hs.length) return out;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  hs.forEach(h => { const cx = h.x + h.dx, cy = h.y + h.dy, R = h.r * 3;
    x0 = Math.min(x0, cx - R, h.x - R); y0 = Math.min(y0, cy - R, h.y - R); x1 = Math.max(x1, cx + R, h.x + R); y1 = Math.max(y1, cy + R, h.y + R); });
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1));
  const o = out.data;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++){
    let sx = x, sy = y;
    for (const h of hs){
      const cx = h.x + h.dx, cy = h.y + h.dy, d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      const w = Math.exp(-d2 / (2 * h.r * h.r)); sx -= h.dx * w; sy -= h.dy * w;
    }
    if (sx < 0 || sy < 0 || sx >= W - 1 || sy >= H - 1) continue;
    const ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy, i = (iy * W + ix) * 4, j = (y * W + x) * 4;
    for (let c = 0; c < 3; c++){
      const a = src[i + c] * (1 - fx) + src[i + 4 + c] * fx, b = src[i + W * 4 + c] * (1 - fx) + src[i + W * 4 + 4 + c] * fx;
      o[j + c] = a * (1 - fy) + b * fy;
    }
  }
  return out;
}

function imagemPlanejada(vista){
  const d = A.dados[vista]; if (A.antes) return d.original;
  const im = deformar(d, alcas(vista)); iluminar(im, d.W, d.H, luzes(vista)); return im;
}

/* ---------- Desenho ---------- */
const COR = { linha:'#ceb78e', forte:'#f9f5ed', ruim:'#e0806e', bom:'#8fd3a8', sombra:'rgba(10,19,16,.55)' };
function desenhar(){
  A.renderPendente = false;
  const d = A.dados[A.vista], cv = $('#dfa-canvas'); if (!cv) return;
  const cx = cv.getContext('2d');
  if (!d){ cv.width = 10; cv.height = 10; return; }
  const largCss = cv.parentElement.clientWidth, dpr = Math.min(2, window.devicePixelRatio || 1);
  const k = largCss / d.W;
  cv.style.height = (d.H * k) + 'px';
  cv.width = Math.round(largCss * dpr); cv.height = Math.round(d.H * k * dpr);
  const img = imagemPlanejada(A.vista);
  const tmp = d._tmp || (d._tmp = document.createElement('canvas')); tmp.width = d.W; tmp.height = d.H;
  tmp.getContext('2d').putImageData(img, 0, 0);
  cx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  cx.drawImage(tmp, 0, 0);
  if (!d.pts) return;
  const p = pontosSimulados(A.vista), u = 1 / k; // u = 1 px de tela em coordenadas da foto
  const ms = medidas(A.vista), sel = A.sel;
  const linha = (a, b, cor = COR.linha, w = 1.5, tracejado) => { cx.beginPath(); cx.setLineDash(tracejado ? [6 * u, 5 * u] : []); cx.strokeStyle = cor; cx.lineWidth = w * u; cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); cx.setLineDash([]); };
  const ponto = (a, cor = COR.forte, r = 3) => { cx.beginPath(); cx.fillStyle = cor; cx.arc(a.x, a.y, r * u, 0, Math.PI * 2); cx.fill(); };
  const texto = (t, a, cor = COR.forte, alinhar = 'left') => {
    cx.font = `600 ${12 * u}px Manrope, system-ui, sans-serif`;
    const w = cx.measureText(t).width, m = 6 * u;
    let x0 = alinhar === 'right' ? a.x - w : a.x;            // mantém o texto dentro da foto
    x0 = Math.max(m, Math.min(d.W - w - m, x0));
    cx.textAlign = 'left'; cx.lineWidth = 3 * u; cx.strokeStyle = COR.sombra; cx.strokeText(t, x0, a.y); cx.fillStyle = cor; cx.fillText(t, x0, a.y);
  };
  const estender = (a, b, f) => ({ x:a.x + (b.x - a.x) * f, y:a.y + (b.y - a.y) * f });
  const corDe = m => m.nota >= 7 ? COR.bom : m.nota >= 4 ? COR.linha : COR.ruim;
  const mostra = id => !sel || sel === id;
  ms.forEach(m => {
    if (!mostra(m.id)) return;
    const c = corDe(m), forte = sel === m.id ? 2.2 : 1.4;
    switch (m.id){
      case 'eline': {
        const a = estender(p.pogonio, p.pronasal, 1.15), b = estender(p.pronasal, p.pogonio, 1.15);
        linha(a, b, c, forte);
        [['labioSup', 'sup'], ['labioInf', 'inf']].forEach(([n]) => ponto(p[n], c));
        if (sel) texto(m.texto, { x:p.pronasal.x + 14 * u * A.dados.perfil.sF, y:p.pronasal.y - 10 * u }, COR.forte, A.dados.perfil.sF > 0 ? 'left' : 'right');
        break; }
      case 'mento': {
        const topo = { x:p.subnasal.x, y:p.subnasal.y }, baixo = { x:p.subnasal.x, y:p.mento.y + 20 * u };
        linha(topo, baixo, c, forte, true);
        linha({ x:p.subnasal.x, y:p.pogonio.y }, p.pogonio, c, forte);
        ponto(p.pogonio, c); ponto(p.subnasal, COR.forte);
        if (sel) texto(m.texto, { x:p.pogonio.x + 10 * u * A.dados.perfil.sF, y:p.pogonio.y + 4 * u }, COR.forte, A.dados.perfil.sF > 0 ? 'left' : 'right');
        break; }
      case 'cervical': {
        linha(p.mento, p.cervical, c, forte); linha(p.cervical, p.pescoco, c, forte);
        ponto(p.mento, c); ponto(p.cervical, c, 4); ponto(p.pescoco, c);
        if (sel) texto(m.texto, { x:p.cervical.x - 12 * u * A.dados.perfil.sF, y:p.cervical.y - 8 * u }, COR.forte, A.dados.perfil.sF > 0 ? 'right' : 'left');
        break; }
      case 'nasolabial': {
        linha(p.subnasal, estender(p.subnasal, p.pronasal, 1.1), c, forte); linha(p.subnasal, estender(p.subnasal, p.labioSup, 1.3), c, forte);
        ponto(p.subnasal, c);
        break; }
      case 'cantal': {
        linha(estender(p.olhoD_int, p.olhoD_ext, 1.25), p.olhoD_int, c, forte); linha(p.olhoE_int, estender(p.olhoE_int, p.olhoE_ext, 1.25), c, forte);
        linha(p.olhoD_int, p.olhoE_int, COR.forte, 1, true);
        if (sel) texto(m.texto, { x:p.olhoE_ext.x + 10 * u, y:p.olhoE_ext.y - 8 * u });
        break; }
      case 'malar': {
        const xL = Math.min(p.zigD.x, p.olhoD_ext.x) - 20 * u, xR = Math.max(p.zigE.x, p.olhoE_ext.x) + 20 * u;
        const yPup = (p.pupilaD.y + p.pupilaE.y) / 2, yZig = (p.zigD.y + p.zigE.y) / 2;
        linha({ x:xL, y:yPup }, { x:xR, y:yPup }, COR.forte, 1, true);
        linha({ x:xL, y:p.labioSup.y }, { x:xR, y:p.labioSup.y }, COR.forte, 1, true);
        linha({ x:p.zigD.x, y:yZig }, { x:p.zigE.x, y:yZig }, c, forte);
        ponto(p.zigD, c, 4); ponto(p.zigE, c, 4);
        if (sel){ texto('pupilas', { x:xL, y:yPup - 6 * u }); texto('lábio superior', { x:xL, y:p.labioSup.y - 6 * u }); texto(m.texto, { x:p.zigE.x + 8 * u, y:yZig + 4 * u }); }
        break; }
      case 'tercos': {
        const w = dist(p.zigD, p.zigE) * 0.35;
        [p.subnasal, p.estomio, p.mento].forEach(q => linha({ x:q.x - w, y:q.y }, { x:q.x + w, y:q.y }, c, forte));
        if (sel){ texto('1', { x:p.subnasal.x + w + 8 * u, y:(p.subnasal.y + p.estomio.y) / 2 + 4 * u }); texto(fmt(m.valor, 2), { x:p.subnasal.x + w + 8 * u, y:(p.estomio.y + p.mento.y) / 2 + 4 * u }); }
        break; }
      case 'mandibula': {
        linha(p.zigD, p.zigE, COR.forte, 1, true); linha(p.gonD, p.gonE, c, forte);
        [p.zigD, p.zigE, p.gonD, p.gonE].forEach(q => ponto(q, c));
        break; }
      case 'escleral': {
        if (p.irisD_inf){ [['irisD_inf','palpD_inf'], ['irisE_inf','palpE_inf']].forEach(([i, l]) => { linha({ x:p[i].x - 8 * u, y:p[i].y }, { x:p[i].x + 8 * u, y:p[i].y }, COR.forte, 1); ponto(p[l], c, 3); }); }
        break; }
      case 'simetria': {
        if (d.lm){ const a = estender(d.lm[152], d.lm[168], 1.35), b = estender(d.lm[168], d.lm[152], 1.1); linha(a, b, c, forte, true); }
        break; }
    }
  });
  if (A.mapa) desenharMapa(cx, d, A.vista, u, texto);
  // Grade de terços e quintos (frente)
  if (A.grade && A.vista === 'frente' && p.zigD){
    const topo = d.lm ? d.lm[10] : { x:p.glabela.x, y:p.glabela.y - (p.subnasal.y - p.glabela.y) };
    // O trichion (linha do cabelo) não é detectado com segurança: os terços médio e inferior
    // são comparados entre si (ideal 1 : 1); o superior fica como referência a conferir.
    const ys = [topo.y, p.glabela.y, p.subnasal.y, p.mento.y], alt = ys[3] - ys[1];
    const x0 = Math.min(p.zigD.x, p.zigE.x) - 18 * u, x1 = Math.max(p.zigD.x, p.zigE.x) + 18 * u;
    ys.forEach((y, i) => linha({ x:x0, y }, { x:x1, y }, i ? COR.forte : COR.linha, 1, true));
    texto('Superior: confira a linha do cabelo', { x:x0, y:ys[0] - 6 * u }, COR.linha);
    [['Médio', 1], ['Inferior', 2]].forEach(([n, i]) => {
      const pc = (ys[i + 1] - ys[i]) / alt * 100, c = Math.abs(pc - 50) <= 3 ? COR.bom : Math.abs(pc - 50) <= 6 ? COR.linha : COR.ruim;
      texto(`${n} ${fmt(pc, 0)}%`, { x:x1 + 6 * u, y:(ys[i] + ys[i + 1]) / 2 + 4 * u }, c, 'right');
    });
    const xs = [p.zigD, p.olhoD_ext, p.olhoD_int, p.olhoE_int, p.olhoE_ext, p.zigE].map(q => q.x).sort((a, b) => a - b), larg = xs[5] - xs[0];
    xs.forEach(x => linha({ x, y:ys[0] }, { x, y:ys[3] + 12 * u }, COR.linha, 1, true));
    for (let i = 0; i < 5; i++){
      const pc = (xs[i + 1] - xs[i]) / larg * 100, c = Math.abs(pc - 20) <= 2.5 ? COR.bom : Math.abs(pc - 20) <= 5 ? COR.linha : COR.ruim;
      texto(`${fmt(pc, 0)}%`, { x:(xs[i] + xs[i + 1]) / 2 - 10 * u, y:ys[3] + 28 * u }, c);
    }
  }
  // Desenho livre do profissional
  (A.desenhos[A.vista] || []).concat(A.traco && A.traco.vista === A.vista ? [A.traco] : []).forEach(t => {
    if (t.pts.length < 2) return;
    cx.beginPath(); cx.strokeStyle = t.cor; cx.lineWidth = 3 * u; cx.lineCap = 'round'; cx.lineJoin = 'round';
    cx.moveTo(t.pts[0].x, t.pts[0].y); t.pts.slice(1).forEach(q => cx.lineTo(q.x, q.y)); cx.stroke();
  });
  // Pontos arrastáveis
  if (A.ajustando){
    Object.entries(d.pts).forEach(([n, q]) => {
      if (n.startsWith('iris') || n.startsWith('palp') || n.startsWith('pupila') || n.startsWith('malar')) return;
      cx.beginPath(); cx.fillStyle = d.estimados.has(n) ? 'rgba(224,128,110,.9)' : 'rgba(206,183,142,.95)';
      cx.strokeStyle = '#0a1310'; cx.lineWidth = 1.5 * u; cx.arc(q.x, q.y, 7 * u, 0, Math.PI * 2); cx.fill(); cx.stroke();
    });
  }
}
function pedirDesenho(){ if (!A.renderPendente){ A.renderPendente = true; requestAnimationFrame(desenhar); } emitirSync(); }

/* ---------- Interface ---------- */
const ESTILO = `
#tela-analise{max-width:760px;margin:0 auto;padding-block:max(20px,env(safe-area-inset-top)) max(40px,env(safe-area-inset-bottom));padding-left:max(16px,env(safe-area-inset-left));padding-right:max(16px,env(safe-area-inset-right));display:grid;gap:18px}
#tela-analise .dfa-topo{display:flex;align-items:center;gap:12px}
#tela-analise .dfa-voltar{border:1px solid var(--linha);background:var(--cartao);border-radius:999px;padding:8px 14px;font-weight:700}
#tela-analise h1{font-family:var(--f-display);font-weight:400;font-size:clamp(26px,5vw,34px);margin:0;line-height:1.1}
#tela-analise .dfa-sub{color:var(--fg2);font-size:14px;margin:4px 0 0}
.dfa-abas{display:flex;gap:6px;border-bottom:1px solid var(--linha)}
.dfa-aba{border:0;background:none;padding:10px 14px;font-weight:700;color:var(--fg2);border-bottom:2px solid transparent;margin-bottom:-1px}
.dfa-aba[aria-selected="true"]{color:var(--fg);border-bottom-color:var(--acento)}
.dfa-foto{position:relative;border-radius:10px;overflow:hidden;background:#0a1310;touch-action:none}
#dfa-canvas{display:block;width:100%}
.dfa-vazio{padding:40px 20px;text-align:center;color:#f9f5ed;display:grid;gap:12px;justify-items:center}
.dfa-vazio label{border:1px solid #ceb78e;color:#ceb78e;border-radius:999px;padding:10px 18px;font-weight:700;cursor:pointer}
.dfa-vazio input{display:none}
.dfa-harmonia{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.dfa-harmonia .n{font-family:var(--f-display);font-size:44px;line-height:1}
.dfa-harmonia .n small{font-size:18px;color:var(--fg2)}
.dfa-harmonia .t{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--fg2);font-weight:700}
.dfa-ferr{display:flex;flex-wrap:wrap;gap:8px}
.dfa-btn{border:1px solid var(--linha);background:var(--cartao);border-radius:999px;padding:9px 14px;font-weight:700;font-size:13px}
.dfa-btn[aria-pressed="true"]{background:var(--botao-bg);color:var(--botao-fg);border-color:var(--botao-bg)}
.dfa-lista{display:grid;gap:10px}
.dfa-m{border:1px solid var(--linha);background:var(--cartao);border-radius:10px;padding:14px;display:grid;gap:8px;cursor:pointer;text-align:left}
.dfa-m[aria-expanded="true"]{border-color:var(--acento);box-shadow:inset 0 0 0 1px var(--acento)}
.dfa-m .l1{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.dfa-m .nome{font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--fg2)}
.dfa-m .nota{font-family:var(--f-num);font-size:13px;font-variant-numeric:tabular-nums}
.dfa-m .l2{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.dfa-m .val{font-family:var(--f-display);font-size:26px;line-height:1.1}
.dfa-m .rot{font-style:italic;font-size:14px}
.dfa-barra{position:relative;height:6px;border-radius:3px;background:color-mix(in srgb,var(--fg) 10%,transparent);margin-top:2px}
.dfa-barra .ideal{position:absolute;top:0;bottom:0;border-radius:3px;background:color-mix(in srgb,var(--ok) 35%,transparent)}
.dfa-barra .marca{position:absolute;top:50%;width:14px;height:14px;border-radius:50%;transform:translate(-50%,-50%);background:var(--cartao);border:2px solid var(--fg)}
.dfa-lados{display:flex;justify-content:space-between;font-size:11px;color:var(--fg2);font-style:italic}
.dfa-det{display:grid;gap:6px;font-size:14px;color:var(--fg2);border-top:1px solid var(--linha);padding-top:10px}
.dfa-det p{margin:0}
.dfa-det strong{color:var(--fg)}
.dfa-det .ref{font-size:12px;font-style:italic}
.dfa-aviso{font-size:13px;color:var(--alerta);font-weight:600}
.dfa-sim{border:1px solid var(--linha);background:var(--cartao);border-radius:10px;padding:16px;display:grid;gap:14px}
.dfa-sim h2{font-family:var(--f-display);font-weight:400;font-size:22px;margin:0}
.dfa-sim .linha{display:grid;gap:6px}
.dfa-sim label{display:flex;justify-content:space-between;font-weight:600;font-size:14px}
.dfa-sim input[type=range]{width:100%;accent-color:var(--acento)}
.dfa-sim select{width:100%;padding:10px;border-radius:8px;border:1px solid var(--linha);background:var(--cartao);color:var(--fg);font:inherit}
.dfa-grupo{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg2);margin:6px 0 0;font-weight:700}
.dfa-sim .acoes{display:flex;flex-wrap:wrap;gap:8px}
.dfa-chip{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:999px;margin-left:6px;vertical-align:middle}
.dfa-chip.retirar{background:color-mix(in srgb,var(--erro) 18%,transparent);color:var(--erro)}
.dfa-chip.repor{background:color-mix(in srgb,var(--ok) 18%,transparent);color:var(--ok)}
.dfa-chip.projetar{background:color-mix(in srgb,var(--acento) 22%,transparent);color:var(--fg)}
.dfa-chip.suavizar{background:color-mix(in srgb,var(--alerta) 18%,transparent);color:var(--alerta)}
.dfa-cores{display:flex;gap:6px;align-items:center}
.dfa-cor{width:28px;height:28px;border-radius:50%;border:2px solid var(--linha)}
.dfa-cor[aria-pressed="true"]{border-color:var(--fg);box-shadow:0 0 0 2px var(--cartao) inset}
.dfa-m .val .seta{color:var(--fg2);font-size:18px;margin:0 4px}
.dfa-nota-legal{font-size:12px;color:var(--fg2);margin:0}
.c-bom{color:var(--ok)} .c-medio{color:var(--alerta)} .c-ruim{color:var(--erro)}
`;

function montarTela(){
  if ($('#tela-analise')) return;
  const st = document.createElement('style'); st.textContent = ESTILO; document.head.append(st);
  const s = document.createElement('main'); s.id = 'tela-analise'; s.hidden = true;
  s.innerHTML = `
    <div class="dfa-topo"><button class="dfa-voltar" id="dfa-voltar">← Voltar</button></div>
    <header><h1 id="dfa-titulo">Kaptora · Análise</h1><p class="dfa-sub" id="dfa-sub"></p></header>
    <div class="dfa-abas" role="tablist">
      <button class="dfa-aba" role="tab" id="dfa-aba-frente" data-v="frente" aria-selected="true">Frente</button>
      <button class="dfa-aba" role="tab" id="dfa-aba-perfil" data-v="perfil" aria-selected="false">Perfil</button>
    </div>
    <div class="dfa-foto" id="dfa-foto"><canvas id="dfa-canvas"></canvas><div class="dfa-vazio" id="dfa-vazio" hidden></div></div>
    <div class="dfa-ferr">
      <button class="dfa-btn" id="dfa-ajustar" aria-pressed="false">Ajustar pontos</button>
      <button class="dfa-btn" id="dfa-antes" aria-pressed="false">Segure para ver o antes</button>
      <button class="dfa-btn" id="dfa-todas">Mostrar todas as linhas</button>
      <button class="dfa-btn" id="dfa-mapa" aria-pressed="false">Mapa Drawn Face</button>
      <button class="dfa-btn" id="dfa-grade" aria-pressed="false">Terços e quintos</button>
      <button class="dfa-btn" id="dfa-desenhar" aria-pressed="false">Desenho livre</button>
      <span class="dfa-cores" id="dfa-cores" hidden>
        <button class="dfa-cor" data-cor="#ceb78e" style="background:#ceb78e" aria-label="Dourado" aria-pressed="true"></button>
        <button class="dfa-cor" data-cor="#4fb3a9" style="background:#4fb3a9" aria-label="Verde-água" aria-pressed="false"></button>
        <button class="dfa-cor" data-cor="#e0806e" style="background:#e0806e" aria-label="Vermelho" aria-pressed="false"></button>
        <button class="dfa-btn" id="dfa-apagar">Apagar desenho</button>
      </span>
      <button class="dfa-btn" id="dfa-trocar">Trocar foto</button>
      <input type="file" id="dfa-arquivo" accept="image/*" hidden>
    </div>
    <div class="dfa-harmonia"><span class="t">Harmonia</span><span class="n" id="dfa-harm">—</span><span class="dfa-sub" id="dfa-harm-txt"></span></div>
    <div class="dfa-lista" id="dfa-lista"></div>
    <section class="dfa-sim" id="dfa-sim"></section>
    <p class="dfa-nota-legal">Análise de apoio à consulta. As medidas são estimadas a partir de foto 2D, com a íris como régua (11,7 mm), e devem ser conferidas pelo profissional. A simulação é ilustrativa e educativa: não é promessa de resultado.</p>
    <p class="dfa-nota-legal" id="dfa-rodape">Kaptora System · Produzido por Aurya Nexus Technologies</p>`;
  document.body.append(s);
  $('#dfa-voltar').onclick = () => { s.hidden = true; A.aoVoltar && A.aoVoltar(); };
  s.querySelectorAll('.dfa-aba').forEach(b => b.onclick = () => trocarVista(b.dataset.v));
  $('#dfa-ajustar').onclick = () => { A.ajustando = !A.ajustando; if (A.ajustando) A.desenhando = false; sincronizarBotoes(); pedirDesenho(); };
  $('#dfa-mapa').onclick = () => { A.mapa = !A.mapa; sincronizarBotoes(); pedirDesenho(); };
  $('#dfa-grade').onclick = () => { A.grade = !A.grade; sincronizarBotoes(); pedirDesenho(); };
  $('#dfa-desenhar').onclick = () => { A.desenhando = !A.desenhando; if (A.desenhando) A.ajustando = false; sincronizarBotoes(); pedirDesenho(); };
  s.querySelectorAll('.dfa-cor').forEach(b => b.onclick = () => { A.corTraco = b.dataset.cor; s.querySelectorAll('.dfa-cor').forEach(c => c.setAttribute('aria-pressed', String(c === b))); });
  $('#dfa-apagar').onclick = () => { A.desenhos[A.vista] = []; pedirDesenho(); };
  const antes = $('#dfa-antes');
  const on = e => { e.preventDefault(); A.antes = true; antes.setAttribute('aria-pressed', 'true'); pedirDesenho(); atualizarLista(); };
  const off = () => { if (!A.antes) return; A.antes = false; antes.setAttribute('aria-pressed', 'false'); pedirDesenho(); atualizarLista(); };
  antes.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => antes.addEventListener(ev, off));
  $('#dfa-todas').onclick = () => { A.sel = null; atualizarLista(); pedirDesenho(); };
  $('#dfa-trocar').onclick = () => $('#dfa-arquivo').click();
  $('#dfa-arquivo').onchange = async e => { const f = e.target.files[0]; if (f){ await usarArquivo(A.vista, f); } e.target.value = ''; };
  // Arrastar pontos
  const cv = $('#dfa-canvas');
  const posFoto = ev => { const r = cv.getBoundingClientRect(), d = A.dados[A.vista]; const k = r.width / d.W; return { x:(ev.clientX - r.left) / k, y:(ev.clientY - r.top) / k, k }; };
  cv.addEventListener('pointerdown', ev => {
    if (A.desenhando && A.dados[A.vista]){
      const q = posFoto(ev); A.traco = { vista:A.vista, cor:A.corTraco, pts:[{ x:q.x, y:q.y }] };
      cv.setPointerCapture(ev.pointerId); ev.preventDefault(); return;
    }
    if (!A.ajustando) return; const d = A.dados[A.vista]; if (!d || !d.pts) return;
    const q = posFoto(ev); let melhor = null, md = 22 / q.k;
    Object.entries(d.pts).forEach(([n, p]) => { if (/^(iris|palp|pupila|malar)/.test(n)) return; const dd = Math.hypot(p.x - q.x, p.y - q.y); if (dd < md){ md = dd; melhor = n; } });
    if (melhor){ A.arrastando = melhor; cv.setPointerCapture(ev.pointerId); ev.preventDefault(); }
  });
  cv.addEventListener('pointermove', ev => {
    if (A.traco){ const q = posFoto(ev); A.traco.pts.push({ x:q.x, y:q.y }); pedirDesenho(); return; }
    if (!A.arrastando) return; const d = A.dados[A.vista], q = posFoto(ev);
    d.pts[A.arrastando] = { x:Math.max(0, Math.min(d.W, q.x)), y:Math.max(0, Math.min(d.H, q.y)) };
    d.estimados.delete(A.arrastando); pedirDesenho(); atualizarLista();
  });
  const solta = () => {
    A.arrastando = null;
    if (A.traco){ if (A.traco.pts.length > 1) A.desenhos[A.traco.vista].push(A.traco); A.traco = null; pedirDesenho(); }
  };
  cv.addEventListener('pointerup', solta); cv.addEventListener('pointercancel', solta);
  window.addEventListener('resize', () => { if (!s.hidden) pedirDesenho(); });
}

function sincronizarBotoes(){
  $('#dfa-ajustar').setAttribute('aria-pressed', String(A.ajustando));
  $('#dfa-grade').setAttribute('aria-pressed', String(A.grade));
  $('#dfa-mapa').setAttribute('aria-pressed', String(A.mapa));
  $('#dfa-grade').hidden = A.vista !== 'frente';
  $('#dfa-desenhar').setAttribute('aria-pressed', String(A.desenhando));
  $('#dfa-cores').hidden = !A.desenhando;
}

function trocarVista(v){
  A.vista = v; A.sel = null;
  document.querySelectorAll('.dfa-aba').forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === v)));
  renderTudo();
}

async function usarArquivo(vista, arquivo){
  $('#dfa-sub').textContent = 'Lendo os pontos do rosto…';
  await carregarFoto(vista, arquivo);
  renderTudo();
}

function renderVazio(){
  const d = A.dados[A.vista], vazio = $('#dfa-vazio'), cv = $('#dfa-canvas');
  vazio.hidden = !!d; cv.hidden = !d;
  if (!d){
    const v = A.vista === 'frente' ? 'de frente' : 'de perfil';
    vazio.innerHTML = `<p>Sem foto ${v} nesta sessão.</p><label>Escolher foto ${v}<input type="file" accept="image/*" id="dfa-arquivo-vazio"></label>`;
    $('#dfa-arquivo-vazio').onchange = e => { const f = e.target.files[0]; if (f) usarArquivo(A.vista, f); };
  }
}

function classeNota(n){ return n >= 7 ? 'c-bom' : n >= 4 ? 'c-medio' : 'c-ruim'; }

function medidasAntes(v){ const a = A.antes; A.antes = true; try { return medidas(v); } finally { A.antes = a; } }
const harmoniaDe = ms => { const ok = ms.filter(m => !m.estimado); return ok.length ? ok.reduce((t, m) => t + m.nota, 0) / ok.length : null; };

function atualizarLista(){
  const lista = $('#dfa-lista'), d = A.dados[A.vista];
  const ms = d ? medidas(A.vista) : [];
  const plano = d && d.pts && !A.antes && simAtiva();
  const base = plano ? Object.fromEntries(medidasAntes(A.vista).map(m => [m.id, m])) : {};
  // Harmonia: média das duas vistas disponíveis
  const todas = ['frente', 'perfil'].flatMap(v => A.dados[v] ? medidas(v) : []).filter(m => !m.estimado);
  const h = todas.length ? todas.reduce((s, m) => s + m.nota, 0) / todas.length : null;
  const algumPlano = !A.antes && simAtiva();
  const h0 = algumPlano ? harmoniaDe(['frente', 'perfil'].flatMap(v => A.dados[v] ? medidasAntes(v) : [])) : null;
  $('#dfa-harm').innerHTML = h == null ? '—' : (h0 != null && Math.abs(h0 - h) >= 0.05 ? `${fmt(h0)}<small> → </small>` : '') + `${fmt(h)}<small> / 10</small>`;
  $('#dfa-harm-txt').textContent = h == null ? '' : `média de ${todas.length} medidas${A.antes ? ' · antes do planejamento' : algumPlano ? ' · atual → planejada' : ''}`;
  const sub = $('#dfa-sub');
  sub.textContent = !d ? 'Escolha uma foto para começar.' : d.ok ? `${A.paciente ? A.paciente + ' · ' : ''}${ms.length} medidas nesta foto. Toque em uma medida para ver a linha e a explicação.`
    : 'Não encontrei o rosto automaticamente. Toque em “Ajustar pontos” e posicione cada ponto na foto.';
  lista.innerHTML = '';
  ms.forEach(m => {
    const t = TEXTOS[m.id], aberto = A.sel === m.id;
    const pos = v => Math.max(0, Math.min(100, (v - m.barra.min) / (m.barra.max - m.barra.min) * 100));
    const b = document.createElement('button'); b.className = 'dfa-m'; b.setAttribute('aria-expanded', String(aberto));
    b.innerHTML = `
      <div class="l1"><span class="nome"></span><span class="nota ${classeNota(m.nota)}">${m.estimado ? 'ajuste os pontos' : fmt(m.nota) + ' / 10'}</span></div>
      <div class="l2"><span class="val"></span><span class="rot ${classeNota(m.nota)}"></span></div>
      <div class="dfa-barra"><span class="ideal" style="left:${pos(m.barra.a)}%;width:${pos(m.barra.b) - pos(m.barra.a)}%"></span><span class="marca" style="left:${pos(m.valor)}%"></span></div>
      <div class="dfa-lados"><span>${m.barra.ladoMin}</span><span>${m.barra.ladoMax}</span></div>`;
    b.querySelector('.nome').textContent = t.nome; b.querySelector('.rot').textContent = m.rotulo;
    const m0 = base[m.id], val = b.querySelector('.val');
    if (m0 && m0.texto !== m.texto){ val.textContent = m0.texto; const seta = document.createElement('span'); seta.className = 'seta'; seta.textContent = '→'; val.append(seta, document.createTextNode(m.texto)); }
    else val.textContent = m.texto;
    if (aberto){
      const det = document.createElement('div'); det.className = 'dfa-det';
      det.innerHTML = `${m.estimado && t.manual ? `<p class="dfa-aviso"></p>` : ''}<p></p><p></p><p><strong>${metodoDF() ? 'Caminho Drawn Face' : 'Caminho sugerido'}: </strong><span></span></p><p class="ref"></p>`;
      const ps = det.querySelectorAll('p'); let i = 0;
      if (m.estimado && t.manual) ps[i++].textContent = t.manual;
      ps[i++].textContent = t.sobre; ps[i++].textContent = t.leitura; ps[i++].querySelector('span').textContent = t.caminho; ps[i].textContent = 'Referência: ' + t.ref;
      b.append(det);
    }
    b.onclick = () => { A.sel = aberto ? null : m.id; atualizarLista(); pedirDesenho(); };
    lista.append(b);
  });
}

const valorTxt = (r, v) => r[6] === 'mm' ? `${fmt(v)} mm` : `${Math.round(v * 100)}%`;
function acoesDoPlano(){
  const out = [];
  ITENS.forEach(r => { const x = A.sim[r[0]]; if (x) out.push({ nome:r[1], acao:r[2], txt:`${ACAO[r[2]]} · ${valorTxt(r, x)}` }); });
  return out;
}

function montarSimulacao(){
  const box = $('#dfa-sim'), d = A.dados[A.vista];
  box.hidden = !d || !d.pts || !metodoDF();
  if (box.hidden) return;
  const s = A.sim;
  box.innerHTML = `<h2>Planejamento</h2>
    <div class="linha"><label for="dfa-tecnica"><span>Modelo de técnica</span></label>
      <select id="dfa-tecnica"><option value="">Personalizado</option>${Object.keys(TECNICAS).map(() => `<option></option>`).join('')}</select></div>`;
  const sel = box.querySelector('select');
  Object.keys(TECNICAS).forEach((t, i) => { const o = sel.options[i + 1]; o.value = t; o.textContent = t; });
  sel.value = A.tecnica;
  sel.onchange = () => {
    A.tecnica = sel.value;
    if (A.tecnica) Object.assign(A.sim, TECNICAS[A.tecnica]);
    montarSimulacao(); pedirDesenho(); atualizarLista();
  };
  GRUPOS.forEach(g => {
    const h = document.createElement('h3'); h.className = 'dfa-grupo'; h.textContent = g.titulo; box.append(h);
    g.itens.forEach(r => {
      const [k, nome, acao, min, max, passo] = r;
      const l = document.createElement('div'); l.className = 'linha';
      l.innerHTML = `<label for="dfa-s-${k}"><span><span class="n"></span><span class="dfa-chip ${acao}"></span></span><span class="v"></span></label><input type="range" id="dfa-s-${k}" min="${min}" max="${max}" step="${passo}" value="${s[k]}">`;
      l.querySelector('.n').textContent = nome; l.querySelector('.dfa-chip').textContent = ACAO[acao]; l.querySelector('.v').textContent = valorTxt(r, s[k]);
      l.querySelector('input').oninput = e => {
        s[k] = parseFloat(e.target.value); l.querySelector('.v').textContent = valorTxt(r, s[k]);
        if (A.tecnica){ A.tecnica = ''; sel.value = ''; }
        pedirDesenho(); atualizarLista();
      };
      box.append(l);
    });
  });
  const acoes = document.createElement('div'); acoes.className = 'acoes';
  const zerar = document.createElement('button'); zerar.className = 'dfa-btn'; zerar.textContent = 'Zerar planejamento';
  zerar.onclick = () => { A.sim = SIM_VAZIO(); A.tecnica = ''; montarSimulacao(); pedirDesenho(); atualizarLista(); };
  const baixar = document.createElement('button'); baixar.className = 'dfa-btn'; baixar.textContent = 'Baixar plano (imagem)';
  baixar.onclick = baixarPlano;
  acoes.append(zerar, baixar); box.append(acoes);
}

// Exporta: antes | planejado (com as linhas e o desenho como estão na tela) + lista de ações e medidas
async function baixarPlano(){
  const d = A.dados[A.vista], cv = $('#dfa-canvas'); if (!d) return;
  A.antes = false; desenhar();
  const W = d.W, H = d.H, gap = Math.round(W * 0.02), pad = Math.round(W * 0.04), fs = Math.max(14, Math.round(W * 0.028));
  const acoes = acoesDoPlano();
  const ms = medidas(A.vista), base = Object.fromEntries(medidasAntes(A.vista).map(m => [m.id, m]));
  const linhas = [
    ...acoes.map(a => `${a.nome}: ${a.txt}`),
    ...ms.filter(m => base[m.id] && base[m.id].texto !== m.texto).map(m => `${TEXTOS[m.id].nome}: ${base[m.id].texto} → ${m.texto}`)
  ];
  const altTxt = pad * 2 + fs * 1.6 * (linhas.length + 2) + fs * 2;
  const out = document.createElement('canvas'); out.width = W * 2 + gap; out.height = Math.round(H + altTxt);
  const c = out.getContext('2d');
  c.fillStyle = '#121614'; c.fillRect(0, 0, out.width, out.height);
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; tmp.getContext('2d').putImageData(d.original, 0, 0);
  c.drawImage(tmp, 0, 0); c.drawImage(cv, W + gap, 0, W, H);
  c.font = `700 ${fs}px Manrope, system-ui, sans-serif`; c.fillStyle = '#f9f5ed';
  const rot = (t, x) => { c.lineWidth = fs * 0.25; c.strokeStyle = 'rgba(10,19,16,.7)'; c.strokeText(t, x, pad + fs); c.fillText(t, x, pad + fs); };
  rot('ANTES', pad); rot('PLANEJADO', W + gap + pad);
  let y = H + pad + fs;
  c.fillStyle = '#ceb78e'; c.fillText(`${marca().produto}${metodoDF() ? ' · Plano Drawn Face' : ' · Plano'}${A.paciente ? ' · ' + A.paciente : ''}${A.tecnica ? ' · ' + A.tecnica : ''}`, pad, y); y += fs * 1.8;
  c.font = `500 ${fs}px Manrope, system-ui, sans-serif`; c.fillStyle = '#f9f5ed';
  (linhas.length ? linhas : ['Nenhuma ação planejada nesta vista.']).forEach(t => { c.fillText(t, pad, y); y += fs * 1.6; });
  c.font = `italic 500 ${Math.round(fs * 0.75)}px Manrope, system-ui, sans-serif`; c.fillStyle = 'rgba(249,245,237,.7)';
  c.fillText(`Simulação ilustrativa e educativa, não é promessa de resultado. ${new Date().toLocaleDateString('pt-BR')} · Produzido por Aurya Nexus Technologies`, pad, y + fs * 0.4);
  const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.92));
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `plano-df-${A.vista}-${(A.paciente || 'paciente').replace(/[^\wÀ-ú-]+/g, '_')}.jpg`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  A.ultimoPlano = blob;
}

function renderTudo(){ renderVazio(); sincronizarBotoes(); atualizarLista(); montarSimulacao(); pedirDesenho(); }

/* ---------- Entrada pública ---------- */
export async function abrirAnalise({ frente, perfil, paciente, config, marca:M, mostrar, aoVoltar }){
  A.config = config; A.mostrar = mostrar; A.aoVoltar = aoVoltar; A.paciente = paciente || '';
  A.marca = M || window.MARCA || null;
  montarTela();
  // Marca do cliente (white label)
  $('#dfa-titulo').textContent = `${marca().produto} · Análise`;
  $('#dfa-rodape').textContent = window.MARCA_rodape ? window.MARCA_rodape(marca()) : marca().produto;
  $('#dfa-mapa').hidden = !metodoDF();
  mostrar && mostrar('analise');
  $('#tela-analise').hidden = false; window.scrollTo(0, 0);
  A.dados = { frente:null, perfil:null }; A.sim = SIM_VAZIO(); A.tecnica = ''; A.sel = null; A.ajustando = false;
  A.grade = false; A.mapa = false; A.desenhando = false; A.desenhos = { frente:[], perfil:[] }; A.traco = null;
  sincronizarBotoes();
  A.vista = frente || !perfil ? 'frente' : 'perfil';
  document.querySelectorAll('.dfa-aba').forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === A.vista)));
  $('#dfa-sub').textContent = 'Lendo os pontos do rosto…';
  renderVazio();
  try {
    if (frente) await carregarFoto('frente', frente);
    if (perfil) await carregarFoto('perfil', perfil);
  } catch(e){ console.error(e); }
  renderTudo();
  // A abertura não manda o plano vazio para o outro aparelho: só o que a pessoa mudar daqui em diante
  clearTimeout(syncTimer); syncJson = JSON.stringify(estadoSync());
}

// Exposto para testes de calibração
/* ---------- Sincronização entre aparelhos (celular ⇄ tablet) ----------
   Tudo o que muda o planejamento é enviado ao outro aparelho, que aplica sem reenviar. */
let syncFn = null, syncTimer = null, syncUltimo = 0, syncJson = '';
const copia = o => o == null ? o : JSON.parse(JSON.stringify(o));
function estadoSync(){
  return { sim:A.sim, tecnica:A.tecnica, mapa:A.mapa, grade:A.grade, vista:A.vista, sel:A.sel, antes:A.antes,
    desenhos:A.desenhos, traco:A.traco, pts:{ frente:A.dados.frente && A.dados.frente.pts, perfil:A.dados.perfil && A.dados.perfil.pts } };
}
function emitirSync(){
  if (!syncFn || A.aplicando || !analiseAberta()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    if (A.aplicando) return;
    const j = JSON.stringify(estadoSync()); if (j === syncJson) return;
    syncJson = j; syncUltimo = performance.now(); syncFn({ t:'plano', e:JSON.parse(j) });
  }, Math.max(0, 80 - (performance.now() - syncUltimo)));
}
export function analiseAberta(){ const t = document.querySelector('#tela-analise'); return !!(t && !t.hidden); }
export function conectarSync(fn){ syncFn = fn; syncJson = ''; }
export function estadoAtual(){ return copia(estadoSync()); }
export function aplicarPlano(e){
  if (!e || !analiseAberta()) return;
  A.aplicando = true;
  try {
    const mudouPainel = JSON.stringify(e.sim) !== JSON.stringify(A.sim) || e.tecnica !== A.tecnica;
    Object.assign(A.sim, e.sim || {}); A.tecnica = e.tecnica || '';
    A.mapa = !!e.mapa; A.grade = !!e.grade; A.antes = !!e.antes; A.sel = e.sel || null;
    A.desenhos = copia(e.desenhos) || { frente:[], perfil:[] }; A.traco = copia(e.traco) || null;
    ['frente', 'perfil'].forEach(v => { if (e.pts && e.pts[v] && A.dados[v] && A.dados[v].pts) A.dados[v].pts = copia(e.pts[v]); });
    const antes = $('#dfa-antes'); if (antes) antes.setAttribute('aria-pressed', String(A.antes));
    if (e.vista && e.vista !== A.vista){
      A.vista = e.vista;
      document.querySelectorAll('.dfa-aba').forEach(b => b.setAttribute('aria-selected', String(b.dataset.v === A.vista)));
      renderVazio(); sincronizarBotoes(); atualizarLista(); montarSimulacao();
    } else {
      sincronizarBotoes(); atualizarLista(); if (mudouPainel) montarSimulacao();
    }
    desenhar();
  } finally { A.aplicando = false; }
  syncJson = JSON.stringify(estadoSync());
}

export const __teste = { A, medidas, montarPontos, carregarFoto, baixarPlano, TECNICAS };
