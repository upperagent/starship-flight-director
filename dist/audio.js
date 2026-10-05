/* Original procedural score and flight soundscape. No recordings or external audio assets.
   AudioContext is created only by init()/toggle() in a user gesture. */
(function(root){
'use strict';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(Number(v))?Number(v):a));
const now=()=>root.performance?.now?.()??Date.now();
const frequency=note=>440*Math.pow(2,(note-69)/12);
const THEMES={
 control:{bpm:76,chords:[[50,57,60,64],[46,53,57,60],[53,60,64,67],[48,55,60,62]],melody:[74,null,69,72,null,77,76,null,74,null,72,69,67,null,69,null],pulse:false},
 ascent:{bpm:108,chords:[[50,57,62,65],[46,53,58,62],[48,55,60,64],[50,57,60,65]],melody:[74,81,77,74,76,81,79,76,77,84,81,77,76,81,74,69],pulse:true},
 coast:{bpm:64,chords:[[46,53,60,65],[50,57,64,69],[43,50,57,62],[45,52,57,62]],melody:[77,null,null,81,79,null,74,null,72,null,77,null,76,null,69,null],pulse:false},
 recovery:{bpm:88,chords:[[50,57,60,65],[43,50,57,62],[46,53,60,65],[45,52,57,64]],melody:[74,null,77,81,79,77,74,null,72,76,79,null,77,74,69,null],pulse:true}
};
class FlightAudio{
 constructor(options={}){
  this.options=options;this.onCaption=options.onCaption||(()=>{});this.getContext=options.getContext||(()=>({}));this.onStateChange=options.onStateChange||(()=>{});
  this.settings={master:.55,music:.42,effects:.82,narration:.9,voice:true,musicEnabled:true,...options.settings};
  this.enabled=false;this.ctx=null;this.master=null;this.rumble=null;this.filter=null;this._active=false;this._unlocked=false;this._disposed=false;this._timer=null;this._speechQueue=[];this._speaking=null;this._speechGeneration=0;this._seen=new Map();this._voices=[];this._loopSources=[];this._oscillators=[];this._context={view:'pad',cameraTarget:'ship',rate:1};this._theme='control';this._step=0;this._nextStep=0;this._lastCue=new Map();this._lastState=null;this._explosionIds=new Set();this._explosionDuckUntil=0;this._explosionDucking=false;this._lastExplosionAt=-Infinity;this._explosions=[];
  this._onVisibility=()=>{if(root.document?.hidden)this.suspend();};root.document?.addEventListener('visibilitychange',this._onVisibility);this.setSettings(this.settings);
 }
 get volume(){return this.settings.master;}
 set volume(value){this.setVolume('master',value);}
 init(){
  if(this._disposed)return false;if(this.ctx)return true;
  if(root.navigator?.userActivation&&root.navigator.userActivation.isActive===false)return false;
  const AC=root.AudioContext||root.webkitAudioContext;if(!AC)return false;
  try{
   this.ctx=new AC({latencyHint:'interactive'});this._unlocked=true;const c=this.ctx;
   this.master=c.createGain();this.master.gain.value=0;const limiter=c.createDynamicsCompressor();limiter.threshold.value=-10;limiter.knee.value=16;limiter.ratio.value=5;limiter.attack.value=.006;limiter.release.value=.22;this.master.connect(limiter);limiter.connect(c.destination);this.limiter=limiter;
   this.musicBus=c.createGain();this.effectsBus=c.createGain();this.musicBus.connect(this.master);this.effectsBus.connect(this.master);
   this._brown=this._noiseBuffer('brown');this._white=this._noiseBuffer('white');
   this.engine=this._noiseLayer(this._brown,'lowpass',420);this.rumble=this.engine.gain;this.filter=this.engine.filter;
   this.engineGrain=this._noiseLayer(this._white,'bandpass',1100,.7);this.wind=this._noiseLayer(this._white,'lowpass',950);this.ocean=this._noiseLayer(this._brown,'lowpass',560);this.air=this._noiseLayer(this._white,'bandpass',2100,.9);this.radio=this._noiseLayer(this._white,'bandpass',1400,1.7);this.transient=this._noiseLayer(this._white,'lowpass',2000);
   this.sub=this._oscillator('sine',this.effectsBus,37);this.subGain=this.sub.gain;this.room=this._oscillator('sine',this.effectsBus,60);this.roomHarmonic=this._oscillator('sine',this.effectsBus,120);
   this._ui=Array.from({length:6},()=>this._oscillator('sine',this.effectsBus,440));
   this._pads=Array.from({length:4},(_,i)=>{const voice=this._oscillator(i%2?'sine':'triangle',this.musicBus,220,(i-1.5)*.36);voice.osc.detune.value=(i-1.5)*2.7;return voice;});this._melody=Array.from({length:4},(_,i)=>this._oscillator('sine',this.musicBus,440,(i%2?1:-1)*.15));this._bass=this._oscillator('triangle',this.musicBus,73);this._pulse=this._oscillator('triangle',this.musicBus,146);this._uiIndex=0;this._melodyIndex=0;
   this._initExplosions();this._nextStep=c.currentTime+.12;this._applyVolumes();return true;
  }catch(error){this.lastError=String(error?.message||error);this.ctx?.close?.().catch?.(()=>{});this.ctx=null;return false;}
 }
 _noiseBuffer(kind){
  const c=this.ctx,buffer=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=buffer.getChannelData(0);let brown=0,seed=kind==='brown'?97133:44191;
  for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;const white=seed/2147483648-1;if(kind==='brown'){brown=(brown+white*.021)/1.021;data[i]=brown*3.4;}else data[i]=white;}
  return buffer;
 }
 _noiseLayer(buffer,type,hz,q=.707){const c=this.ctx,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;source.loop=true;filter.type=type;filter.frequency.value=hz;filter.Q.value=q;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(this.effectsBus);source.start();this._loopSources.push(source);return{source,filter,gain};}
 _oscillator(type,bus,hz,pan=0){const c=this.ctx,osc=c.createOscillator(),gain=c.createGain();osc.type=type;osc.frequency.value=hz;gain.gain.value=0;osc.connect(gain);let panner;if(pan&&c.createStereoPanner){panner=c.createStereoPanner();panner.pan.value=pan;gain.connect(panner);panner.connect(bus);}else gain.connect(bus);osc.start();this._oscillators.push(osc);return{osc,gain,panner,busyUntil:0};}
 _target(param,value,seconds=.1){if(!this.ctx||!param)return;param.setTargetAtTime(value,this.ctx.currentTime,seconds);}
 _applyVolumes(){if(!this.ctx)return;this._target(this.master.gain,this.enabled?this.settings.master:0,.035);this._target(this.effectsBus.gain,this.settings.effects,.055);const duck=Math.min(this._speaking?.35:1,this.ctx.currentTime<this._explosionDuckUntil?.52:1);this._target(this.musicBus.gain,this.settings.musicEnabled?this.settings.music*duck:0,.2);}
 setSettings(values={}){
  const wasAudible=this.settings.master>0&&this.settings.effects>0;
  for(const key of ['master','music','effects','narration'])if(values[key]!=null)this.settings[key]=clamp(values[key]);for(const key of ['voice','musicEnabled'])if(values[key]!=null)this.settings[key]=!!values[key];
  // A zeroed channel ends its active blasts; restoring volume must not revive an old tail.
  if(wasAudible&&(this.settings.master===0||this.settings.effects===0))this._clearExplosions(false);
  if(!this.settings.voice||this.settings.narration===0||this.settings.master===0)this.cancel();else if(this._speaking?.utterance)this._speaking.utterance.volume=this.settings.narration*this.settings.master;
  this._applyVolumes();return{...this.settings};
 }
 setVolume(channel,value){if(channel==='volume')channel='master';if(['master','music','effects','narration'].includes(channel))this.setSettings({[channel]:value});return this.settings[channel];}
 toggle(force){
  const next=typeof force==='boolean'?force:!this.enabled;if(next&&!this.init())return false;this.enabled=next;if(next){this._active=true;this.ctx?.resume?.().catch?.(()=>{});this._startClock();this._nextStep=this.ctx.currentTime+.1;}else{this.cancel();this._stopClock();this._silence();this.ctx?.suspend?.().catch?.(()=>{});}this._applyVolumes();this.onStateChange({enabled:this.enabled,settings:{...this.settings}});if(next)this.chime();return this.enabled;
 }
 _startClock(){if(!this._timer)this._timer=root.setInterval(()=>{this._schedule();this._drainSpeech();},50);}
 _stopClock(){if(this._timer){root.clearInterval(this._timer);this._timer=null;}}
 _silence(){if(!this.ctx)return;this._clearExplosions(false);const t=this.ctx.currentTime;for(const node of [this.engine?.gain,this.engineGrain?.gain,this.wind?.gain,this.ocean?.gain,this.air?.gain,this.radio?.gain,this.transient?.gain,this.sub?.gain,this.room?.gain,this.roomHarmonic?.gain,...(this._ui||[]).map(v=>v.gain),...(this._pads||[]).map(v=>v.gain),...(this._melody||[]).map(v=>v.gain),this._bass?.gain,this._pulse?.gain])if(node){node.gain.cancelScheduledValues(t);node.gain.setValueAtTime(0,t);}}
 suspend(){this._active=false;this.cancel();this._stopClock();this._silence();this.ctx?.suspend?.().catch?.(()=>{});}
 update(state={},active=true,context={}){
  this._lastState=state;const previousRate=this._context.rate;this._context={...this._context,...this.getContext(),...context};if(previousRate<=5&&this._context.rate>5)this.cancel();const visible=!root.document?.hidden&&!this._context.hidden,run=!!active&&visible;
  if(!run){if(this._active)this.suspend();return;}if(!this.enabled||!this.ctx)return;
  if(!this._active){this._active=true;this.ctx.resume?.().catch?.(()=>{});this._nextStep=this.ctx.currentTime+.08;this._startClock();}
  const {view,cameraTarget}=this._context,c=state.capsule||{},b=state.booster||{},monitored=view==='cockpit'?(c.active?c:state):cameraTarget==='booster'&&b.separated?b:c.active&&cameraTarget==='capsule'?c:state;
  const capacity=monitored===c?600000:monitored===b?20e6:state.separated?14.7e6:75e6,power=clamp((monitored.thrust||0)/capacity),altitude=Math.max(0,monitored.altitude||0),inside=view==='mission'?.16:view==='cockpit'?.58:1,atmosphere=view==='pad'?1-clamp((altitude-28000)/90000,0,.97):1,level=power*inside*atmosphere,t=this.ctx.currentTime;
  this.monitoredVehicle=monitored===c?'capsule':monitored===b?'booster':'ship';this.monitoredPower=power;
  this._target(this.engine.gain.gain,level*.38*(1+Math.sin(t*21)*.025),.15);this._target(this.engine.filter.frequency,120+power*590,.18);this._target(this.engineGrain.gain.gain,level*.034,.2);this._target(this.engineGrain.filter.frequency,570+power*2100,.25);this._target(this.sub.gain.gain,level*.105,.2);this._target(this.sub.osc.frequency,(monitored===c?52:monitored===b?34:37)+power*7,.2);
  const groundAir=view==='pad'?1-clamp(altitude/15000):0,windSpeed=clamp((state.config?.wind||5)/35),wave=.6+.4*Math.sin(t*.24+Math.sin(t*.13));this._target(this.wind.gain.gain,groundAir*(.012+windSpeed*.040),.7);this._target(this.wind.filter.frequency,480+windSpeed*1500,.8);this._target(this.ocean.gain.gain,groundAir*.019*wave,.9);this._target(this.air.gain.gain,view==='cockpit'?.008:view==='mission'?.003:0,.35);this._target(this.room.gain.gain,view==='mission'?.009:view==='cockpit'?.004:0,.4);this._target(this.roomHarmonic.gain.gain,view==='mission'?.0025:0,.4);
  const phase=String(monitored.phase||state.phase||''),theme=c.active&&monitored===c?'recovery':/RETURN|APPROACH|LANDING|ENTRY|BOOSTBACK|CHUTE/.test(phase)?'recovery':/COAST|COMPLETE|LANDED/.test(phase)?'coast':/IGNITION|LIFTOFF|ASCENT|HOT_STAGING|SHIP_BURN/.test(phase)||((state.time||0)>0&&power>0)?'ascent':'control';
  if(theme!==this._theme){this._theme=theme;this._step=0;this._nextStep=this.ctx.currentTime+.1;}this._schedule();this._drainSpeech();
 }
 _note(voice,note,time,duration,gain,attack=.025){const p=voice.gain.gain;p.cancelScheduledValues(time);voice.osc.frequency.setValueAtTime(frequency(note),time);p.setValueAtTime(.00001,time);p.linearRampToValueAtTime(gain,time+attack);p.setTargetAtTime(.00001,time+Math.max(attack,duration*.58),Math.max(.035,duration*.19));p.setValueAtTime(0,time+duration+.1);voice.busyUntil=time+duration;}
 _schedule(){
  if(!this.ctx||!this.enabled||!this._active||this.ctx.state==='suspended')return;const t=this.ctx.currentTime;if(this._explosionDucking&&t>=this._explosionDuckUntil){this._explosionDucking=false;this._applyVolumes();}if(this._nextStep<t-.25)this._nextStep=t+.05;
  const theme=THEMES[this._theme],stepDuration=30/theme.bpm;
  while(this._nextStep<t+.18){const step=this._step++,time=this._nextStep,chord=theme.chords[Math.floor(step/16)%theme.chords.length],bar=step%16;if(bar===0){this._pads.forEach((voice,i)=>this._note(voice,chord[i]+12,time,stepDuration*15.5,.022,.45));this._note(this._bass,chord[0]-12,time,stepDuration*(theme.pulse?3.1:12),.055,.045);}
   if(theme.pulse&&bar%4===0)this._note(this._bass,chord[0]-12,time,stepDuration*2.8,.056,.024);
   const melody=theme.melody[bar];if(melody!=null){this._note(this._melody[this._melodyIndex++%this._melody.length],melody,time,stepDuration*(theme.pulse?1.3:2.2),theme.pulse?.040:.042,.035);}
   if(theme.pulse&&bar%2===1)this._note(this._pulse,chord[(bar>>1)%4],time,stepDuration*.65,.030,.012);
   this._nextStep+=stepDuration;
  }
 }
 tone(freq=720,seconds=.12,vol=.04){if(!this.enabled||!this.ctx||!this._active)return false;const t=this.ctx.currentTime,voice=this._ui[this._uiIndex++%this._ui.length],gain=voice.gain.gain;gain.cancelScheduledValues(t);voice.osc.type='sine';voice.osc.frequency.setValueAtTime(clamp(freq,30,6000),t);gain.setValueAtTime(.00001,t);gain.linearRampToValueAtTime(clamp(vol,0,.3),t+.007);gain.exponentialRampToValueAtTime(.00001,t+Math.max(.025,seconds));voice.busyUntil=t+seconds;return true;}
 chime(){return this.tone(740,.105,.038);}
 _thump(strength=.7){if(!this.ctx||!this.enabled||!this._active)return;const t=this.ctx.currentTime,v=this._ui[this._uiIndex++%this._ui.length],g=v.gain.gain;g.cancelScheduledValues(t);v.osc.frequency.setValueAtTime(94,t);v.osc.frequency.exponentialRampToValueAtTime(28,t+.52);g.setValueAtTime(.00001,t);g.linearRampToValueAtTime(.16*strength,t+.012);g.exponentialRampToValueAtTime(.00001,t+.65);this._burst(.055*strength,.44,750);}
 _burst(volume,seconds,hz){if(!this.ctx||!this.enabled||!this._active)return;const t=this.ctx.currentTime,g=this.transient.gain.gain;g.cancelScheduledValues(t);this.transient.filter.frequency.setValueAtTime(hz,t);g.setValueAtTime(.00001,t);g.linearRampToValueAtTime(volume,t+.045);g.exponentialRampToValueAtTime(.00001,t+seconds);}
 // Three fixed voice banks cover simultaneous ship, booster and capsule incidents.
 // All noise, filters and oscillators are created once during gesture-authorized init.
 _initExplosions(){
  const c=this.ctx;this._blastLow=c.createBuffer(1,c.sampleRate*6,c.sampleRate);this._blastHigh=c.createBuffer(1,c.sampleRate*6,c.sampleRate);const low=this._blastLow.getChannelData(0),high=this._blastHigh.getChannelData(0);let seed=729103,brown=0,slow=0;
  for(let i=0;i<low.length;i++){seed=(seed*1664525+1013904223)>>>0;const n=seed/2147483648-1;brown=(brown+n*.035)/1.035;slow=(slow+n*.004)/1.004;low[i]=clamp(brown*2.5+slow*1.2,-.95,.95);high[i]=n*.9;}
  this._explosions=['ship','booster','capsule'].map((body,index)=>{
   const sub=this._oscillator('sine',this.effectsBus,34),crack=this._noiseLayer(this._blastHigh,'lowpass',7600,.65),roll=this._noiseLayer(this._blastLow,'lowpass',260,.8),debris=this._noiseLayer(this._blastHigh,'bandpass',2300,1.5);
   if(c.createStereoPanner){const pan=c.createStereoPanner();pan.pan.value=index===1?-.18:.18;debris.gain.disconnect();debris.gain.connect(pan);pan.connect(this.effectsBus);debris.panner=pan;}
   return{body,sub,crack,roll,debris,end:0};
  });
 }
 _blastEnvelope(param,time,points){param.cancelScheduledValues(time);param.setValueAtTime(0,time);for(const [offset,value] of points)param.linearRampToValueAtTime(value,time+offset);}
 _clearExplosions(clearIds){
  if(clearIds)this._explosionIds.clear();this._explosionDuckUntil=0;this._explosionDucking=false;
  if(this.ctx){const t=this.ctx.currentTime;for(const voice of this._explosions){for(const layer of [voice.sub,voice.crack,voice.roll,voice.debris]){layer.gain.gain.cancelScheduledValues(t);layer.gain.gain.setValueAtTime(0,t);(layer.osc?.frequency||layer.filter?.frequency)?.cancelScheduledValues(t);}voice.end=0;}this._applyVolumes();}
 }
 resetExplosions(){this._clearExplosions(true);this._lastExplosionAt=-Infinity;this.lastExplosion=null;}
 explosion(incident={}){
  if(!this.enabled||!this.ctx||!this._active||root.document?.hidden||this._context.hidden||this.ctx.state==='suspended'||this.settings.master===0||this.settings.effects===0)return false;
  const id=incident.id==null?null:String(incident.id);if(id!=null&&this._explosionIds.has(id))return false;
  const body=['ship','booster','capsule'].includes(incident.body)?incident.body:'ship',kind=['impact','rupture','engine-failure'].includes(incident.kind)?incident.kind:'impact',speed=clamp(incident.speed,0,10000),mass=clamp(incident.mass,0,6000000),fuel=clamp(incident.fuel,0,5000000);
  const bodySize=body==='capsule'?.32:body==='booster'?.88:.72,massScale=clamp(Math.log10(1+mass/3000)/3),fuelScale=clamp(Math.log10(1+fuel/1000)/3.6),speedScale=clamp(speed/350),severity=clamp(.26+bodySize*.28+massScale*.18+fuelScale*.17+speedScale*.16,.28,1),localized=kind==='engine-failure';
  const t=this.ctx.currentTime,voice=this._explosions.find(v=>v.body===body),others=this._explosions.filter(v=>v!==voice&&v.end>t).length,context={...this._context,...this.getContext()},interior=context.view==='mission'?.68:context.view==='cockpit'?.87:1,strength=severity*(localized?.64:1)*interior/Math.sqrt(1+others*.65),duration=localized?3.1:3.4+severity*2.4;
  const sub=voice.sub.osc.frequency;sub.cancelScheduledValues(t);sub.setValueAtTime(localized?112:88,t);sub.exponentialRampToValueAtTime(localized?46:34,t+.16);sub.exponentialRampToValueAtTime(localized?33:25,t+duration*.62);
  this._blastEnvelope(voice.sub.gain.gain,t,[[.009,.205*strength],[.09,.18*strength],[.38,.125*strength],[duration*.28,.069*strength],[duration*.65,.025*strength],[duration,0]]);
  voice.crack.filter.frequency.cancelScheduledValues(t);voice.crack.filter.frequency.setValueAtTime(localized?8600:7200,t);voice.crack.filter.frequency.exponentialRampToValueAtTime(750,t+.62);
  this._blastEnvelope(voice.crack.gain.gain,t,[[.003,.19*strength],[.020,.10*strength],[.09,.055*strength],[.30,.018*strength],[.72,0]]);
  const low=voice.roll.filter.frequency;low.cancelScheduledValues(t);low.setValueAtTime(localized?520:380,t);low.exponentialRampToValueAtTime(145,t+duration*.40);low.exponentialRampToValueAtTime(55,t+duration);
  this._blastEnvelope(voice.roll.gain.gain,t,[[.025,.18*strength],[.13,.43*strength],[duration*.18,.27*strength],[duration*.32,.32*strength],[duration*.45,.16*strength],[duration*.58,.22*strength],[duration*.78,.055*strength],[duration,0]]);
  const rubble=voice.debris.gain.gain;rubble.cancelScheduledValues(t);rubble.setValueAtTime(0,t);voice.debris.filter.frequency.cancelScheduledValues(t);voice.debris.filter.frequency.setValueAtTime(localized?3100:2300,t);voice.debris.filter.frequency.exponentialRampToValueAtTime(570,t+duration);
  for(const [i,offset] of [.19,.43,.79,1.28,1.96,2.75].entries()){const gain=(.038/(1+i*.42))*strength;rubble.setValueAtTime(0,t+offset);rubble.linearRampToValueAtTime(gain,t+offset+.012);rubble.exponentialRampToValueAtTime(.00001,t+offset+.11+i*.017);}rubble.setValueAtTime(0,t+duration);
  voice.end=t+duration;this._lastExplosionAt=now();this._explosionDuckUntil=Math.max(this._explosionDuckUntil,t+Math.min(4.5,duration*.8));this._explosionDucking=true;this._applyVolumes();
  if(id!=null){this._explosionIds.add(id);if(this._explosionIds.size>128)this._explosionIds.delete(this._explosionIds.values().next().value);}
  this.lastExplosion={id,body,kind,strength,duration,startedAt:t};if(incident.narration)this.say(String(incident.narration),{priority:3,key:'explosion-'+(id??body+'-'+t),kind:'FLIGHT ALERT'});return true;
 }
 event(kind,text,options={}){
  const key=String(kind||'').toLowerCase(),stamp=now();if(stamp-(this._lastCue.get(key)||-10000)<400)return false;this._lastCue.set(key,stamp);
  if(/impact|rupture|explosion|engine-failure/.test(key)){/* Incident controller calls explosion(); do not double its sound here. */}
  else if(/abort|alarm|failure/.test(key)){this.tone(220,.65,.09);this.tone(277,.55,.055);if(stamp-this._lastExplosionAt>2000)this._thump(.45);}
  else if(/cutoff|burnout/.test(key)){this._burst(.025,.30,950);this.tone(330,.22,.024);}
  else if(/escape|liftoff|ignition/.test(key))this._thump(.9);
  else if(/stag|separat/.test(key)){this._thump(.7);this.tone(1160,.075,.065);}
  else if(/parachute|chute/.test(key)){this._burst(.15,1.6,1600);this.tone(510,.12,.025);}
  else if(/catch|captur|dock/.test(key)){this._thump(.6);this.tone(523.25,.65,.035);this.tone(659.25,.8,.026);this.tone(783.99,1.05,.019);}
  else if(/touchdown|landed/.test(key)){this._thump(.55);this.tone(392,.55,.035);this.tone(587.33,.85,.023);}
  else if(/hold|warning/.test(key)){this.tone(390,.26,.045);this.tone(520,.3,.025);}
  else if(/go|ready|deploy|complete/.test(key))this.chime();
  if(text)this.say(text,{kind:key,...options});return true;
 }
 say(text,options={}){
  text=String(text??'').replace(/\s+/g,' ').trim().slice(0,260);if(!text)return false;
  const stamp=now(),priority=clamp(options.priority??(/abort|impact|failure|emergency/i.test(text)?3:/liftoff|ignition|escape|touchdown|captur|landed/i.test(text)?2:1),0,3),key=options.key||text,meta={...options,key,priority,kind:options.kind||'narration',spoken:false};
  try{this.onCaption(text,meta);}catch(error){this.lastCaptionError=String(error?.message||error);}
  const context={...this._context,...this.getContext()},rate=Number(context.rate)||1;
  if(!this.enabled||!this._active||!this.settings.voice||!this.settings.narration||!this.settings.master||root.document?.hidden||!root.speechSynthesis||!root.SpeechSynthesisUtterance)return false;
  if(rate>5&&priority<2)return false;if(stamp-(this._seen.get(key)||-10000)<3500)return false;this._seen.set(key,stamp);if(this._seen.size>80)for(const [k,t] of this._seen)if(stamp-t>15000)this._seen.delete(k);
  const concise=rate>1?text.split(/(?<=[.!?])\s/)[0].split(' ').slice(0,25).join(' '):text,item={text:concise,key,priority,issued:stamp,expires:stamp+(options.ttl??(/^\d+$/.test(text)?950:rate>5?2200:priority===3?12000:6000)),meta};
  if(this._speaking&&priority===3&&this._speaking.priority<3){this._cancelSpeech(false);this._speechQueue=[];}
  this._speechQueue=this._speechQueue.filter(q=>q.key!==key&&q.expires>stamp);if(rate>5)this._speechQueue=this._speechQueue.filter(q=>q.priority>priority);this._speechQueue.push(item);this._speechQueue.sort((a,b)=>b.priority-a.priority||b.issued-a.issued);this._speechQueue=this._speechQueue.slice(0,2);this._drainSpeech();return true;
 }
 _drainSpeech(){
  const stamp=now();if(this._speaking){const elapsed=stamp-this._speaking.issued,limit=this._context.rate>5?(this._speaking.priority===3?7000:3300):Math.min(22000,4000+this._speaking.text.split(' ').length*440);if(elapsed>limit)this._cancelSpeech(false);else return;}if(!this.enabled||!this._active||!this.settings.voice||!root.speechSynthesis)return;
  this._speechQueue=this._speechQueue.filter(q=>q.expires>stamp);const item=this._speechQueue.shift();if(!item)return;
  const utterance=new root.SpeechSynthesisUtterance(item.text),voices=root.speechSynthesis.getVoices?.()||[],english=voices.filter(v=>/^en[-_]/i.test(v.lang));utterance.voice=english.find(v=>/Daniel|Aria|Samantha|Google UK English Male/i.test(v.name))||english.find(v=>v.localService)||english[0]||null;utterance.lang=utterance.voice?.lang||'en-US';utterance.rate=this._context.rate>1?1.08:.98;utterance.pitch=.9;utterance.volume=this.settings.master*this.settings.narration;
  const generation=++this._speechGeneration;this._speaking={...item,utterance};const complete=()=>{if(generation!==this._speechGeneration)return;this._speaking=null;this._applyVolumes();this._drainSpeech();};utterance.onend=complete;utterance.onerror=complete;this._applyVolumes();
  if(this.ctx){const g=this.radio.gain.gain,t=this.ctx.currentTime;g.cancelScheduledValues(t);g.setValueAtTime(.010,t);g.exponentialRampToValueAtTime(.00001,t+.10);}
  try{root.speechSynthesis.speak(utterance);}catch{complete();}
 }
 _cancelSpeech(clear=true){this._speechGeneration++;this._speaking=null;if(clear)this._speechQueue=[];root.speechSynthesis?.cancel?.();this._applyVolumes();}
 cancel(){this._cancelSpeech(true);}
 reset(){this.cancel();this.resetExplosions();this._seen.clear();this._lastCue.clear();this._theme='control';this._step=0;if(this.ctx)this._nextStep=this.ctx.currentTime+.12;}
 dispose(){if(this._disposed)return;this.suspend();this._disposed=true;root.document?.removeEventListener('visibilitychange',this._onVisibility);for(const node of [...this._oscillators,...this._loopSources]){try{node.stop();node.disconnect();}catch{}}this.ctx?.close?.().catch?.(()=>{});this.enabled=false;}
}
root.FlightAudio=FlightAudio;if(typeof module!=='undefined'&&module.exports)module.exports=FlightAudio;
})(typeof window!=='undefined'?window:globalThis);
