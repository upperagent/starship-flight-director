/* CINEMATIC FAILURES / Shared, deterministic game effects.
   Visual blast scales are authored for this simulator, not physical blast predictions.
   Every camera observes the same real-time pool. update(0) freezes the effect. */
(function(){
'use strict';
const T=window.THREE,TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>{t=clamp(t);return t*t*(3-2*t)};
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
function seedOf(text){let n=2166136261;for(const c of String(text)){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0}
const noiseGLSL=`float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}float fbm(vec3 p){return .57*noise(p)+.28*noise(p*2.13)+.15*noise(p*4.3);}`;
class CinematicFailures{
 constructor(host){
  this.host=host;this.root=new T.Group();this.root.name='Cinematic failure effects';host.scene.add(this.root);
  this.clock=0;this.maxBursts=5;this.maxLarge=3;this.bursts=[];this.seen=new Set();this.craters=[];this.resources=new Set();this.dummy=new T.Object3D();this.flash=0;this.lastState=null;
  // Allocate once at the upper bound; draw counts follow the current quality.
  this.counts={lobes:8,fire:10,smoke:40,dust:16,debris:48,embers:96};
  this.fireballs=this.makeFireballs(this.maxBursts*this.counts.lobes);
  this.fire=this.makeBillboards(this.maxBursts*(this.counts.fire+5),1);
  this.smoke=this.makeBillboards(this.maxBursts*(this.counts.smoke+this.counts.dust+3),0);
  this.embers=this.makeBillboards(this.maxBursts*this.counts.embers,2);
  this.flashes=this.makeBillboards(this.maxBursts,3);
  this.shocks=this.makeGround(this.maxBursts,false);
  this.scorches=this.makeGround(6,true);
  const panelGeo=new T.CylinderGeometry(1.4,1.4,2.2,5,1,true,-.72,1.44);panelGeo.translate(-1.1,0,0);
  const panelMat=new T.MeshStandardMaterial({color:0x69747a,metalness:.86,roughness:.44,side:T.DoubleSide});
  const strutGeo=new T.BoxGeometry(.20,1.9,.30),strutMat=new T.MeshStandardMaterial({color:0x333a40,metalness:.63,roughness:.77});
  this.panels=this.makeInstances(panelGeo,panelMat,this.maxBursts*this.counts.debris);this.struts=this.makeInstances(strutGeo,strutMat,this.maxBursts*this.counts.debris);
  this.lights=[];for(let i=0;i<2;i++){const light=new T.PointLight(0xff943d,0,800,1.8);this.root.add(light);this.lights.push(light);}
  this.setQuality(host.quality||(host.low?'low':'medium'));this.reset();
 }
 setQuality(quality){const low=quality==='low',high=quality==='high';this.counts={lobes:low?5:8,fire:low?6:10,smoke:low?16:high?40:26,dust:low?10:16,debris:low?18:high?48:32,embers:low?36:high?96:64};}
 makeInstances(geometry,material,count){const mesh=new T.InstancedMesh(geometry,material,count);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;this.root.add(mesh);this.resources.add(geometry);this.resources.add(material);return mesh}
 makeBillboards(count,kind){
  const geo=new T.PlaneGeometry(1,1);geo.setAttribute('aFx',new T.InstancedBufferAttribute(new Float32Array(count*4),4).setUsage(T.DynamicDrawUsage));
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:kind>=2?T.AdditiveBlending:T.NormalBlending,uniforms:{time:{value:0},kind:{value:kind}},
   vertexShader:`attribute vec4 aFx;varying vec2 vUv;varying vec4 vFx;void main(){vUv=uv;vFx=aFx;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));float a=aFx.z*6.28318;mat2 r=mat2(cos(a),-sin(a),sin(a),cos(a));center.xy+=r*position.xy*size;gl_Position=projectionMatrix*center;}`,
   fragmentShader:`uniform float time;uniform float kind;varying vec2 vUv;varying vec4 vFx;${noiseGLSL}
void main(){vec2 q=(vUv-.5)*2.;float rad=length(q);if(rad>1.)discard;float n=fbm(vec3(vUv*5.+vFx.z*19.,time*.16+vFx.z*11.));float edge=1.-smoothstep(.26,.99,rad+n*.18);float alpha=edge*edge*vFx.x;vec3 c;
if(kind<.5){float sphere=sqrt(max(0.,1.-dot(q,q)));float billow=.32+.68*n;float light=.34+.66*clamp(sphere*.60-q.y*.3-q.x*.23,0.,1.);c=mix(vec3(.015,.018,.021),vec3(.19,.175,.15),light*billow);c+=vec3(1.4,.25,.025)*vFx.y*pow(max(0.,1.-rad),1.5);alpha*=.55+n*.45;}
else if(kind<1.5){float heat=clamp((n-.34)*2.7+vFx.y*.24,0.,1.);c=mix(vec3(.045,.005,.001),vec3(2.6,.14,.007),smoothstep(.20,.57,heat));c=mix(c,vec3(5.,1.25,.075),smoothstep(.64,.95,heat));c=mix(c,vec3(7.,4.,.7),smoothstep(.965,1.,heat));alpha*=.6+n*.4;}
else if(kind<2.5){alpha=pow(max(0.,1.-rad),2.)*vFx.x;c=mix(vec3(4.,.12,.004),vec3(7.,2.4,.15),vFx.y);}
else{float rays=pow(abs(sin(atan(q.y,q.x)*4.)),20.)*.10;alpha=(exp(-rad*rad*11.)+rays*pow(1.-rad,2.))*vFx.x;c=vec3(12.,8.,3.5);}
if(alpha<.002)discard;gl_FragColor=vec4(c,alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
  const mesh=this.makeInstances(geo,mat,count);mesh.renderOrder=kind===0?8:kind>=2?11:7;return mesh;
 }
 makeFireballs(count){
  const geo=new T.IcosahedronGeometry(1,10);geo.setAttribute('aFx',new T.InstancedBufferAttribute(new Float32Array(count*4),4).setUsage(T.DynamicDrawUsage));
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,uniforms:{time:{value:0}},
   vertexShader:`attribute vec4 aFx;uniform float time;varying vec3 vLocal;varying vec3 vNormal;varying vec4 vFx;${noiseGLSL}void main(){vFx=aFx;vLocal=position;float billow=fbm(position*3.8+vec3(aFx.z*12.,-time*.55,time*.13));float wobble=.84+billow*.37;vec3 p=position*wobble;vec4 view=modelViewMatrix*instanceMatrix*vec4(p,1.);vNormal=normalize(mat3(modelViewMatrix)*mat3(instanceMatrix)*normal);gl_Position=projectionMatrix*view;}`,
   fragmentShader:`uniform float time;varying vec3 vLocal;varying vec3 vNormal;varying vec4 vFx;${noiseGLSL}
void main(){float n=fbm(vLocal*4.2+vec3(vFx.z*12.,-time*.8,time*.17));float heat=clamp((n-.34)*2.7+vFx.y*.24,0.,1.);vec3 c=mix(vec3(.055,.006,.002),vec3(2.8,.16,.009),smoothstep(.22,.58,heat));c=mix(c,vec3(5.5,1.35,.085),smoothstep(.66,.95,heat));c=mix(c,vec3(7.,4.,.7),smoothstep(.965,1.,heat));float edge=smoothstep(.03,.45,abs(vNormal.z));float shade=.38+.62*clamp(vNormal.y*.45+vNormal.z*.4,0.,1.);vec3 soot=vec3(.025,.027,.030)+vec3(.11,.09,.075)*shade*(.20+n*n*1.5);c=mix(c,soot,vFx.w);gl_FragColor=vec4(c,edge*vFx.x*(.6+n*.4));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
  const mesh=this.makeInstances(geo,mat,count);mesh.renderOrder=6;return mesh;
 }
 makeGround(count,scorch){
  const geo=new T.PlaneGeometry(1,1);geo.setAttribute('aFx',new T.InstancedBufferAttribute(new Float32Array(count*4),4).setUsage(T.DynamicDrawUsage));
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,uniforms:{scorch:{value:scorch?1:0}},vertexShader:'attribute vec4 aFx;varying vec2 vUv;varying vec4 vFx;void main(){vUv=uv;vFx=aFx;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;varying vec4 vFx;uniform float scorch;${noiseGLSL}
void main(){vec2 q=(vUv-.5)*2.;float r=length(q);float n=fbm(vec3(q*19.,vFx.z*10.));float a;vec3 c;if(scorch>.5){a=(1.-smoothstep(.48,.97,r+n*.13))*vFx.x;c=mix(vec3(.016,.018,.019),vec3(.13,.12,.10),n*.65);float cracks=pow(max(0.,sin(n*85.)),30.);c+=vec3(.09,.048,.014)*cracks*(1.-r);}else{float ring=exp(-pow((r-.82)/(.036+vFx.y*.07),2.));a=ring*vFx.x*(.5+n*.5);c=mix(vec3(.65,.47,.26),vec3(2.8,1.1,.18),vFx.y);}if(a<.003)discard;gl_FragColor=vec4(c,a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});const mesh=this.makeInstances(geo,mat,count);mesh.renderOrder=scorch?1:2;return mesh;
 }
 matrix(mesh,i,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){const d=this.dummy;d.position.set(x,y,z);d.scale.set(Math.max(.00001,sx),Math.max(.00001,sy),Math.max(.00001,sz));d.rotation.set(rx,ry,rz);d.updateMatrix();mesh.setMatrixAt(i,d.matrix)}
 data(mesh,i,a,h,seed,fourth=0){mesh.geometry.attributes.aFx.setXYZW(i,a,h,seed,fourth)}
 clear(mesh){mesh.count=0}
 trigger(incident){
  if(!incident||incident.id==null)return null;const key=String(incident.id);if(this.seen.has(key))return null;this.seen.add(key);if(this.seen.size>160)this.seen.delete(this.seen.values().next().value);
  const small=incident.kind==='engine-failure',body=incident.body||'ship',fuel=Math.max(0,Number(incident.fuel)||0),speed=Math.max(0,Number(incident.speed)||0),base=small?5:body==='capsule'?14:body==='booster'?120:94;
  const radius=small?base:clamp(base*(.8+.50*Math.sqrt(clamp(fuel/(body==='booster'?1000000:body==='capsule'?700:260000)))+.22*clamp(speed/300)),body==='capsule'?11:72,body==='capsule'?24:240);
  const origin=V(Number(incident.x)||0,Math.max(0,Number(incident.y)||0),Number(incident.z)||0),grounded=!small&&(incident.kind==='impact'||origin.y<radius*.30);
  if(this.bursts.length>=this.maxBursts)this.bursts.shift();if(!small&&this.bursts.filter(b=>!b.small).length>=this.maxLarge){const index=this.bursts.findIndex(b=>!b.small);this.bursts.splice(index,1);}
  const seed=seedOf(key+body),b={id:key,body,kind:incident.kind||'impact',origin,radius,grounded,small,seed,age:0,lifetime:small?11:34,debris:[],speed,fuel,attached:!!incident.attached,followOffset:null};
  const amount=small?Math.max(5,Math.floor(this.counts.debris*.28)):this.counts.debris;
  for(let i=0;i<amount;i++){
   const r=n=>hash(seed*.00017+i*73+n*113),a=r(2)*TAU,vertical=.25+r(7)*.85,launch=small?8+r(8)*20:radius*(.23+r(5)*.55),direction=V(Math.cos(a)*launch,launch*vertical,Math.sin(a)*launch);
   if(!grounded){direction.x+=(Number(incident.vx)||0)*.28;direction.y+=(Number(incident.vy)||0)*.12;}
   const position=origin.clone().add(V((r(10)-.5)*radius*.1,Math.max(1,r(11)*radius*.11),(r(12)-.5)*radius*.1));
   b.debris.push({position,velocity:direction,rotation:V(r(14)*TAU,r(15)*TAU,r(16)*TAU),spin:V((r(17)-.5)*5,(r(18)-.5)*6,(r(19)-.5)*4),size:(small?.3:body==='capsule'?.6:1.4)+r(20)*(small?.8:body==='capsule'?1.1:3.8),seed:r(21),settled:false,bounces:0,panel:i%3!==0});
  }
  this.bursts.push(b);
  if(grounded){this.craters.push({origin:origin.clone(),radius:radius*.57,seed:hash(seed*.0001)});if(this.craters.length>6)this.craters.shift();}
  this.renderPools();return b;
 }
 update(dt=0,state={}){
  const step=clamp(Number(dt)||0,0,.12);this.lastState=state;this.clock+=step;
  for(const b of this.bursts){b.age+=step;for(const p of b.debris){if(p.settled||step===0)continue;p.velocity.multiplyScalar(Math.exp(-step*.075));p.velocity.y-=9.81*step;p.position.addScaledVector(p.velocity,step);p.rotation.addScaledVector(p.spin,step);if(p.position.y<p.size*.2){p.position.y=p.size*.2;p.velocity.y=Math.abs(p.velocity.y)*.24;p.velocity.x*=.50;p.velocity.z*=.50;p.spin.multiplyScalar(.32);p.bounces++;if(p.bounces>3||p.velocity.length()<2.5){p.settled=true;p.velocity.set(0,0,0);p.rotation.z=p.seed*TAU;p.rotation.x=Math.PI*.48;}}}}
  this.bursts=this.bursts.filter(b=>b.age<b.lifetime);this.renderPools();
 }
 renderPools(){
  const C=this.counts;let li=0,fi=0,si=0,ei=0,pi=0,ri=0,flashIndex=0,shockIndex=0;
  for(const b of this.bursts){
   const t=b.age,R=b.radius,o=b.origin,rand=n=>hash(b.seed*.00031+n*59.31),growth=1-Math.exp(-t*3.1),hot=clamp(1-t/(b.small?2:12)),smokeLife=1-ease((t-23)/11),coreFade=b.small?clamp(1-t/1.5):1-ease((t-19)/12);
   const flashEnvelope=Math.exp(-t*10)*(t<.8?1:0);this.matrix(this.flashes,flashIndex,o.x,o.y+R*.16,o.z,R*7,R*7,1);this.data(this.flashes,flashIndex++,flashEnvelope*.94,1,rand(2));
   for(let n=0;n<(b.small?3:C.lobes);n++){
    const a=rand(n+3)*TAU,spread=(.1+rand(n+80)*.48)*R*growth,size=R*(.22+rand(n+103)*.27)*(.08+.92*growth)*(1+t*.07),y=o.y+(b.grounded?size*.64:0)+rand(n+130)*R*.28+t*R*.048;
    this.matrix(this.fireballs,li,o.x+Math.sin(a)*spread,y,o.z+Math.cos(a)*spread,size,size*(.85+rand(n+16)*.35),size);this.data(this.fireballs,li++,coreFade*.95,hot*.90+rand(n+100)*.10,rand(n+110),b.small?0:ease((t-2.0)/4.8));
   }
   for(let n=0;n<(b.small?3:C.fire);n++){
    const a=n*TAU/C.fire,spread=R*(.1+rand(n+71)*.38)*growth,y=o.y+R*(.12+rand(n+87)*.3)+t*R*.08,size=R*(.34+rand(n+311)*.35)*(.10+growth)*(1+t*.08);
    this.matrix(this.fire,fi,o.x+Math.sin(a)*spread,y,o.z+Math.cos(a)*spread,size,size*1.15,1);this.data(this.fire,fi++,clamp(1-t/(b.small?2.2:7))*.86,hot,rand(n+900));
   }
   // A rolling, expanding column; delayed parcels curl outward as they rise.
   for(let n=0;n<(b.small?8:C.smoke);n++){
    const delay=n/(b.small?8:C.smoke)*(b.small?1.2:4.5),age=Math.max(0,t-delay),ready=ease(age/.7),a=n*2.39996+rand(n+23),r=R*(.11+rand(n+308)*.38)*(1+age*.025),rise=age*R*(.036+rand(n+509)*.025),size=R*(.60+rand(n+601)*.50)*(1+age*.025),curl=Math.sin(age*.4+n)*R*.055;
    const alpha=ready*smokeLife*(b.small?.50:.68)*(b.small?1:ease((t-.8)/3)),heat=clamp((8-age)/8)*hot*.33;
    this.matrix(this.smoke,si,o.x+Math.cos(a)*r+curl+age*R*.016,o.y+R*.26+rise+rand(n+233)*R*.26,o.z+Math.sin(a)*r,size,size*(.82+rand(n+73)*.35),1);this.data(this.smoke,si++,alpha,heat,rand(n+651));
   }
   // A damaged moving vehicle keeps a compact fuel-fed fire and black wake.
   // The main blast remains anchored to its incident position in world space.
   if(!b.grounded&&(b.kind==='rupture'||b.small)&&t>.35&&this.lastState){
    const state=b.body==='booster'&&this.lastState.separated?this.lastState.booster:b.body==='capsule'?this.lastState.capsule:this.lastState;
    if(state&&Number.isFinite(state.altitude)&&!/(IMPACT|LANDED|COMPLETE)/.test(state.phase||'')&&!(state.phase==='ABORTED'&&state.altitude<=0)&&!this.host.destroyedBodies?.has?.(b.body)){
     if(b.followOffset==null)b.followOffset=clamp(o.y-state.altitude,-8,80);
     const x=state.downrange||0,y=state.altitude+b.followOffset,z=o.z,size=R*(b.small?.9:.27),strength=clamp((b.lifetime-t)/5);
     for(let n=0;n<2;n++){this.matrix(this.fire,fi,x+Math.sin(t*6+n)*size*.13,y+size*.16-n*size*.18,z,size,size*1.8,1);this.data(this.fire,fi++,strength*.83,.72,rand(n+1613));}
     for(let n=0;n<3;n++){const offset=(n+1)*size*.58;this.matrix(this.smoke,si,x+offset*.2,y+offset,z,size*(1.7+n*.25),size*(1.8+n*.25),1);this.data(this.smoke,si++,strength*(.42-n*.055),n===0?.13:0,rand(n+1627));}
    }
   }
   if(b.grounded){
    const expansion=R*(.22+1.42*(1-Math.exp(-t*1.2))),shockFade=clamp(1-t/3.1);
    this.matrix(this.shocks,shockIndex,o.x,.13,o.z,expansion*2.5,expansion*2.5,1,-Math.PI/2);this.data(this.shocks,shockIndex++,shockFade*.68,Math.exp(-t*4),rand(96));
    for(let n=0;n<C.dust;n++){
     const a=n*TAU/C.dust,spread=R*(.1+1.42*(1-Math.exp(-t*.78))),size=R*(.24+rand(n+672)*.25)*(1+t*.10),alpha=ease(t/.14)*clamp(1-t/11)*.50;
     this.matrix(this.smoke,si,o.x+Math.sin(a)*spread,o.y+size*.16+t*.25,o.z+Math.cos(a)*spread,size*1.3,size*.54,1);this.data(this.smoke,si++,alpha,.035*hot,rand(n+891));
    }
    // Sparse fuel-fed pockets survive the initial blast and illuminate the scar.
    if(t>2&&t<20)for(let n=0;n<3;n++){
     const a=n*2.39996,span=R*.30,size=R*.16*(.8+.2*Math.sin(t*7+n)),fade=clamp((20-t)/7)*.65;
     this.matrix(this.fire,fi,o.x+Math.cos(a)*span,o.y+size*.38,o.z+Math.sin(a)*span,size,size*1.7,1);this.data(this.fire,fi++,fade,.56+.15*Math.sin(t*3+n),rand(n+1010));
    }
   }
   for(const p of b.debris){
    const mesh=p.panel?this.panels:this.struts,index=p.panel?pi++:ri++;
    this.matrix(mesh,index,p.position.x,p.position.y,p.position.z,p.size,p.size*(p.panel?1:.85),p.size,p.rotation.x,p.rotation.y,p.rotation.z);
    if(!p.settled&&t<8){for(let n=0;n<2;n++){
     const lag=n*.065,scale=p.size*(n?.74:1.1),fade=clamp(1-t/8)*(1-n*.37);
     this.matrix(this.embers,ei,p.position.x-p.velocity.x*lag,p.position.y-p.velocity.y*lag,p.position.z-p.velocity.z*lag,scale*2.8,scale*2.8,1);this.data(this.embers,ei++,fade,.7-n*.3,p.seed);
    }}
   }
  }
  for(const [mesh,count] of [[this.fireballs,li],[this.fire,fi],[this.smoke,si],[this.embers,ei],[this.panels,pi],[this.struts,ri],[this.flashes,flashIndex],[this.shocks,shockIndex]]){
   mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.geometry.attributes.aFx)mesh.geometry.attributes.aFx.needsUpdate=true;if(mesh.material.uniforms?.time)mesh.material.uniforms.time.value=this.clock;
  }
  this.scorches.count=this.craters.length;this.craters.forEach((c,i)=>{this.matrix(this.scorches,i,c.origin.x,.10,c.origin.z,c.radius*2,c.radius*2,1,-Math.PI/2);this.data(this.scorches,i,.88,0,c.seed)});this.scorches.instanceMatrix.needsUpdate=true;this.scorches.geometry.attributes.aFx.needsUpdate=true;
  const bright=this.bursts.slice().sort((a,b)=>this.lightStrength(b)-this.lightStrength(a));this.lights.forEach((l,i)=>{const b=bright[i];if(!b){l.intensity=0;return;}l.position.copy(b.origin).add(V(0,b.radius*.32,0));l.intensity=this.lightStrength(b);l.distance=b.radius*5;l.color.set(b.age<.23?0xffe1aa:0xff862f);});
  this.flash=this.bursts.reduce((m,b)=>Math.max(m,Math.exp(-b.age*9)),0);
 }
 lightStrength(b){return (b.small?4500:Math.min(1800000,b.radius*b.radius*44))*(Math.exp(-b.age*3.2)+.13*Math.exp(-b.age*.25));}
 getFraming(bodyKind){
  const candidates=this.bursts.filter(b=>(!bodyKind||b.body===bodyKind||(b.attached&&(bodyKind==='booster'||(bodyKind==='capsule'&&!this.lastState?.capsule?.active))))&&!b.small&&b.age<10);if(!candidates.length)return null;const b=candidates[candidates.length-1],grow=1-Math.exp(-b.age*2.6);
  return {center:b.origin.clone().add(V(0,b.radius*(.22+.38*grow),0)),radius:b.radius*(.95+.40*grow),age:b.age,body:b.body,kind:b.kind,grounded:b.grounded};
 }
 getCameraImpulse(camera,bodyKind){
  const result=V();for(const b of this.bursts){if(b.age>8)continue;const distance=camera.position.distanceTo(b.origin),gain=(b.small?.13:b.radius*.024)*Math.exp(-b.age*(b.small?2:1.05))*Math.min(1,b.radius*3/Math.max(1,distance));if(gain<.0001)continue;const phase=b.seed*.0002;result.x+=Math.sin(this.clock*67+phase)*gain;result.y+=Math.sin(this.clock*83+phase*1.3)*gain*.62;result.z+=Math.sin(this.clock*51+phase*.7)*gain*.24;}return result;
 }
 getFlash(camera){return this.bursts.reduce((m,b)=>Math.max(m,Math.exp(-b.age*10)*Math.min(1,b.radius*4/Math.max(1,camera.position.distanceTo(b.origin)))),0)}
 getStats(){return {active:this.bursts.length,large:this.bursts.filter(b=>!b.small).length,flash:this.flash,clock:this.clock,particles:this.fireballs.count+this.fire.count+this.smoke.count+this.embers.count,debris:this.panels.count+this.struts.count,scars:this.craters.length}}
 reset(){this.clock=0;this.bursts=[];this.craters=[];this.seen.clear();this.flash=0;for(const mesh of [this.fireballs,this.fire,this.smoke,this.embers,this.panels,this.struts,this.flashes,this.shocks,this.scorches])mesh.count=0;for(const l of this.lights)l.intensity=0}
 dispose(){this.reset();this.root.removeFromParent();this.resources.forEach(r=>r.dispose?.());this.resources.clear()}
}
window.CinematicFailures=CinematicFailures;
})();
