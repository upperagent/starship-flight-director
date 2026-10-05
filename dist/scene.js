/* STARBASE · Realtime procedural visualization. SI state supplied by simulation.js.
   Starship geometry is an illustrative 120 m configuration; crew cabin is fictional. */
(function () {
'use strict';
const T = window.THREE;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rnd = n => {const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function material(c,metal=.0,rough=.7){return new T.MeshStandardMaterial({color:c,metalness:metal,roughness:rough})}
function canvasTexture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t}
class StarbaseScene {
 constructor(canvas,options={}) {
  this.canvas=canvas;this.mode=options.mode||'pad';this.low=options.quality==='low';this.elapsed=0;this.zoom=1;this.orbit=0;this.elevation=0;this.tracking=true;this.cinematic=false;this.night=false;this.disposed=false;this.lastScreen=-1;this.free=false;this.movement={};this.freePosition=V(-80,1.8,205);this.freeYaw=-.40;this.freePitch=.26;this.cameraReady=false;this.cameraTarget=V();this.lastFeed=-1;this.cameraBody='ship';this.engineView=false;this.quality=options.quality||'medium';this.spaceportView=false;this.adaptiveQualityEnabled=true;this.adaptiveRenderCost=0;this.multiview=false;this.splitLayout=null;this.viewCameras={booster:new T.PerspectiveCamera(42,1,.2,14000000),capsule:new T.PerspectiveCamera(42,1,.2,14000000),ship:new T.PerspectiveCamera(42,1,.2,14000000)};this.performanceStats={views:1,drawCalls:0,triangles:0,renderMs:0,pixelRatio:1};this.adaptiveClock=0;this.adaptiveFrames=0;this.fastClock=0;
  this.renderer=new T.WebGLRenderer({canvas,antialias:options.quality==='high',alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.low?1:this.quality==='high'?1.75:1.25));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
  this.renderer.shadowMap.enabled=!this.low;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene=new T.Scene();this.scene.fog=new T.FogExp2(0xb9a99a,.00045);
  this.camera=new T.PerspectiveCamera(48,1,.08,14000000);
  this.env=canvasTexture(1024,512,(g,w,h)=>{let gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#102d4b');gr.addColorStop(.43,'#88b4c6');gr.addColorStop(.52,'#dfdcc3');gr.addColorStop(.63,'#4a554f');gr.addColorStop(1,'#263138');g.fillStyle=gr;g.fillRect(0,0,w,h);g.fillStyle='#e8efeb';g.fillRect(180,50,85,205);g.fillStyle='#fff2ca';g.fillRect(735,150,30,155);});this.env.mapping=T.EquirectangularReflectionMapping;this.scene.environment=this.env;
  this.hemi=new T.HemisphereLight(0xd5e8f5,0x343c35,2.1);this.scene.add(this.hemi);
  this.sun=new T.DirectionalLight(0xffdcaa,3.1);this.sun.position.set(-240,195,175);this.sun.castShadow=!this.low;this.sun.shadow.mapSize.set(this.low?1024:2048,this.low?1024:2048);Object.assign(this.sun.shadow.camera,{left:-260,right:260,top:220,bottom:-210,near:1,far:760});this.sun.shadow.radius=3;this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.075;this.scene.add(this.sun);this.scene.add(this.sun.target);
  this.rim=new T.DirectionalLight(0xabc3e6,.45);this.rim.position.set(160,80,-100);this.scene.add(this.rim);
  this.materials={steel:material(0xc1c3c5,1,.32),darkSteel:material(0x4a575d,.8,.4),white:material(0xc7cecc,.3,.6),tile:material(0x101920,.38,.8),tower:material(0x4b5352,.73,.58),concrete:material(0x666c65,.05,.98),road:material(0x242d2d,.05,.94),gold:material(0x8d805a,.7,.45),black:material(0x0c151e,.45,.6),cyan:new T.MeshBasicMaterial({color:0x3df2dd}),orange:new T.MeshBasicMaterial({color:0xffa958})};
  this.buildSky();this.prepareMaterials();this.buildGround();this.buildPad();this.buildRecoverySite();this.buildRocket();this.detailRocket();this.buildParticles();this.buildSetDressing();if(window.StarshipInteriors){StarshipInteriors.build(this);}else{this.buildCockpit();this.buildMission();}this.buildCapsule();this.prepareEnvironment();this.post=window.FlightRenderer?new FlightRenderer(this.renderer,{quality:this.quality}):null;this.feedTarget=new T.WebGLRenderTarget(768,432);this.feedCamera=new T.PerspectiveCamera(39,768/432,1,14000000);
  [this.ground,this.pad,this.boosterVisual,this.shipVisual,this.capsule].filter(Boolean).forEach(g=>this.batchTree(g));
  this.spaceport=window.ActiveSpaceport?new ActiveSpaceport(this):null;this.failureFX=window.CinematicFailures?new CinematicFailures(this):null;this.destroyedBodies=new Set();this.cameraShock=true;this.resize();this.bindPointer();this.setView(this.mode);this.update({altitude:0,pitch:90,time:-120,phase:'PREFLIGHT',config:{},systems:{}},0);
 }
 mesh(geo,mat,parent,x=0,y=0,z=0){let m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=!this.low;m.receiveShadow=true;(parent||this.scene).add(m);return m}
 box(w,h,d,mat,parent,x=0,y=0,z=0){return this.mesh(new T.BoxGeometry(w,h,d),mat,parent,x,y,z)}
 cylinder(rt,rb,h,mat,parent,x=0,y=0,z=0,segments=40){return this.mesh(new T.CylinderGeometry(rt,rb,h,segments),mat,parent,x,y,z)}
 bar(a,b,r,mat,parent){let dir=b.clone().sub(a),m=this.cylinder(r,r,dir.length(),mat,parent,0,0,0,6);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(V(0,1,0),dir.normalize());return m}
 ring(r,t,mat,parent,y=0){let m=this.mesh(new T.TorusGeometry(r,t,8,96),mat,parent,0,y,0);m.rotation.x=Math.PI/2;return m}
 textPanel(text,w,h,color='#c7d1d4',bg=null,font=44){return new T.MeshBasicMaterial({map:canvasTexture(512,256,(g,cw,ch)=>{if(bg){g.fillStyle=bg;g.fillRect(0,0,cw,ch)}g.fillStyle=color;g.font=`500 ${font}px Arial`;g.textAlign='center';g.textBaseline='middle';g.fillText(text,cw/2,ch/2)}),transparent:!bg,side:T.DoubleSide})}

 loadPBR(name,rx=1,ry=1){
  this.pbrTextureCache??=new Map();this.pbrSourceCache??=new Map();const key=[name,rx,ry].join('|');if(this.pbrTextureCache.has(key))return this.pbrTextureCache.get(key);
  const loader=new T.TextureLoader(),out={};
  for(const [kind,suffix] of [['color','color'],['normal','normal'],['roughness','roughness']]){
   const path='assets/v2/'+name+'-'+suffix+'.jpg';let source=this.pbrSourceCache.get(path);
   if(!source){source={texture:null,variants:[]};this.pbrSourceCache.set(path,source);source.texture=loader.load(path,()=>{if(this.disposed)return;for(const variant of source.variants)variant.needsUpdate=true;});}
   // Repeats are UV transforms. Share decoded image/source data (and therefore
   // the underlying GPU allocation) while keeping independent repeat uniforms.
   const t=new T.Texture();t.source=source.texture.source;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());if(kind==='color')t.colorSpace=T.SRGBColorSpace;source.variants.push(t);if(source.texture.image)t.needsUpdate=true;out[kind]=t;
  }
  this.pbrTextureCache.set(key,out);return out;
 }
 surfaceMaterial(name,rx,ry,color=0xffffff){const a=this.loadPBR(name,rx,ry);return new T.MeshStandardMaterial({color,map:a.color,normalMap:a.normal,roughnessMap:a.roughness,roughness:1,normalScale:new T.Vector2(.7,.7)});}
 prepareMaterials(){
  const steelMap=canvasTexture(512,2048,(g,w,h)=>{g.fillStyle='#a5a6a3';g.fillRect(0,0,w,h);for(let y=0;y<h;y++){let n=rnd(y+32);g.fillStyle='rgba('+Math.floor(140+n*110)+','+Math.floor(143+n*105)+','+Math.floor(143+n*102)+','+(.04+n*.08)+')';g.fillRect(0,y,w,1);}for(let y=0;y<h;y+=58){let grd=g.createLinearGradient(0,y-4,0,y+5);grd.addColorStop(0,'rgba(90,82,74,0)');grd.addColorStop(.4,'rgba(76,70,65,.15)');grd.addColorStop(.55,'rgba(224,227,225,.23)');grd.addColorStop(1,'rgba(90,82,74,0)');g.fillStyle=grd;g.fillRect(0,y-4,w,10);}for(let i=0;i<600;i++){g.fillStyle='rgba(44,44,40,.035)';g.fillRect(rnd(i+97)*w,rnd(i+47)*h,.5,rnd(i+80)*80);}});steelMap.wrapS=steelMap.wrapT=T.RepeatWrapping;steelMap.anisotropy=8;this.materials.steel.map=steelMap;this.materials.steel.bumpMap=steelMap;this.materials.steel.bumpScale=.007;this.materials.steel.envMapIntensity=1.2;
  this.materials.tower.color.set(0x646768);this.materials.tower.roughness=.65;this.materials.tower.metalness=.65;
  const tile=canvasTexture(512,512,(g,w,h)=>{g.fillStyle='#151617';g.fillRect(0,0,w,h);const rr=17,hx=Math.sqrt(3)*rr;for(let row=-1;row<23;row++)for(let col=-1;col<20;col++){let x=col*hx+(row%2)*hx/2,y=row*rr*1.5,n=Math.floor(29+rnd(row*37+col)*14);g.beginPath();for(let j=0;j<6;j++){let a=j*Math.PI/3+Math.PI/6;let px=x+Math.cos(a)*(rr-.7),py=y+Math.sin(a)*(rr-.7);j?g.lineTo(px,py):g.moveTo(px,py);}g.closePath();g.fillStyle=`rgb(${n},${n+1},${n+2})`;g.fill();g.strokeStyle='rgba(120,124,127,.16)';g.lineWidth=.6;g.stroke();}});tile.wrapS=tile.wrapT=T.RepeatWrapping;tile.repeat.set(2.5,5);tile.anisotropy=8;this.materials.tile.map=tile;this.materials.tile.bumpMap=tile;this.materials.tile.bumpScale=.014;this.materials.tile.color.set(0xffffff);this.materials.tile.metalness=.08;this.materials.tile.roughness=.9;
  const concrete=this.loadPBR('concrete',8,8);this.materials.concrete.map=concrete.color;this.materials.concrete.normalMap=concrete.normal;this.materials.concrete.normalScale=new T.Vector2(.8,.8);this.materials.concrete.color.set(0x9e9a92);const dirty=canvasTexture(512,1024,(g,w,h)=>{g.fillStyle='#a7aca9';g.fillRect(0,0,w,h);for(let i=0;i<750;i++){let x=rnd(i+400)*w,y=rnd(i+5)*h;let gr=g.createLinearGradient(x,y,x,y+40+rnd(i)*200);gr.addColorStop(0,'rgba(45,44,40,.1)');gr.addColorStop(1,'rgba(50,45,40,0)');g.fillStyle=gr;g.fillRect(x,y,1+rnd(i+70)*5,200);}for(let i=0;i<18;i++){g.fillStyle='rgba(120,123,119,.12)';g.fillRect(0,i*57,w,3);}});this.materials.white.map=dirty;this.materials.white.metalness=.15;this.materials.white.roughness=.75;this.materials.white.color.set(0xc2c8c5);
 }
 prepareEnvironment(){
  const loader=new T.TextureLoader();loader.load('assets/v2/sky-sunset-4k.jpg',tex=>{if(this.disposed){tex.dispose();return;}tex.mapping=T.EquirectangularReflectionMapping;tex.colorSpace=T.SRGBColorSpace;if(!this.hdrEnv){this.skyPanorama=tex;this.scene.background=tex;this.scene.backgroundIntensity=.65;}const pm=new T.PMREMGenerator(this.renderer);this.envTarget=pm.fromEquirectangular(tex);if(!this.hdrEnv)this.scene.environment=this.envTarget.texture;pm.dispose();});
  loader.load('assets/v2/earth-color.jpg',tex=>{tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;this.earth.material.dispose();this.earth.material=new T.MeshStandardMaterial({map:tex,roughness:1,metalness:0,envMapIntensity:.05,transparent:false,depthTest:false,depthWrite:false});this.earth.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','#include <opaque_fragment>\nfloat limbCosine=abs(dot(normalize(normal),normalize(vViewPosition)));gl_FragColor.rgb=mix(vec3(.09,.115,.145),gl_FragColor.rgb,smoothstep(.002,.055,limbCosine));');};this.earth.rotation.z=-1.1;this.earth.rotation.y=1.8;});
  if(this.quality==='high')this.loadHDREnvironment();
 }
 loadHDREnvironment(){
  if(!T.RGBELoader||this.hdrRequested)return;this.hdrRequested=true;
  new T.RGBELoader().load('assets/v2/sky-sunset-2k.hdr',tex=>{if(this.disposed){tex.dispose();return;}tex.mapping=T.EquirectangularReflectionMapping;const pm=new T.PMREMGenerator(this.renderer);this.hdrEnv=pm.fromEquirectangular(tex);this.scene.environment=this.hdrEnv.texture;this.skyPanorama=tex;this.scene.background=tex;this.scene.backgroundIntensity=.85;pm.dispose();},undefined,()=>{this.hdrRequested=false;});
 }
 detailRocket(){
  const m=this.materials,brushed=material(0xb9c0c4,1,.23),weld=material(0x64717a,1,.42);brushed.envMapIntensity=1.1;
  for(let y=3;y<69;y+=1.98){this.ring(4.517,.012,weld,this.boosterVisual,y);if(Math.round(y)%4===3){const band=this.cylinder(4.511,4.511,.18,brushed,this.boosterVisual,0,y+.03,0,80);}}
  for(let i=0;i<8;i++){let a=i*Math.PI/4;this.bar(V(Math.sin(a)*4.56,3,Math.cos(a)*4.56),V(Math.sin(a)*4.56,13,Math.cos(a)*4.56),.065,weld,this.boosterVisual);for(let y=3.5;y<13;y+=2){let clip=this.box(.23,.1,.2,brushed,this.boosterVisual,Math.sin(a)*4.6,y,Math.cos(a)*4.6);clip.rotation.y=a;}}
  for(let i=0;i<16;i++){let a=i*Math.PI/8;let rib=this.box(.11,1.25,.16,m.darkSteel,this.boosterVisual,Math.sin(a)*4.55,68.8,Math.cos(a)*4.55);rib.rotation.y=a;}
  for(let y of [16,43,57])for(let a of [.1,2.2,4.3]){const sensor=this.box(.45,.55,.16,brushed,this.boosterVisual,Math.sin(a)*4.57,y,Math.cos(a)*4.57);sensor.rotation.y=a;}
  for(let a of [.25,1.28,4.8]){let duct=new T.Group();duct.rotation.y=a;this.shipVisual.add(duct);this.box(.22,27,.21,brushed,duct,0,16,4.56);for(let y=3;y<30;y+=2)this.box(.35,.09,.24,weld,duct,0,y,4.55);}
  for(let y of [5,31])for(let a of [-.15,Math.PI+.15]){const pod=new T.Group();pod.position.set(Math.sin(a)*4.49,y,Math.cos(a)*4.49);pod.rotation.y=a;this.shipVisual.add(pod);this.box(1.1,.7,.32,brushed,pod,0,0,.1);for(let j=-1;j<2;j++){let thr=this.cylinder(.075,.13,.2,m.black,pod,j*.28,0,.33,12);thr.rotation.x=Math.PI/2;}}
  const boltGeo=new T.SphereGeometry(.055,6,4),boltMat=material(0x74797c,.95,.36),bolts=new T.InstancedMesh(boltGeo,boltMat,432);let dummy=new T.Object3D(),index=0;for(let y of [1.9,2.2,66.6,69.9,71.1,71.8])for(let i=0;i<72;i++){let a=i*Math.PI/36;dummy.position.set(Math.sin(a)*4.53,y,Math.cos(a)*4.53);dummy.updateMatrix();bolts.setMatrixAt(index++,dummy.matrix);}this.boosterVisual.add(bolts);
  for(let fin of this.flaps){const label=this.mesh(new T.PlaneGeometry(.7,.25),this.textPanel('CAUTION',1,.25,'#927961',null,24),fin,1.4,3,.26);}
 }
 buildSetDressing(){
  const m=this.materials;this.siteProps=new T.Group();this.ground.add(this.siteProps);const props=this.siteProps,galv=material(0x838b8e,.82,.51),cream=material(0xd3cbb9,.18,.8),yellow=material(0xc7a139,.18,.7),rubber=material(0x111416,.02,.97);
  // Ground material transitions, tire tracks, concrete joint lines, drainage channels.
  for(let x=-90;x<100;x+=10)for(let z=-90;z<100;z+=10)if(Math.hypot(x,z)<90){this.box(.016,.012,9.95,m.darkSteel,props,x,.035,z);this.box(9.95,.012,.016,m.darkSteel,props,x,.035,z);}
  for(let z of [159.8,180.2]){this.box(630,.14,.38,cream,props,-170,.15,z);this.box(630,.013,.1,yellow,props,-170,.1,z+(z<170?1:-1));}
  for(let x=-260;x<100;x+=38){let patch=this.mesh(new T.PlaneGeometry(7,12),this.surfaceMaterial('asphalt',2,4,0x474b49),props,x,.083,170);patch.rotation.x=-Math.PI/2;}
  // Chain link security fence with Y-barbed posts, galvanized diagonal mesh.
  const fenceTex=canvasTexture(256,256,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle='rgba(143,150,153,.78)';g.lineWidth=2;for(let a=-256;a<512;a+=32){g.beginPath();g.moveTo(a,0);g.lineTo(a+256,256);g.stroke();g.beginPath();g.moveTo(a,0);g.lineTo(a-256,256);g.stroke();}});fenceTex.wrapS=fenceTex.wrapT=T.RepeatWrapping;fenceTex.repeat.set(58,1);const fenceMat=new T.MeshStandardMaterial({map:fenceTex,transparent:true,alphaTest:.1,side:T.DoubleSide,metalness:.7,roughness:.55});let fence=this.mesh(new T.PlaneGeometry(285,3.05),fenceMat,props,-150,1.67,145);fence.castShadow=false;
  for(let x=-290;x<-6;x+=7.5){this.cylinder(.055,.055,3.8,galv,props,x,1.85,145,8);this.bar(V(x,3.4,145),V(x,4,145.35),.027,galv,props);this.box(.16,.16,.16,cream,props,x,.1,145);}for(let y of [.18,3.08,3.65,3.87])this.bar(V(-290,y,145),V(-5,y,145),.018,galv,props);
  // Entry barriers, prominent hazard signage, camera station equipment.
  for(let x of [-85,-66,-47,-28]){let b=this.box(7,1.05,1.1,cream,props,x,.6,184);this.box(7,.15,1.14,yellow,props,x,1.03,184);}let sign=this.mesh(new T.PlaneGeometry(3.5,1.5),this.textPanel('DANGER  •  RESTRICTED AREA',3.5,1.5,'#ddd6c9','#55241e',27),props,-62,2.3,145.04);
  for(let x of [-8,8]){this.cylinder(.13,.18,3.5,yellow,props,x,1.75,145,12);this.box(.22,.22,.08,new T.MeshBasicMaterial({color:0xfa4029}),props,x,3.55,145);}
  // Full-size corrugated fabrication sheds, generators and transformer yard.
  for(let k=0;k<4;k++){const g=new T.Group();props.add(g);g.position.set(-335-k*47,0,-175-k*51);let w=40,h=13,d=70;this.box(w,h,d,cream,g,0,h/2,0);this.box(w+2,.35,d+2,galv,g,0,h+.1,0);for(let x=-w/2;x<=w/2;x+=1.3)this.box(.07,h,.1,galv,g,x,h/2,d/2+.05);for(let z=-d/2;z<d/2;z+=1.3)this.box(.1,h,.06,galv,g,w/2+.05,h/2,z);for(let x of [-12,0,12]){this.box(9,9,.16,m.darkSteel,g,x,4.5,d/2+.15);for(let y=1;y<9;y+=.8)this.box(9,.05,.2,galv,g,x,y,d/2+.21);}}
  for(let i=0;i<13;i++){let x=-195+(i%5)*15,z=-120-Math.floor(i/5)*17;this.box(10,1,7,m.concrete,props,x,.3,z);this.box(8,4.5,5,galv,props,x,2.7,z);for(let j=0;j<8;j++)this.box(.3,3.5,.22,m.darkSteel,props,x-3.3+j*.95,2.6,z+2.62);for(let j=-1;j<=1;j++)this.cylinder(.22,.28,1.5,m.white,props,x+j*2,5.7,z,12);}
  // Pipe racks and service valves carry lines through the industrial landscape.
  for(let z=-86;z<-15;z+=7){this.box(.3,5,.4,galv,props,-58,2.5,z);this.box(.3,5,.4,galv,props,-71,2.5,z);this.box(14,.3,.4,galv,props,-64.5,5,z);}for(let i=0;i<8;i++){this.bar(V(-69+i*1.25,5.4,-90),V(-69+i*1.25,5.4,-5),.22,galv,props);this.bar(V(-69+i*1.25,5.4,-5),V(-25,5.4+i*.28,-5),.21,galv,props);let v=this.ring(.7,.07,yellow,props,3);v.position.set(-67+i*1.25,4,-35);v.rotation.x=0;}
  // Cable spool, containers and equipment stacks alongside the access road.
  for(let k=0;k<9;k++){let x=-240+(k%5)*15,z=109-Math.floor(k/5)*17,mat=k%3===0?material(0x30434c,.35,.75):k%3===1?material(0x847d67,.3,.8):material(0x654435,.35,.8);this.box(12.2,2.6,2.45,mat,props,x,1.3,z);for(let j=0;j<30;j++)this.box(.055,2.4,.07,galv,props,x-5.8+j*.4,1.3,z+1.27);this.box(.06,2.35,2.5,galv,props,x,1.3,z);}
  // Mobile launch-service crane with cable, detailed lattice boom and outriggers.
  const crane=new T.Group();crane.position.set(75,0,-47);props.add(crane);this.box(5.5,2.5,12,yellow,crane,0,2.4,0);this.box(3.8,3,3.8,m.darkSteel,crane,0,4.2,3.4);for(let x of [-3,3])for(let z of [-4,-1,3]){let wheel=this.cylinder(.9,.9,.5,rubber,crane,x,1,z,16);wheel.rotation.z=Math.PI/2;}for(let z of [-4,4])this.box(14,.55,.5,yellow,crane,0,1.4,z);
  const boom=new T.Group();crane.add(boom);boom.position.y=4;boom.rotation.z=-.38;for(let x of [-1,1])for(let z of [-1,1])this.bar(V(x,0,z),V(x,67,z),.12,yellow,boom);for(let y=0;y<66;y+=3)for(let z of [-1,1]){this.bar(V(-1,y,z),V(1,y+3,z),.065,yellow,boom);this.bar(V(1,y,z),V(-1,y+3,z),.065,yellow,boom);}this.bar(V(24,66,0),V(24,10,0),.035,m.darkSteel,crane);this.box(.7,1.4,.5,m.darkSteel,crane,24,9.5,0);
  this.addVehicle(props,-70,0,176,0xaba997,Math.PI/2);this.addVehicle(props,-112,0,190,0xc7c5bd,-.1);this.addVehicle(props,-129,0,194,0x303b3f,-.1);this.addVehicle(props,48,0,81,0xc1b392,.9);
  // Ground scale: small rocks, salt-grass clumps, low coastal scrub.
  const pebbleGeo=new T.IcosahedronGeometry(1,0),pebbleMat=material(0x756b59,0,1),stones=new T.InstancedMesh(pebbleGeo,pebbleMat,this.low?500:1500);const dummy=new T.Object3D();for(let i=0;i<stones.count;i++){let a=rnd(i+201)*Math.PI*2,r=115+rnd(i+43)*300,x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(z-170)<14||Math.abs(x+280)<15){x+=30;z+=25;}dummy.position.set(x,.05,z);dummy.scale.set(.1+rnd(i+5)*.55,.08+rnd(i+9)*.16,.12+rnd(i+16)*.38);dummy.rotation.set(0,rnd(i)*6,0);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);}stones.receiveShadow=true;props.add(stones);
  const grassTex=canvasTexture(256,256,(g,w,h)=>{g.clearRect(0,0,w,h);for(let i=0;i<84;i++){let sx=72+rnd(i+830)*112,sy=250;let ex=12+rnd(i+230)*232,ey=16+rnd(i+124)*172;g.beginPath();g.moveTo(sx,sy);g.quadraticCurveTo(sx+(ex-sx)*.2,ey+55,ex,ey);let tone=Math.floor(75+rnd(i+801)*60);g.strokeStyle=`rgb(${tone},${Math.floor(tone*.98)},${Math.floor(tone*.72)})`;g.lineWidth=1+rnd(i+184)*2.6;g.stroke();if(i%4===0){g.beginPath();g.moveTo(ex,ey+25);g.lineTo(ex+8,ey+6);g.stroke();}}});let grassGeo=new T.BufferGeometry(),verts=[],uvs=[];for(let j=0;j<3;j++){let a=j*Math.PI/3,x=Math.cos(a)*.65,z=Math.sin(a)*.65;verts.push(-x,0,-z,x,0,z,x,1.1,z,-x,0,-z,x,1.1,z,-x,1.1,-z);uvs.push(0,0,1,0,1,1,0,0,1,1,0,1);}grassGeo.setAttribute('position',new T.Float32BufferAttribute(verts,3));grassGeo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));grassGeo.computeVertexNormals();let grass=new T.InstancedMesh(grassGeo,new T.MeshStandardMaterial({map:grassTex,alphaTest:.2,roughness:1,side:T.DoubleSide}),this.low?1000:3200);for(let i=0;i<grass.count;i++){let a=rnd(i+2200)*Math.PI*2,r=117+rnd(i+654)*650,x=Math.sin(a)*r,z=Math.cos(a)*r;if(x>450||Math.abs(z-170)<15||Math.abs(x+280)<15||Math.hypot(x+360,z)<65){x=-Math.abs(x)-90;z+=80;}dummy.position.set(x,Math.max(0,Math.sin(x*.009)*Math.cos(z*.008)*2.5+Math.sin(x*.024+z*.006)*.8)*clamp((r-200)/280,0,1)-.25,z);let size=.5+rnd(i+17)*1.1;dummy.scale.set(size,size,size);dummy.rotation.y=rnd(i+27)*6;dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);}grass.receiveShadow=true;props.add(grass);
  // More functional pad structure: thick water downcomers, walkways, handrails and access stair.
  for(let a of [0,1.5,3,4.5]){this.bar(V(Math.sin(a)*16,1,Math.cos(a)*16),V(Math.sin(a)*11,13,Math.cos(a)*11),.44,m.steel,this.pad);}
  for(let y=5;y<145;y+=8){this.box(1.4,.15,4,galv,this.tower,7.4,y,0);this.bar(V(8,y,-2),V(8,y+8,2),.1,galv,this.tower);for(let j=0;j<12;j++)this.box(1.2,.08,.4,galv,this.tower,7.4,y+j*.66,-2+j*.33);}
  this.siteLights=[];for(let a=0;a<4;a++){let angle=a*Math.PI/2;let light=new T.SpotLight(0xffdec0,0,270,.8,.7,1.3);light.position.set(Math.sin(angle)*65,20,Math.cos(angle)*65);light.target.position.set(0,38,0);this.scene.add(light,light.target);this.siteLights.push(light);}
  // Production-scale water deluge tanks visible behind the tower.
  for(let j=0;j<3;j++){let x=106+j*20,z=-95;this.cylinder(8,8,18,cream,props,x,9,z,48);this.cylinder(7.9,8,.65,galv,props,x,18.3,z,48);this.ring(8,.04,m.darkSteel,props,18).position.set(x,18,z);}
 }
 addVehicle(parent,x,y,z,color,rotation){const g=new T.Group();parent.add(g);g.position.set(x,y,z);g.rotation.y=rotation;const paint=material(color,.5,.3),glass=new T.MeshPhysicalMaterial({color:0x1a2e3a,metalness:.35,roughness:.08,clearcoat:1});this.box(2.2,.75,5.2,paint,g,0,.95,0);this.box(2.12,.95,2.4,paint,g,0,1.7,.45);this.box(1.9,.6,.06,glass,g,0,1.84,1.69);this.box(1.9,.5,.06,glass,g,0,1.84,-.78);for(let side of [-1,1]){this.box(.045,.6,1.95,glass,g,side*1.075,1.84,.45);this.box(.23,.13,.3,paint,g,side*1.22,1.56,1.4);for(let zz of [-1.65,1.65]){let w=this.cylinder(.49,.49,.31,this.materials.black,g,side*1.04,.49,zz,24);w.rotation.z=Math.PI/2;let hub=this.cylinder(.24,.24,.325,this.materials.steel,g,side*1.04,.49,zz,16);hub.rotation.z=Math.PI/2;}}this.box(1.45,.35,.06,this.materials.black,g,0,.95,2.65);for(let xx of [-.8,.8])this.box(.4,.23,.08,new T.MeshBasicMaterial({color:0xcce3e4}),g,xx,1.1,2.67);this.box(2,.18,.1,this.materials.steel,g,0,.58,2.66);this.batchStatic(g);}
 buildSky(){
  this.skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{height:{value:0},night:{value:0},time:{value:0},cloud:{value:.25}},vertexShader:'varying vec3 vWorld; void main(){vWorld=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`
   varying vec3 vWorld; uniform float height; uniform float night;uniform float time;uniform float cloud;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
   float fbm(vec2 p){return noise(p)*.53+noise(p*2.1)*.25+noise(p*4.3)*.125+noise(p*8.5)*.06;}
   void main(){vec3 d=normalize(vWorld);float dip=sqrt(max(height,0.)*2./6371000.);float h=max((d.y+dip)/(1.+dip),0.);float space=smoothstep(7000.,48000.,height);vec3 top=mix(vec3(.055,.15,.26),vec3(.0006,.0012,.0035),max(space,night*.87));vec3 horizon=mix(vec3(.67,.62,.57),vec3(.025,.12,.28),smoothstep(6500.,27000.,height));horizon*=1.-space*.72;horizon=mix(horizon,vec3(.001,.003,.009),night*.84);vec3 col=mix(horizon,top,pow(h,.44));float limbGlow=exp(-pow((d.y+dip)/.04,2.))*smoothstep(12000.,42000.,height);col+=vec3(.015,.065,.16)*limbGlow*(1.-night*.8);
   float sun=pow(max(dot(d,normalize(vec3(-.65,.28,.65))),0.),400.);float glow=pow(max(dot(d,normalize(vec3(-.65,.28,.65))),0.),8.);col+=vec3(1.,.64,.29)*(sun*.9+glow*.16)*(1.-space)*(1.-night);
   if(d.y>.03){vec2 uv=d.xz/(d.y+.18)*2.1+vec2(time*.0004,0.);float c=smoothstep(.52-cloud*.18,.78,fbm(uv));col=mix(col,vec3(.75,.78,.75),c*.45*(1.-smoothstep(5000.,22000.,height))*(1.-night*.7));}
   vec2 p=floor(d.xz*1000./(abs(d.y)+.1));float stars=step(.9987,hash(p))*pow(hash(p+10.),8.)*smoothstep(.03,.5,d.y);col+=stars*max(space,night*.7);gl_FragColor=vec4(col,1.);}`});
  this.sky=this.mesh(new T.SphereGeometry(1000000,32,18),this.skyMaterial);this.sky.castShadow=false;this.sky.receiveShadow=false;this.sky.frustumCulled=false;this.sky.renderOrder=-100;
 }
 buildGround(){
  this.ground=new T.Group();this.scene.add(this.ground);
  const tex=this.loadPBR('gravel',2600/2.3,2600/2.3);let landGeo=new T.PlaneGeometry(2600,2600,180,180);let pos=landGeo.attributes.position;let colors=[];
  for(let i=0;i<pos.count;i++){let x=pos.getX(i),z=-pos.getY(i),dist=Math.hypot(x,z);let coast=460+Math.sin(z*.0025)*110+Math.sin(z*.011)*22;let h=x>coast?-7:Math.max(0,Math.sin(x*.009)*Math.cos(z*.008)*2.5+Math.sin(x*.024+z*.006)*.8);h*=clamp((dist-200)/280,0,1)*clamp((Math.hypot(x+360,z)-42)/32,0,1)*clamp((Math.abs(z)-75)/100,0,1);pos.setZ(i,h-.4);let n=rnd(Math.floor(x/35)*83+Math.floor(z/35)),c=new T.Color().setRGB(.48+n*.20,.43+n*.18,.32+n*.16);colors.push(c.r,c.g,c.b);}landGeo.setAttribute('color',new T.Float32BufferAttribute(colors,3));landGeo.computeVertexNormals();let land=this.mesh(landGeo,new T.MeshStandardMaterial({map:tex.color,normalMap:tex.normal,roughnessMap:tex.roughness,normalScale:new T.Vector2(.6,.6),roughness:1,vertexColors:true}),this.ground);land.rotation.x=-Math.PI/2;this.landSurface=land;
  this.oceanMat=new T.ShaderMaterial({extensions:{derivatives:true},transparent:true,depthWrite:false,uniforms:{time:{value:0},night:{value:0},opacity:{value:1}},vertexShader:'varying vec3 p;varying vec3 world;void main(){p=position;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 p;varying vec3 world;uniform float time;uniform float night;uniform float opacity;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){float broad=noise(p.xy*.0007);float footprint=max(fwidth(p.x),fwidth(p.y));float detail=1.-smoothstep(2.,25.,footprint);float ripple=noise(p.xy*.025+vec2(time*.08,0.))*detail;vec3 c=mix(vec3(.055,.14,.18),vec3(.12,.25,.28),broad*.6+ripple*.4);float fog=1.-exp(-length(cameraPosition-world)*.000065);c=mix(c,vec3(.67,.62,.57),fog*.92);c*=1.-night*.8;gl_FragColor=vec4(c,opacity);}`});let ocean=this.mesh(new T.PlaneGeometry(16000,16000),this.oceanMat,this.ground,0,-2,0);ocean.rotation.x=-Math.PI/2;ocean.receiveShadow=false;this.oceanSurface=ocean;ocean.renderOrder=-60;
  // The dynamics use a solid altitude-zero recovery surface. Continue that surface
  // along the downrange axis so an escape cannot visibly stop above decorative water.
  // Avoid a continent-wide triangle crossing the near plane: its float depth
  // interpolation can cover the small landing pad despite correct world heights.
  // Local cells are 100 m across; distant wings grow gradually. This remains one draw.
  const corridorColumns=[-1000000,-500000,-250000,-100000,-50000,-20000,-10000];for(let x=-5000;x<=5000;x+=100)corridorColumns.push(x);corridorColumns.push(10000,20000,50000,100000,250000,500000,1000000);
  const corridorGeo=new T.PlaneGeometry(2000000,1800,corridorColumns.length-1,12),corridorPositions=corridorGeo.attributes.position,corridorUV=corridorGeo.attributes.uv;
  for(let i=0;i<corridorPositions.count;i++){const x=corridorColumns[i%corridorColumns.length],y=corridorPositions.getY(i);corridorPositions.setX(i,x);corridorUV.setXY(i,x/3,y/3);}corridorGeo.computeBoundingSphere();
  this.recoveryTerrain=this.mesh(corridorGeo,this.surfaceMaterial('gravel',1,1,0x99947c),this.ground,0,0,0);this.recoveryTerrain.rotation.x=-Math.PI/2;
  const roadMat=this.surfaceMaterial('asphalt',140,6,0x696461);const road=this.mesh(new T.PlaneGeometry(660,18),roadMat,this.ground,-170,.06,170);road.rotation.x=-Math.PI/2;let road2=this.mesh(new T.PlaneGeometry(18,800),this.surfaceMaterial('asphalt',6,266,0x696461),this.ground,-280,.05,-220);road2.rotation.x=-Math.PI/2;
  for(let i=0;i<22;i++)this.box(7,.05,.22,this.materials.white,this.ground,-450+i*27,.09,170);
  this.mesh(new T.CircleGeometry(103,128),this.surfaceMaterial('concrete',68,68,0xb8b2a6),this.ground,0,.02,0).rotation.x=-Math.PI/2;
  const mark=new T.MeshBasicMaterial({color:0xbab8a0});for(let j=0;j<4;j++){let ring=this.ring(26+j*.45,.08,mark,this.ground,.4);ring.rotation.z=0}
  for(let j=0;j<24;j++){let a=j*Math.PI/12;this.box(.22,.04,10,mark,this.ground,Math.sin(a)*93,.4,Math.cos(a)*93).rotation.y=a;}
  // Large tanks and process equipment in the tank farm.
  this.tankFarm=new T.Group();this.ground.add(this.tankFarm);
  for(let i=0;i<7;i++){let x=-93-(i%4)*17,z=-64-Math.floor(i/4)*24;this.cylinder(6,6,30,this.materials.white,this.tankFarm,x,15,z);this.mesh(new T.SphereGeometry(6,24,12,0,Math.PI*2,0,Math.PI/2),this.materials.white,this.tankFarm,x,30,z).scale.y=.28;for(let y=3;y<30;y+=6){let r=this.ring(6.05,.07,this.materials.darkSteel,this.tankFarm,y);r.position.x=x;r.position.z=z;}this.bar(V(x+6.3,1,z),V(x+6.3,31,z),.13,this.materials.darkSteel,this.tankFarm);for(let y=2;y<29;y+=1.5)this.bar(V(x+6.25,y,z-.7),V(x+6.25,y,z+.7),.045,this.materials.darkSteel,this.tankFarm);}
  for(let i=0;i<5;i++){let tank=this.cylinder(5.5,5.5,18,this.materials.white,this.ground,-135+i*22,5,-142);tank.rotation.z=Math.PI/2;this.box(24,1.5,12,this.materials.concrete,this.ground,-135+i*22,.75,-142)}
  this.box(54,11,28,this.materials.white,this.ground,-193,5.5,-23);this.box(58,.8,31,this.materials.darkSteel,this.ground,-193,11.2,-23);
  for(let i=0;i<8;i++)this.box(5,4,.1,this.materials.darkSteel,this.ground,-216+i*6.5,4,-8.8);
  // Pipes trace from tank farm to the launch mount.
  for(let i=0;i<7;i++){this.bar(V(-145,1.7+i*.5,-40),V(-42,1.7+i*.5,-40),.2,this.materials.steel,this.ground);this.bar(V(-42,1.7+i*.5,-40),V(-18,1.7+i*.5,-5),.2,this.materials.steel,this.ground)}
  for(let i=0;i<8;i++){let a=i*Math.PI/4,x=Math.sin(a)*82,z=Math.cos(a)*82;this.cylinder(.21,.4,19,this.materials.darkSteel,this.ground,x,9.5,z,8);this.box(3.5,.6,.8,this.materials.darkSteel,this.ground,x,19,z);this.box(3,.2,.3,new T.MeshBasicMaterial({color:0xffdfaa}),this.ground,x,18.7,z+.4);}
  // Concrete service barriers and vehicles establish scale.
  for(let i=0;i<10;i++){this.box(6,1.2,1,this.materials.white,this.ground,-50+i*11,.65,104);}
  for(let i=0;i<3;i++){let g=new T.Group();g.position.set(-170+i*13,0,93);this.ground.add(g);this.box(3.6,2.2,6.3,this.materials.white,g,0,1.9,0);this.box(3.2,1.5,2.2,this.materials.darkSteel,g,0,2.2,2.8);for(let x of [-1.7,1.7])for(let z of [-2,2]){let wheel=this.cylinder(.65,.65,.35,this.materials.black,g,x,.7,z,12);wheel.rotation.z=Math.PI/2;}}
  // Curved Earth is introduced only above the lower atmosphere.
  this.earth=this.mesh(new T.SphereGeometry(6371000,256,192),new T.ShaderMaterial({vertexShader:'varying vec3 vN;varying vec3 vP;void main(){vN=normal;vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vN;varying vec3 vP;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){return .53*noise(p)+.25*noise(p*2.1)+.125*noise(p*4.3)+.06*noise(p*8.7);}void main(){vec3 n=normalize(vN);vec2 uv=vec2(atan(n.z,n.x),asin(n.y))*vec2(3.,5.);float continent=fbm(uv*3.+vec2(14.,6.));float land=smoothstep(.5,.535,continent);vec3 ocean=mix(vec3(.015,.075,.12),vec3(.035,.17,.21),noise(uv*42.));vec3 earth=mix(vec3(.15,.19,.10),vec3(.37,.29,.17),fbm(uv*14.));vec3 c=mix(ocean,earth,land);float cloud=smoothstep(.55,.75,fbm(uv*18.+vec2(fbm(uv*7.),0.)));c=mix(c,vec3(.81,.85,.84),cloud*.88);float light=.55+.45*max(dot(n,normalize(vec3(-.5,1.,.6))),0.);gl_FragColor=vec4(c*light,1.);}`}),null,0,-6371025,0);this.earth.visible=false;this.earth.castShadow=false;this.earth.receiveShadow=false;this.earth.renderOrder=-90;this.earth.material.depthTest=false;this.earth.material.depthWrite=false;
  this.atmosphere=this.mesh(new T.SphereGeometry(6396000,80,48),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.FrontSide,vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 w=modelMatrix*vec4(position,1.);n=normalize(mat3(modelMatrix)*normal);v=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}',fragmentShader:'varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),5.);gl_FragColor=vec4(.13,.4,.78,rim*.66);}' }),null,0,-6371025,0);this.atmosphere.visible=false;this.atmosphere.castShadow=false;this.atmosphere.receiveShadow=false;this.atmosphere.renderOrder=-80;this.atmosphere.material.depthTest=true;this.atmosphere.material.depthWrite=false;
 }
 buildPad(){
  const m=this.materials;this.pad=new T.Group();this.scene.add(this.pad);
  this.cylinder(12,15,4,m.darkSteel,this.pad,0,12,0,40);this.cylinder(10.5,10.5,.45,m.steel,this.pad,0,14.2,0,48);
  for(let i=0;i<6;i++){let a=i*Math.PI/3;this.bar(V(Math.sin(a)*15,0,Math.cos(a)*15),V(Math.sin(a)*10,12,Math.cos(a)*10),1.1,m.tower,this.pad);this.box(5,1,5,m.concrete,this.pad,Math.sin(a)*15,.5,Math.cos(a)*15);}
  this.ring(12.4,.22,m.white,this.pad,14.5);
  for(let i=0;i<24;i++){let a=i*Math.PI/12;this.bar(V(Math.sin(a)*12.4,13,Math.cos(a)*12.4),V(Math.sin(a)*12.4,15.4,Math.cos(a)*12.4),.08,m.steel,this.pad)}this.ring(12.4,.07,m.steel,this.pad,15.4);
  this.box(14,1,58,m.darkSteel,this.pad,0,.25,36);
  this.tower=new T.Group();this.tower.position.set(25,0,-15);this.pad.add(this.tower);
  const size=12,top=147;
  for(let x of [-size/2,size/2])for(let z of [-size/2,size/2])this.box(1.35,top,1.35,m.tower,this.tower,x,top/2,z);
  this.box(4.2,top-3,4.2,m.darkSteel,this.tower,0,(top-3)/2,-1.5);
  for(let y=6;y<top;y+=8){
   this.box(size+2,.6,size+2,m.tower,this.tower,0,y,0);
   for(let s of [-1,1]){this.bar(V(-6,y,s*6),V(6,y+8,s*6),.21,m.tower,this.tower);this.bar(V(6,y,s*6),V(-6,y+8,s*6),.21,m.tower,this.tower);this.bar(V(s*6,y,-6),V(s*6,y+8,6),.21,m.tower,this.tower);}
   this.box(1.3,2.5,.1,new T.MeshBasicMaterial({color:0xc5b180}),this.tower,0,y+3,1);
   if(y%16===6){for(let side of [-1,1])this.bar(V(-7,y+1,side*7),V(7,y+1,side*7),.055,m.white,this.tower);}
  }
  this.box(16,3,16,m.darkSteel,this.tower,0,148,0);this.box(4,4,5,m.white,this.tower,2,151,0);
  this.bar(V(0,150,0),V(0,166,0),.14,m.steel,this.tower);
  let beaconMat=new T.MeshBasicMaterial({color:0xff5140});this.beacons=[];for(let y of [60,110,153,166])this.beacons.push(this.mesh(new T.SphereGeometry(.35,8,6),beaconMat,this.tower,0,y,1));
  this.arms=new T.Group();this.tower.add(this.arms);this.catchArms=[];
  for(let side of [-1,1]){const arm=new T.Group();arm.position.set(-5,80,15);arm.userData.side=side;this.arms.add(arm);this.catchArms.push(arm);this.box(24,1.4,1.8,m.tower,arm,-12,0,side*5);this.bar(V(-1,8,side*5),V(-23,0,side*5),.32,m.tower,arm);this.box(3,.7,2.5,m.darkSteel,arm,-23,.9,side*5);for(let x=-2;x>-24;x-=3)this.bar(V(x,0,side*4.2),V(x-3,0,side*5.8),.1,m.steel,arm);this.box(3,.1,1.4,m.gold,arm,-23,1.3,side*5);arm.rotation.y=side*.42;}
  this.box(23,1.5,2.5,m.darkSteel,this.tower,-14,112,0);this.bar(V(-3,120,0),V(-25,112,0),.22,m.white,this.tower);
  let sign=this.mesh(new T.PlaneGeometry(7.5,3.75),this.textPanel('STARBASE',7.5,3.75,'#dae2e2','#253035',45),this.tower,0,137,7.1);
  // Fire suppression ring and water tower.
  this.ring(20,.55,m.steel,this.pad,1.8);for(let i=0;i<12;i++){let a=i*Math.PI/6;this.bar(V(Math.sin(a)*20,1.8,Math.cos(a)*20),V(Math.sin(a)*14,4,Math.cos(a)*14),.23,m.steel,this.pad)}
 }
 buildRocket(){
  const m=this.materials;this.vehicle=new T.Group();this.scene.add(this.vehicle);this.boosterVisual=new T.Group();this.vehicle.add(this.boosterVisual);this.shipVisual=new T.Group();this.vehicle.add(this.shipVisual);this.shipVisual.position.y=71;this.shipVisual.rotation.y=-.6;
  this.cylinder(4.5,4.5,69,m.steel,this.boosterVisual,0,35.5,0,64);this.mesh(new T.CylinderGeometry(4.45,4.7,2.5,64,1,true),m.darkSteel,this.boosterVisual,0,1.25,0);
  for(let i=0;i<35;i++)this.ring(4.526,.012,m.darkSteel,this.boosterVisual,2+i*2);
  for(let i=0;i<12;i++){let a=i*Math.PI/6;this.box(.06,58,.12,m.darkSteel,this.boosterVisual,Math.sin(a)*4.51,35,Math.cos(a)*4.51).rotation.y=a;}
  this.cylinder(4.5,4.5,1.5,m.darkSteel,this.boosterVisual,0,70.5,0);for(let i=0;i<32;i++){let a=i*Math.PI/16;this.box(.1,1.4,.25,m.steel,this.boosterVisual,Math.sin(a)*4.53,70.5,Math.cos(a)*4.53).rotation.y=a;}
  // Four open-grid titanium fins.
  for(let i=0;i<4;i++){let a=i*Math.PI/2+.3,g=new T.Group();g.position.set(Math.sin(a)*4.3,64.8,Math.cos(a)*4.3);g.rotation.y=a;this.boosterVisual.add(g);this.box(3.5,.23,4.4,m.darkSteel,g,0,0,2);for(let k=0;k<7;k++){this.box(.09,.7,4.2,m.steel,g,-1.6+k*.54,.28,2);this.box(3.4,.7,.08,m.steel,g,0,.28,.2+k*.6);}}
  // Thirty-three individually modelled Raptor bells: 3 gimballed, 10 middle, 20 outer.
  this.boosterEngines=[];for(const [n,r] of [[3,.72],[10,1.91],[20,3.59]])for(let i=0;i<n;i++){let a=i*Math.PI*2/n+(n===10?.12:0);this.boosterEngines.push(this.buildEngine(this.boosterVisual,Math.sin(a)*r,Math.cos(a)*r,.47,1.28,.1));}
  this.boosterLegs=[];for(let i=0;i<4;i++){let a=i*Math.PI/2+.6,g=new T.Group();g.position.set(Math.sin(a)*4.4,.95,Math.cos(a)*4.4);g.rotation.y=a;this.boosterVisual.add(g);this.boosterLegs.push(g);this.bar(V(0,0,0),V(0,-1.35,4),.18,m.darkSteel,g);this.bar(V(0,2.5,0),V(0,-1.35,4),.12,m.steel,g);this.box(1.6,.3,1.5,m.darkSteel,g,0,-1.45,4);g.visible=false;}

  for(let i=0;i<3;i++){let a=i*Math.PI*2/3;this.box(.25,38,.28,m.steel,this.boosterVisual,Math.sin(a)*4.65,30,Math.cos(a)*4.65).rotation.y=a;}
  const profile=[V(4.5,0),V(4.5,30),V(4.4,33),V(4.12,36),V(3.66,39),V(3.03,42),V(2.3,45),V(1.45,47.7),V(.58,49.3),V(.04,50.2)].map(p=>new T.Vector2(p.x,p.y));
  this.mesh(new T.LatheGeometry(profile,64),m.steel,this.shipVisual);
  this.mesh(new T.LatheGeometry(profile.map(p=>new T.Vector2(p.x+.026,p.y)),64,Math.PI*.5,Math.PI),m.tile,this.shipVisual);
  for(let y=1.4;y<34;y+=1.7)this.ring(4.53,.012,m.darkSteel,this.shipVisual,y);
  // Hexagonal tile impression across the windward half.
  let tileGeo=new T.BufferGeometry(),tileVerts=[];for(let y=2;y<31;y+=.95){for(let j=0;j<=17;j++){let a=Math.PI/2+j*Math.PI/17+(Math.round(y)%2)*.028;let b=a+.056;tileVerts.push(Math.sin(a)*4.532,y,Math.cos(a)*4.532,Math.sin(b)*4.532,y+.45,Math.cos(b)*4.532)}}tileGeo.setAttribute('position',new T.Float32BufferAttribute(tileVerts,3));this.shipVisual.add(new T.LineSegments(tileGeo,new T.LineBasicMaterial({color:0x35424b,transparent:true,opacity:.35})));
  const flap=(a,y,scale)=>{let s=new T.Shape();s.moveTo(0,0);s.lineTo(4.8*scale,2.3*scale);s.lineTo(4.7*scale,7.1*scale);s.lineTo(0,9.7*scale);let geo=new T.ExtrudeGeometry(s,{depth:.22,bevelEnabled:true,bevelSize:.08,bevelThickness:.08,bevelSegments:1,steps:1});let fin=this.mesh(geo,m.tile,this.shipVisual);fin.position.set(Math.cos(a)*4.1,y,Math.sin(a)*4.1);fin.rotation.y=-a;return fin};
  this.flaps=[flap(0,2,1.05),flap(Math.PI,2,1.05),flap(0,33,.72),flap(Math.PI,33,.72)];
  this.shipEngines=[];for(let i=0;i<3;i++){let a=i*Math.PI*2/3;this.shipEngines.push(this.buildEngine(this.shipVisual,Math.sin(a)*1.1,Math.cos(a)*1.1,.62,1.65,-.15));}for(let i=0;i<3;i++){let a=i*Math.PI*2/3+Math.PI/3;this.shipEngines.push(this.buildEngine(this.shipVisual,Math.sin(a)*2.7,Math.cos(a)*2.7,1.08,2.15,-.25));}
  for(let side of [-1,1])this.bar(V(0,5,side*4.2),V(0,5,side*5.4),.22,m.steel,this.shipVisual);
  let decal=this.mesh(new T.PlaneGeometry(3,8),this.textPanel('S 3 3',3,8,'#1b2b34',null,74),this.shipVisual,0,24,4.53);decal.rotation.z=-Math.PI/2;
  let flag=this.mesh(new T.PlaneGeometry(2,1.1),new T.MeshBasicMaterial({map:canvasTexture(128,64,(g,w,h)=>{for(let i=0;i<13;i++){g.fillStyle=i%2?'#dbe1df':'#733e3b';g.fillRect(0,i*h/13,w,h/13+1)}g.fillStyle='#2b4353';g.fillRect(0,0,55,35);g.fillStyle='#cfdedc';for(let i=0;i<25;i++)g.fillRect(5+(i%5)*10,4+Math.floor(i/5)*6,2,2)})}),this.shipVisual,0,29,4.54);
  this.shipOriginal=this.shipVisual.position.clone();
  this.boosterFlame=this.makeFlame(4.2,60,this.boosterVisual,-11);this.shipFlame=this.makeFlame(2.5,42,this.shipVisual,-9);this.launchLight=new T.PointLight(0xffa041,0,190,1.2);this.vehicle.add(this.launchLight);this.launchLight.position.y=2;this.engineInspectionLight=new T.PointLight(0xd5e7ff,0,50,1.6);this.scene.add(this.engineInspectionLight);this.capsuleLight=new T.PointLight(0xffb364,0,100,1.6);this.scene.add(this.capsuleLight);this.boosterReturnLight=new T.PointLight(0xffa85b,0,200,1.6);this.scene.add(this.boosterReturnLight);
 }

 buildEngine(parent,x,z,r,h,y){
  const group=new T.Group();group.position.set(x,y,z);parent.add(group);const steel=material(0x616974,.96,.28),inside=material(0x202833,.82,.44),lip=material(0xafbec8,.94,.23);
  const points=[[.31*r,h*.75],[.33*r,h*.43],[.48*r,h*.15],[.74*r,-h*.22],[r,-h*.55],[r*.91,-h*.55],[r*.68,-h*.21],[r*.43,h*.15],[r*.26,h*.43]].map(p=>new T.Vector2(...p));
  const bell=this.mesh(new T.LatheGeometry(points,32),steel,group);bell.material.side=T.DoubleSide;this.ring(r*.965,.033,lip,group,-h*.55);for(let j=0;j<3;j++)this.ring(r*(.45+j*.16),.013,inside,group,h*.14-j*h*.18);
  const throatMat=new T.MeshStandardMaterial({color:0x080b10,emissive:0x000000,metalness:.3,roughness:.5});const throat=this.cylinder(r*.27,r*.27,.018,throatMat,group,0,h*.45,0,24);
  this.cylinder(r*.32,r*.32,.35,inside,group,0,h*.78,0,16);for(let side of [-1,1])this.bar(V(side*r*.4,h*.77,0),V(side*r*.7,h*.17,0),.045,lip,group);
  const flame=this.makeFlame(r*.80,10+r*4,group,-h*.58);flame.children[1].material.opacity=.43;
  return {group,flame,throat:throatMat,radius:r};
 }
 buildRecoverySite(){
  const m=this.materials;const bias=(mat,units)=>Object.assign(mat,{polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:units}),landingConcrete=bias(m.concrete.clone(),-2),landingPaint=bias(m.white.clone(),-6);this.landingSite=new T.Group();this.ground.add(this.landingSite);this.landingSite.position.x=-360;
  // The flush slab was less than one depth step above the large recovery terrain.
  // Separate its paint layers in depth without moving the physical touchdown surface.
  this.cylinder(38,39,.5,landingConcrete,this.landingSite,0,-.25,0,96);const deck=bias(material(0x303a3b,.05,.96),-4);this.cylinder(31,31,.035,deck,this.landingSite,0,.018,0,96);
  for(const r of [28,30.5])this.ring(r,.14,landingPaint,this.landingSite,.06);const label=this.mesh(new T.PlaneGeometry(23,23),this.textPanel('LZ — 1',23,23,'#ced2bf',null,66),this.landingSite,0,.05,0);label.rotation.x=-Math.PI/2;bias(label.material,-8);
  for(let a=0;a<Math.PI*2;a+=Math.PI/8){this.box(.35,.06,3,landingPaint,this.landingSite,Math.sin(a)*33,.055,Math.cos(a)*33).rotation.y=a;this.cylinder(.16,.2,.4,m.darkSteel,this.landingSite,Math.sin(a)*36,.2,Math.cos(a)*36,8);this.mesh(new T.SphereGeometry(.16,8,6),m.cyan,this.landingSite,Math.sin(a)*36,.43,Math.cos(a)*36);}
  for(let z of [-10,10])this.box(22,.04,.14,landingPaint,this.landingSite,0,.045,z);for(let x of [-10,10])this.box(.14,.04,22,landingPaint,this.landingSite,x,.045,0);
  this.landingBeacon=new T.PointLight(0x62e7c4,0,100,1.7);this.landingBeacon.position.set(-360,4,0);this.scene.add(this.landingBeacon);
 }

 makeFlame(radius,len,parent,y){
  let g=new T.Group();g.position.y=y;parent.add(g);let geo=new T.ConeGeometry(radius,len,40,20,true);geo.translate(0,len*.5,0);geo.rotateZ(Math.PI);
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{time:{value:0},strength:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float time;uniform float strength;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){float d=1.-vUv.y;float turbulent=noise(vec2(vUv.x*29.,vUv.y*9.+time*13.))*.4+noise(vec2(vUv.x*17.,vUv.y*31.+time*22.))*.6;float rim=pow(max(0.,sin(vUv.x*3.14159)),.3);float mach=pow(max(0.,cos(vUv.y*70.+time*8.)),12.)*smoothstep(.3,.95,d);float alpha=pow(d,.5)*(.38+turbulent*.7)*strength*rim;vec3 c=mix(vec3(3.2,.24,.025),vec3(2.7,1.5,.65),pow(d,1.8));c=mix(c,vec3(2.5,3.8,7.),pow(d,14.));c+=vec3(5.,4.1,2.8)*mach*.4;gl_FragColor=vec4(c,alpha*.75);}`});let outer=this.mesh(geo,mat,g);outer.castShadow=false;outer.receiveShadow=false;
  let core=this.mesh(geo,new T.MeshBasicMaterial({color:new T.Color(7,5.5,3.5),transparent:true,opacity:.72,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide}),g);core.scale.set(.47,.62,.47);core.castShadow=false;core.receiveShadow=false;g.visible=false;g.userData={material:mat,length:len};return g;
 }
 buildParticles(){
  this.glowTexture=canvasTexture(128,128,(g,w,h)=>{let gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,.8)');gr.addColorStop(.15,'rgba(255,255,255,.4)');gr.addColorStop(.55,'rgba(255,255,255,.08)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h)});
  this.particleTexture=canvasTexture(256,256,(g,w,h)=>{const im=g.createImageData(w,h);function hash(x,y){return rnd(x*137+y*293);}function n(x,y){let a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;}for(let y=0;y<h;y++)for(let x=0;x<w;x++){let dx=(x-128)/128,dy=(y-128)/128;let noise=n(x/65,y/65)*.45+n(x/28,y/28)*.30+n(x/12,y/12)*.17+n(x/5,y/5)*.08;let mask=clamp((1-Math.hypot(dx,dy)*.96-noise*.2)*3,0,1);mask=mask*mask*(3-2*mask);let bright=clamp(.6+noise*.38-dy*.1-dx*.08,.35,1);let i=(y*w+x)*4;im.data[i]=255*bright;im.data[i+1]=252*bright;im.data[i+2]=244*bright;im.data[i+3]=255*mask*clamp((noise-.17)*2,0,1);}g.putImageData(im,0,0);});
  for(const flame of [this.boosterFlame,this.shipFlame])for(let i=0;i<6;i++){const glow=new T.Sprite(new T.SpriteMaterial({map:this.glowTexture,color:i<2?new T.Color(1.2,1.9,3.7):new T.Color(2.6,.55,.12),transparent:true,opacity:.33-i*.04,depthWrite:false,blending:T.AdditiveBlending}));glow.position.y=-3-i*flame.userData.length/8;glow.scale.set(18-i,25+i*3,1);flame.add(glow);}
  this.hotstageGlow=new T.Group();this.hotstageGlow.position.y=71;this.vehicle.add(this.hotstageGlow);this.ring(4.9,.35,new T.MeshBasicMaterial({color:new T.Color(4,1.8,.3)}),this.hotstageGlow,0);for(let i=0;i<8;i++){const a=i*Math.PI/4,p=new T.Sprite(new T.SpriteMaterial({map:this.glowTexture,color:new T.Color(3,1.2,.3),transparent:true,opacity:.65,depthWrite:false,blending:T.AdditiveBlending}));p.position.set(Math.sin(a)*5.4,0,Math.cos(a)*5.4);p.scale.set(13,7,1);this.hotstageGlow.add(p);}this.hotstageGlow.visible=false;
  this.smoke=[];this.smokeEnvelope=0;for(let i=0;i<(this.low?45:110);i++){let mat=new T.SpriteMaterial({map:this.particleTexture,color:0xd7c9b6,transparent:true,opacity:0,depthWrite:false,rotation:rnd(i)*6.28});let p=new T.Sprite(mat);this.scene.add(p);this.smoke.push(p);}
  this.vents=[];for(let i=0;i<(this.low?16:40);i++){let p=new T.Sprite(new T.SpriteMaterial({map:this.particleTexture,color:0xe7ded0,transparent:true,opacity:.3,depthWrite:false,rotation:rnd(i+17)*6.28}));this.scene.add(p);this.vents.push(p);}
 }
 buildCockpit(){
  const m=this.materials;this.cabin=new T.Group();this.scene.add(this.cabin);const shell=material(0x18232d,.55,.55),edge=material(0x37454d,.6,.38),seat=material(0x111b24,.1,.85);
  this.box(13,1,12,shell,this.cabin,0,-3,0);this.box(13,1.1,12,shell,this.cabin,0,6,0);this.box(1.1,7,12,shell,this.cabin,-6.2,1.5,0);this.box(1.1,7,12,shell,this.cabin,6.2,1.5,0);
  this.box(12,.35,.5,edge,this.cabin,0,4.5,-4);this.box(12,.48,.6,edge,this.cabin,0,.0,-4);this.box(.23,5.0,.45,edge,this.cabin,0,2.2,-4);this.box(.32,5.1,.45,edge,this.cabin,-4.8,2.2,-4);this.box(.32,5.1,.45,edge,this.cabin,4.8,2.2,-4);
  this.box(12,.035,.05,new T.MeshBasicMaterial({color:0xa0dbe7}),this.cabin,0,4.28,-3.69);
  let consoleFrame=this.box(11.1,3.7,.18,shell,this.cabin,0,-.1,-2.4);consoleFrame.rotation.x=-.37;this.box(1.8,.8,5,shell,this.cabin,-5.5,-1.5,.1);this.box(1.8,.8,5,shell,this.cabin,5.5,-1.5,.1);
  this.screenTexture=canvasTexture(1536,512,(g,w,h)=>{g.fillStyle='#071018';g.fillRect(0,0,w,h)});
  const screenMat=new T.MeshBasicMaterial({map:this.screenTexture});this.mainScreen=this.mesh(new T.PlaneGeometry(10.5,3.5),screenMat,this.cabin,0,-.1,-2.15);this.mainScreen.rotation.x=-.37;
  // Backlit physical keys, commander side-stick and red guarded abort switch.
  for(let side of [-1,1]){for(let row=0;row<3;row++)for(let k=0;k<6;k++){this.box(.17,.06,.2,m.darkSteel,this.cabin,side*4.75+(k-2.5)*.17,-.45,-.5+row*.4);if(k%3===0)this.box(.06,.012,.035,m.cyan,this.cabin,side*4.75+(k-2.5)*.17,-.408,-.5+row*.4)}this.cylinder(.15,.24,.7,shell,this.cabin,side*3.7,-.45,.75,12);this.box(.35,.35,.55,edge,this.cabin,side*3.7,-.04,.7);}
  this.box(.7,.18,.7,m.black,this.cabin,4.7,-.4,1.35);this.box(.43,.12,.43,new T.MeshBasicMaterial({color:0xad382f}),this.cabin,4.7,-.23,1.35);
  this.cabinLight=new T.PointLight(0x63cfe4,12,15,2);this.cabinLight.position.set(0,1.5,2);this.cabin.add(this.cabinLight);
  this.cabin.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}});
 }
 drawCockpit(s){
  let crew=s.capsule?.active; if(crew)s={...s,altitude:s.capsule.altitude,velocity:s.capsule.velocity??Math.hypot(s.capsule.verticalVelocity||0,s.capsule.horizontalVelocity||0),phase:s.capsule.phase,activeEngines:0};let g=this.screenTexture.image.getContext('2d'),w=1536,h=512;g.fillStyle='#06121c';g.fillRect(0,0,w,h);g.strokeStyle='#254656';g.lineWidth=2;for(let x of [500,1036]){g.beginPath();g.moveTo(x,22);g.lineTo(x,490);g.stroke()}
  g.font='18px monospace';g.fillStyle='#7395a7';g.fillText(crew?'CAPSULE / GUIDANCE':'VEHICLE / GUIDANCE',32,40);g.fillText(crew?'ESCAPE FLIGHT DISPLAY':'PRIMARY FLIGHT DISPLAY',546,40);g.fillText(crew?'ESCAPE / RECOVERY':'PROPULSION / HEALTH',1070,40);
  const val=(x,y,label,value,unit)=>{g.font='14px monospace';g.fillStyle='#7697a9';g.fillText(label,x,y);g.font='42px monospace';g.fillStyle='#d1e6ee';g.fillText(value,x,y+51);g.font='16px monospace';g.fillStyle='#66a4bc';g.fillText(unit,x+295,y+49)};
  val(32,100,'ALTITUDE',((s.altitude||0)/1000).toFixed(2),'KM');val(32,226,'VELOCITY',Math.round(s.velocity||0).toLocaleString(),'M/S');val(32,349,'MISSION ELAPSED',(s.time>=0?'+':'−')+Math.abs(s.time??-120).toFixed(1),'SEC');
  g.save();g.translate(770,266);g.beginPath();g.arc(0,0,164,0,Math.PI*2);g.clip();let p=crew?0:(90-(s.pitch??90))*.016;g.rotate(p);g.fillStyle='#204c69';g.fillRect(-200,-200,400,200);g.fillStyle='#705345';g.fillRect(-200,0,400,220);g.strokeStyle='#b5dce2';g.lineWidth=3;g.beginPath();g.moveTo(-200,0);g.lineTo(200,0);g.stroke();g.strokeStyle='#86a5ae';g.lineWidth=1;for(let y=-120;y<=120;y+=30){g.beginPath();g.moveTo(-45,y);g.lineTo(45,y);g.stroke()}g.restore();g.strokeStyle='#38eac9';g.lineWidth=4;g.beginPath();g.moveTo(686,266);g.lineTo(747,266);g.lineTo(769,278);g.lineTo(791,266);g.lineTo(852,266);g.stroke();g.font='17px monospace';g.fillStyle='#46eac6';g.fillText(crew?'ATTITUDE SCHEMATIC':`PITCH ${(s.pitch??90).toFixed(1)}°`,crew?679:694,471);
  if(crew){
   const c=s.capsule;g.strokeStyle='#6ac6c0';g.lineWidth=3;g.beginPath();g.moveTo(1185,185);g.lineTo(1205,135);g.quadraticCurveTo(1230,104,1255,135);g.lineTo(1275,185);g.closePath();g.stroke();
   if(c.parachute){g.beginPath();g.arc(1230,88,64,Math.PI,0);g.moveTo(1166,88);g.lineTo(1230,133);g.lineTo(1294,88);g.stroke();}
   g.font='16px monospace';g.fillStyle='#7da1ae';g.fillText('ESCAPE MOTOR',1070,239);g.font='32px monospace';g.fillStyle='#b4d4df';g.fillText(`${((c.thrust||0)/1000).toFixed(0)} kN`,1070,283);g.font='15px monospace';g.fillStyle=c.thrust>0?'#50dec4':'#7da1ae';g.fillText(c.thrust>0?'FIRING':'MOTOR OFF',1290,283);
   g.fillStyle='#7da1ae';g.font='16px monospace';g.fillText('PARACHUTE',1070,333);g.font='24px monospace';g.fillStyle=c.parachute?'#50dec4':'#b4d4df';g.fillText(c.parachute?'DEPLOYED':'STOWED',1070,372);g.font='16px monospace';g.fillStyle='#50dec4';g.fillText((c.phase||'ESCAPE').replaceAll('_',' '),1070,425);g.fillStyle='#779dad';g.fillText('ESCAPE CAPSULE TELEMETRY',1070,472);
  }else{
   let engineCount=s.phase==='HOT_STAGING'?39:s.stage===2?6:33;for(let i=0;i<engineCount;i++){let a=i*2.3999,r=54*Math.sqrt(i/engineCount),x=1221+Math.cos(a)*r,y=153+Math.sin(a)*r;g.beginPath();g.arc(x,y,7,0,Math.PI*2);g.fillStyle=i<(s.activeEngines||0)?'#46e7c6':'#274652';g.fill()}
   g.font='24px monospace';g.fillStyle='#b4d4df';g.fillText(`${s.activeEngines||0} / ${engineCount} ENGINES`,1102,255);g.font='16px monospace';g.fillStyle='#7da1ae';g.fillText('PROPELLANT',1070,317);g.fillStyle='#193340';g.fillRect(1070,340,390,12);g.fillStyle='#50cebb';g.fillRect(1070,340,390*clamp((s.fuelPct??100)/100,0,1),12);g.fillStyle='#50dec4';g.fillText((s.phase||'PREFLIGHT').replaceAll('_',' '),1070,412);g.fillStyle='#779dad';g.fillText('CONCEPT CREW MODULE',1070,472);
  }
  this.screenTexture.needsUpdate=true;
 }
 buildMission(){
  this.missionRoom=new T.Group();this.scene.add(this.missionRoom);const m=this.materials,room=material(0x101c27,.3,.75);this.box(38,.5,36,room,this.missionRoom,0,-.5,3);this.box(38,.5,36,room,this.missionRoom,0,13.5,3);this.box(1,14,36,room,this.missionRoom,-18.5,6.5,3);this.box(1,14,36,room,this.missionRoom,18.5,6.5,3);
  // An observation glazing wall frames the distant launch complex.
  this.box(38,2.2,1,room,this.missionRoom,0,12.5,-13);this.box(38,1.2,1,room,this.missionRoom,0,.3,-13);for(let x of [-18,-9,0,9,18])this.box(.27,12,.4,m.darkSteel,this.missionRoom,x,6,-13);
  for(let row=0;row<2;row++)for(let col=0;col<5;col++){let x=(col-2)*6.3,z=-6+row*8;this.box(5.5,.55,2.4,room,this.missionRoom,x,1.1,z);this.box(.3,1.1,1.5,m.darkSteel,this.missionRoom,x,0.3,z);let panel=this.mesh(new T.PlaneGeometry(3.9,2),new T.MeshBasicMaterial({map:this.screenTexture}),this.missionRoom,x,2.45,z-.8);panel.rotation.x=-.12;this.box(1.8,2,1,m.black,this.missionRoom,x,.9,z+2.5);}
  let roomSign=this.mesh(new T.PlaneGeometry(18,1.8),this.textPanel('STARBASE  /  FLIGHT OPERATIONS',18,1.8,'#80acb9',null,31),this.missionRoom,0,11.7,-12.42);
  const light=new T.PointLight(0x7cbbcb,80,30,2);light.position.set(0,7,0);this.missionRoom.add(light);for(let x of [-12,0,12])this.box(5,.03,.15,m.cyan,this.missionRoom,x,12.6,0);this.missionRoom.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}});
 }
 buildCapsule(){
  const m=this.materials;this.capsule=new T.Group();this.scene.add(this.capsule);const white=material(0xe2ded2,.3,.5),heat=material(0x252b2d,.5,.6),glass=material(0x10232c,.82,.12);
  this.cylinder(1.05,2.25,3.3,white,this.capsule,0,1.8,0,48);this.mesh(new T.SphereGeometry(1.13,32,16,0,Math.PI*2,0,Math.PI/2),white,this.capsule,0,3.43,0);this.cylinder(2.27,2.14,.3,heat,this.capsule,0,.18,0,48);this.ring(2.24,.05,m.steel,this.capsule,.35);
  for(let i=0;i<4;i++){let a=i*Math.PI/2;const window=this.mesh(new T.SphereGeometry(.43,16,12),glass,this.capsule,Math.sin(a)*1.31,2.8,Math.cos(a)*1.31);window.scale.set(.8,1,.13);window.rotation.y=a;}
  const stripe=this.cylinder(1.67,1.8,.24,m.darkSteel,this.capsule,0,1.4,0,48);this.capsuleEngines=[];
  for(let i=0;i<4;i++){let a=i*Math.PI/2+.7;this.capsuleEngines.push(this.buildEngine(this.capsule,Math.sin(a)*1.56,Math.cos(a)*1.56,.28,.44,.12));}
  this.capsuleFlame=this.makeFlame(1.28,11,this.capsule,-.42);
  // Escape exhaust keeps colour and body against a bright sky instead of additive white haze.
  const escapeVertex=`varying vec2 vUv;varying vec3 flameNormal;varying vec3 flameView;uniform float time;void main(){vUv=uv;vec3 p=position;float tip=uv.y;float waviness=tip*tip*.075;p.x+=sin(tip*23.-time*18.)*waviness;p.z+=cos(tip*19.-time*15.)*waviness;vec4 mv=modelViewMatrix*vec4(p,1.);flameNormal=normalize(normalMatrix*normal);flameView=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
  const escapeShader=`varying vec2 vUv;varying vec3 flameNormal;varying vec3 flameView;uniform float time;uniform float strength;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){float d=vUv.y;float turbulence=noise(vec2(vUv.x*23.,d*19.-time*15.))*.6+noise(vec2(vUv.x*41.,d*37.-time*28.))*.4;float face=abs(dot(normalize(flameNormal),normalize(flameView)));float edge=smoothstep(.035,.6,face);float tip=1.-smoothstep(.40,1.,d);float diamonds=pow(max(0.,cos(d*53.-time*4.)),14.)*(1.-d);vec3 blue=vec3(.035,.29,2.8);vec3 orange=vec3(3.5,.43,.012);vec3 color=mix(blue,orange,smoothstep(.12,.70,d));color+=vec3(.10,.28,.9)*diamonds*.6;float alpha=edge*tip*(.62+turbulence*.36)*strength;gl_FragColor=vec4(color,alpha);}`;
  for(const plume of [this.capsuleFlame,...this.capsuleEngines.map(e=>e.flame)]){const mat=plume.userData.material;mat.vertexShader=escapeVertex;mat.fragmentShader=escapeShader;mat.blending=T.NormalBlending;mat.side=T.DoubleSide;mat.needsUpdate=true;plume.children[0].renderOrder=10;plume.children[1].visible=false;}

  this.chute=new T.Group();this.capsule.add(this.chute);this.chute.position.y=3.6;this.canopies=[];
  const fabric=canvasTexture(768,384,(g,w,h)=>{g.fillStyle='#ede7d2';g.fillRect(0,0,w,h);for(let i=0;i<24;i++){g.fillStyle=i%3===0?'#d45827':'#e9e4d1';g.fillRect(i*w/24,0,w/24,h);g.strokeStyle='rgba(70,58,40,.23)';g.lineWidth=2;g.beginPath();g.moveTo(i*w/24,0);g.lineTo(i*w/24,h);g.stroke();}for(let y=0;y<h;y+=48){g.strokeStyle='rgba(60,45,25,.10)';g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}});const silk=new T.MeshStandardMaterial({map:fabric,roughness:.9,metalness:0,side:T.DoubleSide}),cord=material(0xe4d9bd,.05,.85);
  for(let k=0;k<3;k++){const canopy=new T.Group();const a=k*Math.PI*2/3+.25,x=Math.sin(a)*11.8,z=Math.cos(a)*11.8,h=31+(k===1?3:0);canopy.position.set(x,h,z);this.chute.add(canopy);const dome=this.mesh(new T.SphereGeometry(10.2,48,20,0,Math.PI*2,.08,Math.PI/2-.08),silk,canopy);dome.scale.y=.48;this.ring(10.18,.035,cord,canopy,0);for(let j=0;j<24;j++){const b=j*Math.PI/12;this.bar(V(-x,-h+.7,-z),V(Math.sin(b)*10.12,0,Math.cos(b)*10.12),.022,cord,canopy);}this.canopies.push(canopy);}
  this.capsule.visible=false;this.chute.visible=false;
 }

 batchTree(group){for(const child of group.children)if(child.isGroup)this.batchTree(child);this.batchStatic(group);}
 batchStatic(group){
  // Collapse fixed meshes by material while retaining the animated hierarchy.
  const clusters=new Map();
  for(const child of group.children){if(!child.isMesh||child.isInstancedMesh||child.userData?.action||this.beacons.includes(child)||this.flaps.includes(child)||child===this.mainScreen)continue;let key=child.material;if(!clusters.has(key))clusters.set(key,[]);clusters.get(key).push(child);}
  for(const [mat,list] of clusters){if(list.length<3)continue;const attrs={position:[],normal:[],uv:[]};let valid=[];
   for(const mesh of list){mesh.updateMatrix();let geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geo.applyMatrix4(mesh.matrix);if(!geo.attributes.position){geo.dispose();continue;}let count=geo.attributes.position.count;for(const name of Object.keys(attrs)){const a=geo.attributes[name];if(a)for(let i=0;i<a.array.length;i++)attrs[name].push(a.array[i]);else for(let i=0;i<count*(name==='uv'?2:3);i++)attrs[name].push(0);}geo.dispose();valid.push(mesh);}
   let merged=new T.BufferGeometry();for(const name of Object.keys(attrs))merged.setAttribute(name,new T.Float32BufferAttribute(attrs[name],name==='uv'?2:3));merged.computeBoundingSphere();let result=new T.Mesh(merged,mat);result.castShadow=valid.some(x=>x.castShadow);result.receiveShadow=valid.some(x=>x.receiveShadow);group.add(result);for(const old of valid){group.remove(old);old.geometry.dispose();}
  }
 }

 bindPointer(){
  this.drag=null;this.onDown=e=>{if(e.button!==0)return;this.drag={x:e.clientX,y:e.clientY};this.canvas.setPointerCapture?.(e.pointerId)};this.onMove=e=>{if(!this.drag)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(this.free&&this.mode==='pad'){this.freeYaw-=dx*.003;this.freePitch=clamp(this.freePitch-dy*.0025,-1.3,1.3);}else{this.orbit+=dx*.003;this.elevation=clamp(this.elevation+dy*.0018,-.75,.9);}this.drag={x:e.clientX,y:e.clientY}};this.onUp=()=>this.drag=null;this.onWheel=e=>{e.preventDefault();this.zoom=clamp(this.zoom*Math.exp(e.deltaY*.0007),.48,2.5)};
  this.canvas.addEventListener('pointerdown',this.onDown);this.canvas.addEventListener('pointermove',this.onMove);this.canvas.addEventListener('pointerup',this.onUp);this.canvas.addEventListener('pointercancel',this.onUp);this.canvas.addEventListener('wheel',this.onWheel,{passive:false});
 }
 resize(){if(this.disposed)return;const r=this.canvas.getBoundingClientRect(),w=Math.max(1,r.width||this.canvas.clientWidth||800),h=Math.max(1,r.height||this.canvas.clientHeight||500);this.viewportWidth=w;this.viewportHeight=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.post?.resize(w,h);}
 setMultiview(enabled){this.multiview=!!enabled;if(this.multiview){this.setView('pad');this.cinematic=true;this.tracking=true;this.free=false;this.spaceportView=false;}this.cameraReady=false;this.resetPixelRatio();return this.getViewports();}
 setSplitLayout(rects=null){
  if(rects!=null&&(!Array.isArray(rects)||rects.length!==3||rects.some(r=>!['x','y','width','height'].every(k=>Number.isFinite(r[k]))||r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>1.00001||r.y+r.height>1.00001)))throw new TypeError('Split layout requires three normalized rectangles.');
  this.splitLayout=rects?.map(r=>({x:r.x,y:r.y,width:r.width,height:r.height}))||null;return this.getViewports();
 }
 getViewports(){
  const kinds=[this.cameraBody,...['ship','booster','capsule'].filter(k=>k!==this.cameraBody)];
  if(!this.multiview)return [{kind:kinds[0],primary:true,x:0,y:0,width:1,height:1}];
  const portrait=this.viewportWidth<760||this.viewportWidth<this.viewportHeight;
  const rects=this.splitLayout||(portrait?[{x:0,y:0,width:1,height:.62},{x:0,y:.62,width:.5,height:.38},{x:.5,y:.62,width:.5,height:.38}]:[{x:0,y:0,width:.68,height:1},{x:.68,y:0,width:.32,height:.5},{x:.68,y:.5,width:.32,height:.5}]);
  return rects.map((r,i)=>({...r,kind:kinds[i],primary:i===0}));
 }
 pixelRatioCap(){return Math.min(devicePixelRatio||1,this.quality==='low'?1:this.multiview?1.25:this.quality==='high'?1.75:1.25);}
 resetPixelRatio(){this.renderer.setPixelRatio(this.pixelRatioCap());this.adaptiveClock=0;this.adaptiveFrames=0;this.adaptiveRenderCost=0;this.fastClock=0;this.resize();}
 setAdaptiveQuality(enabled){this.adaptiveQualityEnabled=!!enabled;this.adaptiveClock=0;this.adaptiveFrames=0;this.adaptiveRenderCost=0;if(!enabled)this.resetPixelRatio();}
 adaptResolution(dt){
  if(!this.adaptiveQualityEnabled||!(dt>0)||document.hidden)return;this.adaptiveClock+=dt;this.adaptiveFrames++;this.adaptiveRenderCost+=Math.max(this.performanceStats.renderMs||0,Math.min(dt,.1)*1000);if(this.adaptiveClock<5)return;
  const cost=this.adaptiveRenderCost/this.adaptiveFrames,ratio=this.renderer.getPixelRatio(),cap=this.pixelRatioCap();let next=ratio;
  if(cost>27)next=Math.max(.75,ratio*.85);else if(cost<14)next=Math.min(cap,ratio+.1);
  this.adaptiveClock=0;this.adaptiveFrames=0;this.adaptiveRenderCost=0;if(Math.abs(next-ratio)>.035){this.renderer.setPixelRatio(next);this.resize();}
 }
 getPerformanceStats(){return {...this.performanceStats,pixelRatio:this.renderer.getPixelRatio(),quality:this.quality,adaptive:this.adaptiveQualityEnabled};}
 setView(mode){this.mode=['pad','cockpit','mission'].includes(mode)?mode:'pad';this.cabin.visible=this.mode==='cockpit';this.missionRoom.visible=this.mode==='mission';this.camera.fov=this.mode==='cockpit'?72:this.mode==='mission'?68:48;this.orbit=0;this.elevation=0;this.cameraReady=false;this.camera.updateProjectionMatrix();}
 setCamera(o={}){if(o.spaceport!=null){this.spaceportView=!!o.spaceport;this.cameraReady=false;}if(o.target!=null&&['ship','booster','capsule'].includes(o.target)){this.cameraBody=o.target;this.cameraReady=false;}if(o.engineView!=null){this.engineView=!!o.engineView;this.cameraReady=false;}if(o.zoom!=null)this.zoom=clamp(o.zoom,.48,2.5);if(o.tracking!=null)this.tracking=o.tracking;if(o.orbit!=null)this.orbit=o.orbit;if(o.night!=null){this.night=o.night;this.applyEnvironmentStrength();}if(o.cinematic!=null)this.cinematic=o.cinematic;if(o.free!=null){this.free=o.free;if(o.free){this.freePosition.copy(this.camera.position);let d=this.camera.getWorldDirection(V());this.freeYaw=Math.atan2(d.x,-d.z);this.freePitch=Math.asin(d.y);}}}
 applyEnvironmentStrength(){const factor=(this.night?.045:1)*(this.weatherEnvironment??1);this.scene.traverse(obj=>{for(const mat of (Array.isArray(obj.material)?obj.material:[obj.material]))if(mat&&'envMapIntensity' in mat){if(mat.userData.baseEnvironment==null)mat.userData.baseEnvironment=mat.envMapIntensity;mat.envMapIntensity=mat.userData.baseEnvironment*factor;}});}
 triggerFailure(incident){this.failureFX?.trigger(incident);if(incident.kind==='impact'){this.destroyedBodies.add(incident.body);if(incident.attached){this.destroyedBodies.add('ship');this.destroyedBodies.add('booster');}}}
 resetFailures(){this.failureFX?.reset();this.destroyedBodies.clear();}
 frameFailure(kind,position,target,fov){const blast=this.failureFX?.getFraming(kind);if(!blast)return fov;const radius=Math.max(14,blast.radius),theta=-.40+this.orbit,center=blast.center.clone();const distance=Math.max(65,radius*2.7)*this.zoom;target.copy(center);position.set(center.x+Math.sin(theta)*distance,Math.max(12,center.y+distance*.24),center.z+Math.cos(theta)*distance);return 51;}
 shakeFailure(camera,kind){if(!this.cameraShock||!this.failureFX)return;const impulse=this.failureFX.getCameraImpulse?.(camera,kind);if(impulse?.isVector3){camera.position.add(impulse);camera.updateMatrixWorld(true);}}
 setMovement(o={}){this.movement=o;}
 setQuality(q){this.quality=['low','medium','high'].includes(q)?q:'medium';this.low=this.quality==='low';this.renderer.shadowMap.enabled=!this.low;const shadowSize=this.low?1024:2048;if(this.sun.shadow.mapSize.x!==shadowSize){this.sun.shadow.mapSize.set(shadowSize,shadowSize);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}this.post?.setQuality(this.quality);this.failureFX?.setQuality(this.quality);if(this.quality==='high')this.loadHDREnvironment();this.resetPixelRatio();}
 getInteractable(pointer={x:0,y:0}){
  const list=this.interiors?.pickables||this.pickables||[];if(!list.length||this.mode==='pad')return null;
  const x=Number(pointer?.x??0),y=Number(pointer?.y??0);if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1||Math.abs(y)>1)return null;
  const isVisible=o=>{for(let parent=o;parent;parent=parent.parent)if(!parent.visible)return false;return true;};
  this.scene.updateMatrixWorld(true);this.raycaster=this.raycaster||new T.Raycaster();this.raycaster.setFromCamera(new T.Vector2(x,y),this.camera);
  const hit=this.raycaster.intersectObjects(list.filter(isVisible),true).find(item=>item.distance<18&&isVisible(item.object));if(!hit)return null;
  let object=hit.object;while(object&&!object.userData.action)object=object.parent;return object?{action:object.userData.action,label:object.userData.label||object.userData.action,object,distance:hit.distance}:null;
 }
 trackedBody(s,requested=this.cameraBody){
  const separated=!!s.separated||s.stage===2,cap=s.capsule||{},b=s.booster||{},kind=['ship','booster','capsule'].includes(requested)?requested:'ship',stowed=kind==='capsule'&&!cap.active,shipImpact=s.phase==='ABORTED'&&(s.altitude||0)<=0&&(s.maxAltitude||0)>1,impacted=(kind==='booster'&&separated?b.phase==='IMPACT':kind==='ship'||stowed||kind==='booster'?shipImpact:false);
  const altitude=kind==='capsule'&&!stowed?cap.altitude||0:kind==='booster'&&separated?b.altitude||0:s.altitude||0,range=kind==='capsule'&&!stowed?cap.downrange||0:kind==='booster'&&separated?b.downrange||0:s.downrange||0,pitch=impacted?0:kind==='capsule'&&!stowed?(cap.thrust>0?cap.pitch??80:90):kind==='booster'&&separated?b.pitch??90:s.pitch??90;
  const rotation=-(90-pitch)*Math.PI/180,base=V(range,altitude+(impacted?4.5:kind==='capsule'&&!stowed?-.03:separated?.65:15),0),height=kind==='capsule'?4.5:kind==='booster'?71:separated?50:122,axis=V(0,1,0).applyAxisAngle(V(0,0,1),rotation),chute=kind==='capsule'&&!stowed&&(cap.parachuteInflation??cap.chuteInflation??(cap.parachute?1:0))>.01;
  // Before escape, the capsule monitor watches the crew nose on the real stack.
  // It never silently switches its target to the complete rocket.
  if(stowed)base.addScaledVector(axis,separated?46.5:117.5);
  const grounded=kind==='capsule'&&!stowed&&['LANDED','IMPACT'].includes(cap.phase),settle=grounded&&this.capsuleContactAt!=null?clamp((this.elapsed-this.capsuleContactAt)/6,0,1):0;return {kind,stowed,impacted,altitude:stowed?base.y:altitude,range,rotation,base,axis,height,chute,grounded,settle,powered:kind==='capsule'&&!stowed&&(cap.thrust||0)>0,center:base.clone().addScaledVector(axis,chute?20-settle*17:kind==='capsule'&&!stowed&&(cap.thrust||0)>0?-2.8:height*.48),phase:stowed?'ATTACHED':kind==='capsule'?cap.phase:kind==='booster'&&separated?b.phase:s.phase};
 }
 updateEngineBank(bank,count,throttle,t,inspect=false){
  for(let i=0;i<bank.length;i++){const engine=bank[i],lit=i<count;engine.flame.visible=lit;engine.throat.emissive.setRGB(lit?2.2:0,lit?1.1:0,lit?.42:0);engine.throat.color.set(lit?0xafb4b8:0x080b10);engine.flame.userData.material.uniforms.time.value=t+i*.03;engine.flame.userData.material.uniforms.strength.value=inspect?.32:.9;engine.flame.scale.y=(inspect?.22:.65+throttle*.35)*(.96+.06*Math.sin(t*45+i));}
 }
 update(s={},dt=0,simulationActive=true){
  if(this.disposed)return;this.failureFX?.update(simulationActive?dt:0,s);this.adaptResolution(dt);this.elapsed+=Math.min(dt||0,.2);let t=this.elapsed,alt=Math.max(0,+s.altitude||0),range=+s.downrange||0,separated=!!s.separated||s.stage===2;const shipImpact=s.phase==='ABORTED'&&alt<=0&&(s.maxAltitude||0)>1,pitch=shipImpact?Math.PI/2:(90-(s.pitch??90))*Math.PI/180,baseOffset=shipImpact?4.5:separated?.65:15,pos=V(range,alt+baseOffset,0);
  this.vehicle.position.copy(pos);this.vehicle.rotation.z=-pitch;this.vehicle.visible=this.mode!=='cockpit';this.shipVisual.position.y=separated?0:71;this.boosterVisual.visible=!this.destroyedBodies.has('booster');this.shipVisual.visible=!this.destroyedBodies.has('ship');
  if(separated){let b=s.booster||{},boosterImpact=b.phase==='IMPACT';this.boosterVisual.position.copy(V(b.downrange??range-100,(b.altitude??alt-150)+(boosterImpact?4.5:.65),0).sub(pos).applyQuaternion(this.vehicle.quaternion.clone().invert()));this.boosterVisual.rotation.z=pitch-(90-(boosterImpact?0:b.pitch??s.pitch??90))*Math.PI/180;}else{this.boosterVisual.position.set(0,0,0);this.boosterVisual.rotation.z=0;}
  let firing=(s.activeEngines||0)>0&&s.thrust>0,boosterCount=separated?(s.booster?.activeEngines??((s.booster?.thrust||0)>0?3:0)):(s.boosterEngines??s.activeEngines??0),shipCount=s.shipEngines??(separated?s.activeEngines:0)??0,boosterFiring=boosterCount>0&&(separated?s.booster?.thrust>0:firing),shipFiring=shipCount>0&&firing;
  const inspecting=this.mode==='pad'&&this.engineView&&!this.free;this.updateEngineBank(this.boosterEngines,boosterFiring?boosterCount:0,s.booster?.throttle??s.effectiveThrottle??1,t,inspecting);this.updateEngineBank(this.shipEngines,shipFiring?shipCount:0,s.effectiveThrottle??1,t,inspecting);
  this.boosterFlame.visible=boosterFiring&&!inspecting;this.shipFlame.visible=shipFiring&&!inspecting;this.hotstageGlow.visible=!separated&&shipFiring;[this.boosterFlame,this.shipFlame].forEach(g=>{g.userData.material.uniforms.time.value=t;g.userData.material.uniforms.strength.value=.50;g.scale.y=.93+.12*Math.sin(t*39);g.scale.x=g.scale.z=1+.035*Math.sin(t*54)});const boosterScale=Math.sqrt(Math.max(1,boosterCount)/33);this.boosterFlame.scale.x*=boosterScale;this.boosterFlame.scale.z*=boosterScale;if(separated&&boosterCount<10)this.boosterFlame.scale.y=.35;this.launchLight.intensity=firing?14000:0;this.launchLight.distance=260;this.launchLight.decay=1.65;
  const returning=!!s.recovery?.active||['RETURN_COAST','SHIP_RETURN','TOWER_APPROACH','COMPLETE'].includes(s.phase),caught=!!s.recovery?.caught,catchProgress=clamp(s.recovery?.catchProgress??(caught?1:0),0,1);this.arms.position.x=returning?0:alt>2?Math.min(7,alt*.05):0;this.catchArms.forEach(a=>a.rotation.y=a.userData.side*(.42*(1-catchProgress)));
  this.boosterLegs.forEach(g=>{g.visible=separated&&(s.booster?.altitude??1e9)<350;const deploy=clamp((350-(s.booster?.altitude??1e9))/250,0,1);g.scale.set(1,1,deploy*.85+.15);});this.landingBeacon.intensity=(separated&&s.booster?.phase==='LANDING'?900:this.night?250:0);this.boosterReturnLight.position.set(s.booster?.downrange??0,(s.booster?.altitude??0)+1,0);this.boosterReturnLight.intensity=separated&&boosterFiring?9000:0;
  this.beacons.forEach((p,i)=>p.visible=Math.sin(t*2.7+i*.12)>-.1);for(const light of this.siteLights||[])light.intensity=this.night?2100:0;
  this.vents.forEach((p,i)=>{let age=(t*.14+i/this.vents.length)%1,side=i%2?-1:1;let yy=i%2?88:122;p.position.set(side*(5+age*24)+(s.config?.wind||5)*age*.45,yy+age*8,-age*3);let scale=2+age*19;p.scale.set(scale,scale*.65,1);p.material.opacity=(1-age)*.36*(alt<8?1:0);});
  const landingDust=separated&&(s.booster?.altitude??1e9)<120&&(s.booster?.phase==='LANDING'||s.booster?.phase==='LANDED'),smokeActive=(firing&&alt<220&&!returning)||(landingDust&&boosterFiring)||((s.phase==='ABORTED'||s.phase==='FLIGHT_ABORT')&&s.time>-1);this.smokeEnvelope+=(Number(smokeActive)-this.smokeEnvelope)*Math.min(1,Math.max(dt,.016)*(smokeActive?1.8:.10));this.smoke.forEach((p,i)=>{let age=(t*.07+i/this.smoke.length)%1,a=rnd(i+70)*Math.PI*2,r=age*175+5;let ox=Math.sin(a)*r,oz=Math.cos(a)*r;const dustScale=landingDust?.35:1;p.position.set((landingDust?(s.booster?.targetDownrange??-360):0)+ox*dustScale+(s.config?.wind||5)*age*3.5,(3+age*36+Math.sin(i)*5)*dustScale,oz*dustScale);let scale=(13+Math.pow(age,.7)*76)*dustScale;p.scale.set(scale,scale*(.65+rnd(i)*.35),1);p.material.opacity=this.smokeEnvelope*Math.min(.7,(1-age)*1.25)*Math.min(1,age*16);p.material.rotation=rnd(i)*6.28+age*.4;p.material.color.setRGB(.69+age*.14,.66+age*.13,.59+age*.13);});
  let cap=s.capsule||{};this.capsule.visible=!!cap.active&&this.mode!=='cockpit'&&!this.destroyedBodies.has('capsule');const capPowered=!!cap.active&&(cap.thrust||0)>0,inflation=clamp(cap.parachuteInflation??cap.chuteInflation??(cap.parachute?1:0),0,1);if(cap.active){this.capsule.position.set(cap.downrange??range,(cap.altitude??alt)-.03,0);this.chute.visible=inflation>.005;this.chute.scale.set(.08+inflation*.92,.45+inflation*.55,.08+inflation*.92);const grounded=['LANDED','IMPACT'].includes(cap.phase);this.capsule.rotation.z=capPowered?-(90-(cap.pitch??80))*Math.PI/180:grounded?0:Math.sin(t*.8)*.035;if(grounded){if(this.capsuleContactAt==null)this.capsuleContactAt=t;const settle=clamp((t-this.capsuleContactAt)/6,0,1);this.chute.scale.y*=1-settle*.96;this.chute.position.y=3.6*(1-settle);this.chute.rotation.z=settle*.11;}else{this.capsuleContactAt=null;this.chute.position.y=3.6;this.chute.rotation.z=0;}this.chute.rotation.y=Math.sin(t*.35)*.035;this.capsuleFlame.visible=capPowered&&!inspecting;this.capsuleFlame.userData.material.uniforms.time.value=t;this.capsuleFlame.scale.y=.9+.10*Math.sin(t*40);this.updateEngineBank(this.capsuleEngines,capPowered?4:0,1,t,inspecting);this.capsuleLight.position.copy(this.capsule.position).add(V(0,-2,0));this.capsuleLight.intensity=capPowered?4500:0;}else{this.capsuleLight.intensity=0;this.capsuleContactAt=null;}
  this.engineState={boosterCount:boosterFiring?boosterCount:0,shipCount:shipFiring?shipCount:0,capCount:capPowered?4:0,boosterThrottle:s.booster?.throttle??s.effectiveThrottle??1,shipThrottle:s.effectiveThrottle??1};
  const body=this.trackedBody(s);this.selectedBody=body;const shadowX=this.mode==='pad'&&body.altitude<500?body.range:0;this.sun.position.set(shadowX-240,195,175);this.sun.target.position.set(shadowX,0,0);const failureFocus=this.mode==='pad'&&!this.free&&!this.spaceportView?this.failureFX?.getFraming(body.kind):null;const viewingAltitude=failureFocus?failureFocus.center.y:this.mode==='mission'?0:this.mode==='cockpit'?(cap.active?(cap.altitude??alt):alt):this.spaceportView?this.camera.position.y:this.free?this.freePosition.y:this.cinematic||inspecting?body.altitude:0;this.skyMaterial.uniforms.height.value=viewingAltitude;this.skyMaterial.uniforms.night.value=this.night?1:0;this.skyMaterial.uniforms.time.value=t;this.skyMaterial.uniforms.cloud.value=s.config?.weather==='cloudy'?.8:s.config?.weather==='storm'?1.4:.2;this.oceanMat.uniforms.time.value=t;this.oceanMat.uniforms.night.value=this.night?1:0;
  this.applyViewEnvironment(s,body,viewingAltitude,this.mode,inspecting,this.camera);
  const nextPosition=V(),nextTarget=V();let nextFov=48;
  if(this.mode==='cockpit'){
   const preset=this.interiors?.cameraPresets?.cockpit||{position:[0,1.75,2.8],target:[0,1.55,-3.5],fov:72};let cabinAltitude=cap.active?(cap.altitude??alt):alt;this.cabin.position.set(cap.active?(cap.downrange??range):range,cabinAltitude+(cap.active?3:separated?48:124),0);this.cabin.rotation.z=cap.active?(capPowered?-(90-(cap.pitch??80))*Math.PI/180:Math.sin(t)*.015):-pitch;this.cabin.rotation.y=cap.active?0:-.65;nextPosition.fromArray(preset.position).applyQuaternion(this.cabin.quaternion).add(this.cabin.position);const direction=V(Math.sin(this.orbit)*Math.cos(this.elevation),-Math.sin(this.elevation),-Math.cos(this.orbit)*Math.cos(this.elevation));nextTarget.copy(nextPosition).add(direction.applyQuaternion(this.cabin.quaternion).multiplyScalar(10));nextFov=clamp(preset.fov*this.zoom,45,98);
  }else if(this.mode==='mission'){
   const preset=this.interiors?.cameraPresets?.mission||{position:[0,2,7.3],target:[0,2.45,-8],fov:68};this.missionRoom.position.set(240,0,940);this.missionRoom.rotation.y=.25;nextPosition.fromArray(preset.position).applyQuaternion(this.missionRoom.quaternion).add(this.missionRoom.position);const direction=V(Math.sin(this.orbit)*Math.cos(this.elevation),-Math.sin(this.elevation)+(preset.target[1]-preset.position[1])/17,-Math.cos(this.orbit)*Math.cos(this.elevation));nextTarget.copy(nextPosition).add(direction.applyQuaternion(this.missionRoom.quaternion).multiplyScalar(17));nextFov=clamp(preset.fov*this.zoom,40,93);
  }else if(this.spaceportView){
   const preset=this.spaceport?.getOverview?.()||{position:[280,165,540],target:[-450,130,-600],fov:52};const overviewTarget=V().fromArray(preset.target),offset=V().fromArray(preset.position).sub(overviewTarget).multiplyScalar(this.zoom);offset.applyAxisAngle(V(0,1,0),this.orbit);offset.y+=this.elevation*offset.length()*.4;nextTarget.copy(overviewTarget);nextPosition.copy(overviewTarget).add(offset);nextPosition.y=Math.max(18,nextPosition.y);nextFov=preset.fov||52;
  }else if(this.free){
   const speed=(this.movement.fast?25:7)*Math.min(dt,.05),fw=Number(this.movement.forward)||0,rt=Number(this.movement.right)||0;this.freePosition.x+=(Math.sin(this.freeYaw)*fw+Math.cos(this.freeYaw)*rt)*speed;this.freePosition.z+=(-Math.cos(this.freeYaw)*fw+Math.sin(this.freeYaw)*rt)*speed;this.freePosition.y=clamp(this.freePosition.y+(Number(this.movement.up)||0)*speed,1.7,600);nextPosition.copy(this.freePosition);nextTarget.copy(nextPosition).add(V(Math.sin(this.freeYaw)*Math.cos(this.freePitch),Math.sin(this.freePitch),-Math.cos(this.freeYaw)*Math.cos(this.freePitch)).multiplyScalar(10));nextFov=65;
  }else if(inspecting){
   // Optical inspection deliberately removes only the launch mount that occludes the bells.
   const theta=.68+this.orbit,distance=(body.kind==='capsule'?7.5:18)*this.zoom;nextTarget.copy(body.base).addScaledVector(body.axis,-.15);const offset=V(Math.sin(theta)*distance,-distance*.76,Math.cos(theta)*distance).applyAxisAngle(V(0,0,1),body.rotation);nextPosition.copy(nextTarget).add(offset);nextFov=body.kind==='capsule'?47:43;
  }else{
   let theta=-.36+this.orbit;nextTarget.copy(this.tracking?body.center:V(0,76,0));
   if(this.cinematic&&this.tracking){
    const dist=body.kind==='capsule'?(body.chute?138-body.settle*58:body.powered?36:23):body.kind==='booster'?205:separated?160:320,distance=dist*this.zoom;
    nextPosition.set(nextTarget.x+Math.sin(theta)*distance,nextTarget.y+distance*this.elevation+(body.kind==='capsule'?(body.grounded?16:body.chute?-6:-1):body.altitude<100?-Math.min(35,body.height*.2):18),Math.cos(theta)*distance);nextFov=40;
    // Recovery framing reserves the lower quarter for telemetry: the touchdown
    // surface, full vehicle and catch arms stay together in the clear image area.
    const boosterRecovery=body.kind==='booster'&&separated&&!['IMPACT','SPLASHDOWN'].includes(s.booster?.phase)&&body.altitude<700,shipRecovery=body.kind==='ship'&&returning&&alt<650;
    if(boosterRecovery||shipRecovery){
     const weight=1-T.MathUtils.smoothstep(body.altitude,boosterRecovery?400:350,boosterRecovery?700:650),recoveryTarget=V(),recoveryPosition=V();let recoveryDistance,recoveryFov;
     if(boosterRecovery){recoveryTarget.set((body.range+(s.booster?.targetDownrange??-360))*.5,body.center.y*.20+8,0);recoveryDistance=(280+body.altitude*1.7)*this.zoom;recoveryFov=54;}
     else{recoveryTarget.set((body.range+12.5)*.5,35+Math.max(0,alt-150)*.12,0);recoveryDistance=Math.max(430,(Math.max(166,alt+50)+60)*2.1,Math.abs(body.range)*1.3)*this.zoom;recoveryFov=48;}
     const lift=boosterRecovery?70+Math.min(70,body.altitude*.18):85;recoveryPosition.set(recoveryTarget.x+Math.sin(theta)*recoveryDistance,recoveryTarget.y+lift+recoveryDistance*this.elevation,Math.cos(theta)*recoveryDistance);
     nextTarget.lerp(recoveryTarget,weight);nextPosition.lerp(recoveryPosition,weight);nextFov=T.MathUtils.lerp(nextFov,recoveryFov,weight);
    }
   }
   else{nextPosition.set(Math.sin(theta)*235,2.1+clamp(this.elevation*18,0,18),Math.cos(theta)*235);const slant=nextPosition.distanceTo(nextTarget),framing=this.tracking?(body.kind==='capsule'?(body.chute?85:body.powered?28:13):body.kind==='booster'?155:separated?140:235):235;nextFov=clamp(2*Math.atan(Math.tan(47*Math.PI/360)*framing/Math.max(235,slant)*this.zoom)*180/Math.PI,.003,82);}
  }

  if(this.mode==='pad'&&this.tracking&&!this.free&&!this.spaceportView)nextFov=this.frameFailure(body.kind,nextPosition,nextTarget,nextFov);
  if(body.impacted&&this.mode==='pad')nextPosition.y=Math.max(5,nextPosition.y);
  const blend=this.cameraReady?1-Math.exp(-Math.max(dt,.016)*7):1;const bodyAttached=this.mode==='cockpit'||(this.mode==='pad'&&(this.cinematic||inspecting)&&this.tracking&&!this.free&&!this.spaceportView),opticalTracking=this.mode==='pad'&&this.tracking&&!this.free&&!this.spaceportView;if(bodyAttached){this.camera.position.copy(nextPosition);this.cameraTarget.copy(nextTarget);}else{this.camera.position.lerp(nextPosition,blend);if(opticalTracking)this.cameraTarget.copy(nextTarget);else this.cameraTarget.lerp(nextTarget,blend);}this.cameraReady=true;if(firing){let shake=(this.mode==='cockpit'?.035:this.mode==='mission'?.002:alt<200?.015:0)*Math.min(1,(s.thrust||0)/30000000);this.camera.position.x+=Math.sin(t*91)*shake;this.camera.position.y+=Math.sin(t*73)*shake;}this.camera.up.set(0,1,0);if(this.mode==='cockpit')this.camera.up.applyQuaternion(this.cabin.quaternion);this.camera.lookAt(this.cameraTarget);this.camera.fov=opticalTracking?nextFov:T.MathUtils.lerp(this.camera.fov,nextFov,blend);this.camera.updateProjectionMatrix();if(!this.multiview)this.shakeFailure(this.camera,body.kind);
  if(window.StarshipInteriors)StarshipInteriors.update(this,s,dt);
  this.sky.position.copy(this.camera.position);const stamp=[s.time,s.phase,s.altitude,s.activeEngines,s.capsule?.active,s.capsule?.altitude].join('|');if(t-this.lastScreen>.12||(dt===0&&this.screenStamp!==stamp)){this.drawCockpit(s);this.lastScreen=t;this.screenStamp=stamp;}this.spaceport?.update(s,simulationActive?dt:0,this.elapsed);this.renderFrame(s,t);
 }

 applyViewEnvironment(s,body,viewingAltitude,mode='pad',inspecting=false,camera=this.camera,chase=this.cinematic){
  this.skyMaterial.uniforms.height.value=viewingAltitude;
  const space=clamp((viewingAltitude-10000)/40000,0,1),weather=s.config?.weather||'clear';
  const weatherLight=weather==='storm'?{sun:.18,hemi:.25,rim:.11,sky:.26,fog:.0024,color:0x566779,environment:.28,sunColor:0xb6c9e4}:weather==='cloudy'?{sun:.70,hemi:.39,rim:.22,sky:.56,fog:.0010,color:0x87919d,environment:.62,sunColor:0xd8e0eb}:{sun:2.05,hemi:.42,rim:.3,sky:.85,fog:.00045,color:0x939ba8,environment:1,sunColor:0xffdcaa};
  if(this.lastWeather!==weather){this.lastWeather=weather;this.weatherEnvironment=weatherLight.environment;this.applyEnvironmentStrength();}
  this.exteriorLighting=this.night?{sun:.10*weatherLight.environment,hemi:.22,rim:.25*weatherLight.environment}:{sun:weatherLight.sun,hemi:weatherLight.hemi,rim:weatherLight.rim};
  const aerialFog=viewingAltitude>200?1+viewingAltitude/160:((mode==='pad'&&!chase&&this.tracking)?1+body.altitude/180:1);
  this.scene.fog.density=(this.night?weatherLight.fog*1.3:weatherLight.fog)*(1-space)/aerialFog;this.scene.fog.color.set(this.night?0x101c30:weatherLight.color);this.scene.backgroundIntensity=weatherLight.sky;
  this.hemi.intensity=this.exteriorLighting.hemi*(1-space*.4);this.sun.intensity=this.exteriorLighting.sun;this.sun.color.set(weatherLight.sunColor);this.rim.intensity=this.exteriorLighting.rim;this.renderer.toneMappingExposure=(this.night?.86:.85)+(this.cameraShock?(this.failureFX?.getFlash?.(camera)||0)*.32:0);
  if(mode!=='pad'){this.sun.intensity=.08;this.rim.intensity=.08;this.hemi.intensity=.15;}
  this.earth.visible=true;this.atmosphere.visible=viewingAltitude>40000;this.ground.visible=viewingAltitude<2200;const surfaceOpacity=1-T.MathUtils.smoothstep(viewingAltitude,650,2100);if(this.landSurface){this.landSurface.material.transparent=surfaceOpacity<1;this.landSurface.material.depthWrite=surfaceOpacity===1;this.landSurface.material.opacity=surfaceOpacity;}if(this.recoveryTerrain){this.recoveryTerrain.material.transparent=surfaceOpacity<1;this.recoveryTerrain.material.depthWrite=surfaceOpacity===1;this.recoveryTerrain.material.opacity=surfaceOpacity;}this.oceanMat.uniforms.opacity.value=surfaceOpacity;
  this.pad.visible=!(inspecting&&body.altitude<160);this.engineInspectionLight.intensity=inspecting?2300:0;this.engineInspectionLight.position.copy(body.base).add(V(3,-4,6));camera.near=mode==='pad'?.2:.05;this.sky.visible=!this.skyPanorama||this.night||viewingAltitude>18000;this.scene.background=this.sky.visible?null:this.skyPanorama;
  this.sky.position.copy(camera.position);this.sky.updateMatrixWorld(true);
 }
 positionAuxiliaryCamera(camera,body,s,view={y:0}){
  const separated=!!s.separated||s.stage===2,returning=!!s.recovery?.active||['RETURN_COAST','SHIP_RETURN','TOWER_APPROACH','COMPLETE'].includes(s.phase),target=body.center.clone(),theta=body.kind==='capsule'?.43:body.kind==='booster'?-.56:-.36;
  let distance=body.kind==='capsule'?(body.stowed?25:body.chute?115-body.settle*48:body.powered?41:29):body.kind==='booster'?190:separated?140:270,raise=body.kind==='capsule'?(body.grounded?15:body.chute?-3:2):20,fov=44;
  if(body.kind==='booster'&&separated&&!['IMPACT','SPLASHDOWN'].includes(s.booster?.phase)&&body.altitude<700){const weight=1-T.MathUtils.smoothstep(body.altitude,400,700);target.lerp(V((body.range+(s.booster?.targetDownrange??-360))*.5,body.center.y*.45+5,0),weight);distance=T.MathUtils.lerp(distance,240+body.altitude*1.25,weight);raise=T.MathUtils.lerp(raise,70+Math.min(70,body.altitude*.18),weight);fov=T.MathUtils.lerp(fov,50,weight);}
  if(body.kind==='ship'&&returning&&body.altitude<650){const weight=1-T.MathUtils.smoothstep(body.altitude,350,650);target.lerp(V((body.range+12.5)*.5,80+Math.max(0,body.altitude-150)*.15,0),weight);distance=T.MathUtils.lerp(distance,Math.max(360,(Math.max(166,body.altitude+50)+45)*1.8,Math.abs(body.range)*1.25),weight);raise=T.MathUtils.lerp(raise,70,weight);}
  // Reserve the overlays' image area. The framing volume includes active exhaust,
  // so a powered ship never sacrifices either its nose or plume to a pane edge.
  if(camera.aspect<.9)fov=Math.min(64,fov+(1-camera.aspect)*24);
  const desktopTop=view.y===0&&this.viewportWidth>=760&&this.viewportWidth>=this.viewportHeight,clearFraction=desktopTop?.50:.66;
  let plume=0;const boosterPowered=body.kind==='booster'&&(separated?s.booster?.thrust:s.thrust)>0,shipPowered=body.kind==='ship'&&(s.thrust||0)>0;
  if(boosterPowered)plume=separated&&(s.booster?.activeEngines||0)<10?33:72;
  if(shipPowered)plume=separated?51:72;
  const inRecovery=body.kind==='booster'&&separated&&!['IMPACT','SPLASHDOWN'].includes(s.booster?.phase)&&body.altitude<700||body.kind==='ship'&&returning&&body.altitude<650;
  if(body.kind!=='capsule'&&!inRecovery){target.addScaledVector(body.axis,-plume*.5);const silhouette=body.height+plume;distance=Math.max(distance*1.15,silhouette/(2*Math.tan(fov*Math.PI/360)*clearFraction));}
  camera.position.set(target.x+Math.sin(theta)*distance,target.y+raise,Math.cos(theta)*distance);camera.up.set(0,1,0);camera.lookAt(target);camera.fov=this.frameFailure(body.kind,camera.position,target,fov);camera.lookAt(target);camera.near=.2;
  const viewHeight=Math.max(1,Math.round(view.height*this.viewportHeight)||360),viewWidth=Math.max(1,Math.round(camera.aspect*viewHeight));camera.setViewOffset(viewWidth,viewHeight,0,-viewHeight*(desktopTop?.115:.015),viewWidth,viewHeight);camera.updateProjectionMatrix();
 }
 applyInspectionVisuals(inspecting,t){
  const e=this.engineState;if(!e)return;this.boosterFlame.visible=e.boosterCount>0&&!inspecting;this.shipFlame.visible=e.shipCount>0&&!inspecting;this.capsuleFlame.visible=e.capCount>0&&!inspecting;
  for(const [bank,count,throttle] of [[this.boosterEngines,e.boosterCount,e.boosterThrottle],[this.shipEngines,e.shipCount,e.shipThrottle],[this.capsuleEngines,e.capCount,1]]){this.updateEngineBank(bank,count,throttle,t,inspecting);for(const engine of bank)engine.flame.updateMatrixWorld(true);}
 }
 renderMultiview(s,t){
  const r=this.renderer,width=this.viewportWidth,height=this.viewportHeight,views=this.getViewports(),prior={autoClear:r.autoClear,shadowAuto:r.shadowMap.autoUpdate,matrixAuto:this.scene.matrixWorldAutoUpdate,infoReset:r.info.autoReset};
  const mainPosition=this.camera.position.clone(),mainQuaternion=this.camera.quaternion.clone();
  const started=performance.now();r.info.autoReset=false;r.info.reset();r.setRenderTarget(null);r.setScissorTest(false);r.setViewport(0,0,width,height);r.autoClear=false;r.clear(true,true,true);r.setScissorTest(true);r.shadowMap.autoUpdate=false;r.shadowMap.needsUpdate=true;
  this.cabin.visible=false;this.missionRoom.visible=false;this.vehicle.visible=true;this.capsule.visible=!!s.capsule?.active&&!this.destroyedBodies.has('capsule');this.scene.updateMatrixWorld(true);this.scene.matrixWorldAutoUpdate=false;
  try{for(const view of views){
   const left=Math.round(view.x*width),right=Math.round((view.x+view.width)*width),top=Math.round(view.y*height),bottom=Math.round((view.y+view.height)*height),w=Math.max(1,right-left),h=Math.max(1,bottom-top),camera=view.primary?this.camera:this.viewCameras[view.kind],body=this.trackedBody(s,view.kind);
   camera.aspect=w/h;if(view.primary){if(this.cinematic&&!this.engineView&&!this.free&&!this.spaceportView&&body.kind!=='capsule'){camera.position.sub(this.cameraTarget).multiplyScalar(1.2).add(this.cameraTarget);camera.setViewOffset(w,h,0,h*.055,w,h);}camera.updateProjectionMatrix();}else this.positionAuxiliaryCamera(camera,body,s,view);
   r.setViewport(left,height-bottom,w,h);r.setScissor(left,height-bottom,w,h);r.clear(true,true,true);
   this.applyViewEnvironment(s,body,(!view.primary||!this.free&&!this.spaceportView)&&this.failureFX?.getFraming(body.kind)?this.failureFX.getFraming(body.kind).center.y:view.primary&&this.spaceportView?camera.position.y:view.primary&&this.free?this.freePosition.y:body.altitude,'pad',view.primary&&this.engineView&&!this.free,camera,true);
   this.applyInspectionVisuals(view.primary&&this.engineView&&!this.free,t);
   // World transforms and one shared shadow map are reused. Only the sky follows each camera.
   this.engineInspectionLight.updateMatrixWorld(true);this.shakeFailure(camera,body.kind);r.render(this.scene,camera);r.shadowMap.needsUpdate=false;
  }}finally{r.setScissorTest(false);r.setViewport(0,0,width,height);r.autoClear=prior.autoClear;r.shadowMap.autoUpdate=prior.shadowAuto;this.scene.matrixWorldAutoUpdate=prior.matrixAuto;r.info.autoReset=prior.infoReset;this.camera.position.copy(mainPosition);this.camera.quaternion.copy(mainQuaternion);this.camera.clearViewOffset();this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  this.performanceStats={views:3,drawCalls:r.info.render.calls,triangles:r.info.render.triangles,renderMs:performance.now()-started,pixelRatio:r.getPixelRatio()};
 }
 renderFrame(s,t){
  if(this.multiview&&this.mode==='pad'){this.renderMultiview(s,t);return;}
  const started=performance.now(),oldInfoReset=this.renderer.info.autoReset;this.renderer.info.autoReset=false;this.renderer.info.reset();
  const feedMat=this.missionFeedMaterial||this.interiors?.missionFeedMaterial;
  if(this.mode==='mission'&&feedMat&&t-this.lastFeed>.12){
   this.lastFeed=t;const body=this.trackedBody(s),target=body.center;
   const framing=body.kind==='capsule'?(body.chute?90:18):body.kind==='booster'?180:body.height>80?260:145;this.feedCamera.position.set(-95,6,245);this.feedCamera.lookAt(target);let distance=this.feedCamera.position.distanceTo(target);this.feedCamera.fov=clamp(2*Math.atan(Math.tan(39*Math.PI/360)*framing/Math.max(260,distance))*180/Math.PI,.003,75);const failureTarget=target.clone();this.feedCamera.fov=this.frameFailure(body.kind,this.feedCamera.position,failureTarget,this.feedCamera.fov);this.feedCamera.lookAt(failureTarget);this.feedCamera.updateProjectionMatrix();
   const roomVisible=this.missionRoom.visible,cabinVisible=this.cabin.visible,oldLights=[this.sun.intensity,this.rim.intensity,this.hemi.intensity],oldFog=this.scene.fog.density;
   this.missionRoom.visible=false;this.cabin.visible=false;const exterior=this.exteriorLighting||{sun:2.05,rim:.3,hemi:.42};this.sun.intensity=exterior.sun;this.rim.intensity=exterior.rim;this.hemi.intensity=exterior.hemi;this.scene.fog.density=oldFog/(1+Math.max(0,target.y)/180);
   this.renderer.setRenderTarget(this.feedTarget);this.renderer.render(this.scene,this.feedCamera);this.renderer.setRenderTarget(null);[this.sun.intensity,this.rim.intensity,this.hemi.intensity]=oldLights;this.scene.fog.density=oldFog;this.missionRoom.visible=roomVisible;this.cabin.visible=cabinVisible;
   if(feedMat.map!==this.feedTarget.texture){feedMat.map=this.feedTarget.texture;feedMat.needsUpdate=true;}
  }
  if(this.post)this.post.render(this.scene,this.camera,t,this.mode!=='pad');else this.renderer.render(this.scene,this.camera);this.performanceStats={views:1,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,renderMs:performance.now()-started,pixelRatio:this.renderer.getPixelRatio()};this.renderer.info.autoReset=oldInfoReset;
 }
 dispose(){this.disposed=true;this.failureFX?.dispose?.();this.spaceport?.dispose?.();this.canvas.removeEventListener('pointerdown',this.onDown);this.canvas.removeEventListener('pointermove',this.onMove);this.canvas.removeEventListener('pointerup',this.onUp);this.canvas.removeEventListener('pointercancel',this.onUp);this.canvas.removeEventListener('wheel',this.onWheel);let seen=new Set();this.scene.traverse(o=>{o.geometry?.dispose();let ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{if(m&&!seen.has(m)){seen.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)v.dispose()});m.dispose()}})});this.pbrTextureCache?.clear();this.pbrSourceCache?.clear();this.env.dispose();this.post?.dispose();this.feedTarget?.dispose();this.hdrEnv?.dispose();this.envTarget?.dispose();this.skyPanorama?.dispose();this.renderer.dispose();}
}
window.StarbaseScene=StarbaseScene;
})();
