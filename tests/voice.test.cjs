const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
function setup(){
  const timers = new Map(); let n = 0;
  const elements = new Map();
  const player = {paused:true, error:null, preload:'', pause(){this.paused=true}, load(){}, removeAttribute(){}, play(){this.paused=false; return Promise.resolve()}};
  const spoken = [], ended = [];
  const ctx = {
    Audio:function(){return player}, SpeechSynthesisUtterance:function(text){this.text=text},
    S:{voz:true,conversa:true,rodando:true,atual:0,fotos:[]}, CONFIG:{agenteVick:'test-agent'},
    VISTAS:[{n:1,nome:'Frontal',fala:'Olhe para a câmera.',dica:'Dica'}],
    performance:{now:()=>0}, console:{warn(){},error(){}}, navigator:{mediaDevices:{getUserMedia(){}}},
    setTimeout(fn,ms){const id=++n;timers.set(id,{fn,ms});return id},clearTimeout(id){timers.delete(id)},
    $:id=>{if(!elements.has(id))elements.set(id,{classList:{toggle(){}}});return elements.get(id)},
    speechSynthesis:{getVoices:()=>[],speak:u=>spoken.push(u),cancel(){}},
    espera:()=>Promise.resolve(), document:{},
  };
  ctx.window=ctx;ctx.isSecureContext=true;
  ctx.ElevenLabsClient={Conversation:{startSession:async options=>{
    ctx.options=options; options.onConnect();return {endSession(){ended.push(true)},sendUserMessage(){},sendContextualUpdate(){}};
  }}};
  vm.createContext(ctx);
  vm.runInContext(html.slice(html.indexOf('let vozPt ='), html.indexOf('function bip()'))+'\nthis.api={falar,pararVoz,VICK,SEM_AUDIO};',ctx);
  return {ctx,player,spoken,ended,timers,api:ctx.api, fire(ms){for(const [id,t] of [...timers]) if(t.ms===ms){timers.delete(id);t.fn()}}};
}
test('missing MP3 falls back once, caches invalid media, and drains queue after synthesis ends',()=>{
  const t=setup();t.api.falar('Olhe para a câmera.');t.api.falar('Dica');
  t.player.error={code:4};t.player.onerror();
  assert.equal(t.spoken.length,1);assert.equal(t.api.SEM_AUDIO.has('vista-1-fala'),true);
  t.spoken[0].onend();t.player.onerror();assert.equal(t.spoken.length,2);
});
test('autoplay rejection uses synthesis without marking MP3 absent',async()=>{
  const t=setup();t.player.play=()=>Promise.reject({name:'NotAllowedError'});
  t.api.falar('Olhe para a câmera.');await new Promise(setImmediate);
  assert.equal(t.spoken.length,1);assert.equal(t.api.SEM_AUDIO.size,0);
});
test('loading timeout recovers; late play rejection cannot duplicate speech',async()=>{
  const t=setup();let reject;t.player.play=()=>new Promise((_,r)=>reject=r);
  t.api.falar('Olhe para a câmera.');t.fire(4000);reject(new Error());await Promise.resolve();
  assert.equal(t.spoken.length,1);assert.equal(t.api.SEM_AUDIO.size,0);
});
test('muting invalidates queued audio and pending playback callbacks',async()=>{
  const t=setup();let reject;t.player.play=()=>new Promise((_,r)=>reject=r);
  t.api.falar('Olhe para a câmera.');t.api.falar('Dica');
  t.ctx.S.voz=false;t.api.pararVoz();t.api.VICK.encerrar();reject(new Error());await Promise.resolve();
  t.api.falar('Dica');assert.equal(t.spoken.length,0);assert.equal(t.timers.size,0);
});
test('disconnect resumes current guided instruction and ignores stale callbacks',async()=>{
  const t=setup();await t.api.VICK.iniciar();assert.equal(t.api.VICK.ativa,true);
  t.ctx.options.onDisconnect();assert.equal(t.api.VICK.ativa,false);assert.equal(t.ended.length,1);
  assert.equal(t.player.src,'./audio/vista-1-fala.mp3');
  t.ctx.options.onModeChange({mode:'speaking'});assert.equal(t.api.VICK.falandoAgora,false);
});
test('microphone denied falls back without preventing capture',async()=>{
  const t=setup();t.ctx.ElevenLabsClient.Conversation.startSession=async()=>{throw {name:'NotAllowedError'}};
  await t.api.VICK.iniciar();assert.equal(t.api.VICK.ativa,false);assert.equal(t.ctx.S.rodando,true);
  assert.equal(t.player.src,'./audio/vista-1-fala.mp3');
});
test('connection timeout closes late session instead of reactivating it',async()=>{
  const t=setup();let resolve;
  t.ctx.ElevenLabsClient.Conversation.startSession=()=>new Promise(r=>resolve=r);
  const pending=t.api.VICK.iniciar();await Promise.resolve();t.fire(12000);
  resolve({endSession(){t.ended.push(true)}});await pending;
  assert.equal(t.api.VICK.ativa,false);assert.equal(t.ended.length,1);
});
test('mute during connect closes late session',async()=>{
  const t=setup();let resolve;
  t.ctx.ElevenLabsClient.Conversation.startSession=()=>new Promise(r=>resolve=r);
  const pending=t.api.VICK.iniciar();await Promise.resolve();
  t.ctx.S.voz=false;t.api.pararVoz();t.api.VICK.encerrar();
  resolve({endSession(){t.ended.push(true)}});await pending;
  assert.equal(t.api.VICK.ativa,false);assert.equal(t.ended.length,1);assert.equal(t.spoken.length,0);
});
test('no agent or voice disabled never starts SDK',async()=>{
  const t=setup();let calls=0;t.ctx.ElevenLabsClient.Conversation.startSession=()=>calls++;
  t.ctx.CONFIG.agenteVick='';await t.api.VICK.iniciar();
  t.ctx.CONFIG.agenteVick='test';t.ctx.S.voz=false;await t.api.VICK.iniciar();assert.equal(calls,0);
});
test('SDK error and send failure both release conversation',async()=>{
  for(const fail of [t=>t.ctx.options.onError(),t=>{t.api.VICK.conv.sendUserMessage=()=>{throw Error()};t.api.VICK.enviar('estado')}]){
    const t=setup();await t.api.VICK.iniciar();fail(t);assert.equal(t.api.VICK.ativa,false);assert.equal(t.ended.length,1);
  }
});
test('no speech synthesis still leaves visual capture available',()=>{
  const t=setup();delete t.ctx.speechSynthesis;t.api.falar('texto sem MP3');assert.equal(t.ctx.S.rodando,true);
});
test('actual voice button cancels active conversation and resumes only guided voice',async()=>{
  const t=setup();await t.api.VICK.iniciar();
  const start=html.indexOf("$('#btn-voz').addEventListener");
  const end=html.indexOf("$('#trocar-camera')",start);
  let handler;t.ctx.$=()=>({addEventListener:(_,fn)=>handler=fn});
  // Keep status DOM available while capturing the event handler.
  vm.runInContext(html.slice(start,end),t.ctx);
  t.ctx.$=()=>({classList:{toggle(){}}});
  const attrs={};const event={currentTarget:{setAttribute:(k,v)=>attrs[k]=v}};
  handler(event);assert.equal(t.ctx.S.voz,false);assert.equal(t.ended.length,1);assert.equal(attrs['aria-pressed'],'false');
  handler(event);assert.equal(t.ctx.S.voz,true);assert.equal(t.api.VICK.ativa,false);
  assert.equal(t.player.src,'./audio/vista-1-fala.mp3');
});
test('duplicate connect calls share one in-flight attempt',async()=>{
  const t=setup();let calls=0,resolve;
  t.ctx.ElevenLabsClient.Conversation.startSession=()=>{calls++;return new Promise(r=>resolve=r)};
  const pending=t.api.VICK.iniciar();await Promise.resolve();await t.api.VICK.iniciar();
  assert.equal(calls,1);resolve({endSession(){}});await pending;
});
test('delayed goodbye cannot close replacement conversation',async()=>{
  const t=setup();await t.api.VICK.iniciar();t.api.VICK.encerrar(9000);
  const callback=[...t.timers.values()].find(t=>t.ms===9000).fn;
  t.api.VICK.encerrar();await t.api.VICK.iniciar();callback();assert.equal(t.api.VICK.ativa,true);
});
test('SDK failure and insecure context both preserve guided capture',async()=>{
  const t=setup();t.api.VICK.carregarSDK=async()=>{throw Error('missing SDK')};
  await t.api.VICK.iniciar();assert.equal(t.api.VICK.conectando,false);assert.equal(t.player.src,'./audio/vista-1-fala.mp3');
  t.ctx.isSecureContext=false;await t.api.VICK.iniciar();assert.equal(t.api.VICK.ativa,false);
});
