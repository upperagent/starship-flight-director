/* FICTIONAL STARBASE / mature transport network.
   Background traffic is an authored, deterministic operational vignette. Its
   real-time clock is independent of the primary vehicle's physics/time warp. */
(function () {
'use strict';
const T=window.THREE,TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const material=(color,metalness=0,roughness=.85)=>new T.MeshStandardMaterial({color,metalness,roughness});
const phases=[['READY',25],['ASCENT',110],['TRANSFER',195],['RETURN',255],['LANDING',280],['CAPTURED',312],['TURNAROUND',360]];
function merge(list){
 const data={position:[],normal:[],uv:[]};
 for(const item of list){let g=item.geometry.index?item.geometry.toNonIndexed():item.geometry.clone();if(item.matrix)g.applyMatrix4(item.matrix);const count=g.attributes.position.count;for(const key in data){const a=g.attributes[key];if(a)data[key].push(...a.array);else for(let k=0;k<count*(key==='uv'?2:3);k++)data[key].push(0);}g.dispose();}
 const geo=new T.BufferGeometry();for(const key in data)geo.setAttribute(key,new T.Float32BufferAttribute(data[key],key==='uv'?2:3));geo.computeBoundingSphere();return geo;
}
class ActiveSpaceport {
 constructor(host){
  this.host=host;this.enabled=true;this.clock=0;this.events=[];this.groups=[];this.resources=new Set();this.dummy=new T.Object3D();
  this.staticRoot=new T.Group();this.staticRoot.name='Fictional active spaceport infrastructure';(host.ground||host.scene).add(this.staticRoot);
  this.dynamicRoot=new T.Group();this.dynamicRoot.name='Shared live traffic fleet';host.scene.add(this.dynamicRoot);
  this.atmosphereRoot=new T.Group();this.atmosphereRoot.name='Coastal horizon cloud banks';host.scene.add(this.atmosphereRoot);
  this.groups.push(this.staticRoot,this.dynamicRoot,this.atmosphereRoot);this.batches=new Map();
  this.mat={steel:material(0xbac0bd,.8,.43),tile:material(0x1c292d,.25,.82),tower:material(0x697574,.5,.7),concrete:material(0xb2a188,0,.96),apron:material(0x3b5055,0,.92),roof:material(0xa8aaa0,.27,.71),wall:material(0x929689,.1,.9),road:material(0x333f3d,0,.96),sand:material(0x777e65,0,1),dark:material(0x263638,.2,.88),amber:new T.MeshBasicMaterial({color:0xe8bb78}),mint:new T.MeshBasicMaterial({color:0xa3d8c8}),red:new T.MeshBasicMaterial({color:0xe95d43}),solar:material(0x183e52,.35,.48),scrub:material(0x5b6850,0,1),foam:material(0xa5b7a9,0,1)};
  Object.values(this.mat).forEach(x=>this.resources.add(x));
  this.geos={box:new T.BoxGeometry(1,1,1),cylinder:new T.CylinderGeometry(1,1,1,12),ball:new T.SphereGeometry(1,10,6),cone:new T.ConeGeometry(1,1,12),ring:new T.TorusGeometry(1,.012,5,48)};Object.values(this.geos).forEach(x=>this.resources.add(x));
  this.ports=[
   {id:'02',name:'AURORA 12',route:'LUNAR FREIGHT',x:-210,z:-470,offset:51},
   {id:'03',name:'MERIDIAN 08',route:'ORBITAL TRANSFER',x:370,z:-740,offset:243},
   {id:'04',name:'KEPLER 21',route:'CREW ARRIVAL',x:-400,z:-1120,offset:272},
   {id:'05',name:'HORIZON 06',route:'STATION RESUPPLY',x:665,z:-1510,offset:8},
   {id:'06',name:'ODYSSEY 17',route:'DEEP SPACE CARGO',x:5,z:-1890,offset:98}
  ];
  this.buildTerrain();this.ports.forEach((port,i)=>this.buildPort(port,i));this.buildDistrict();this.buildContext();this.flushBatches();this.buildFleet();this.buildClouds();this.buildHorizonHaze();this.update({},0,0);
 }
 instance(geo,mat,position,scale,rotation){
  const key=geo+'|'+mat;let batch=this.batches.get(key);if(!batch){batch={geo:this.geos[geo],mat:this.mat[mat],matrices:[]};this.batches.set(key,batch);}
  const d=this.dummy;d.position.copy(position);d.scale.copy(scale);d.rotation.set(0,0,0);if(rotation){if(rotation.isQuaternion)d.quaternion.copy(rotation);else d.rotation.set(...rotation);}d.updateMatrix();batch.matrices.push(d.matrix.clone());
 }
 box(mat,x,y,z,w,h,d,rotation){this.instance('box',mat,v(x,y,z),v(w,h,d),rotation)}
 cylinder(mat,x,y,z,r,h){this.instance('cylinder',mat,v(x,y,z),v(r,h,r))}
 bar(mat,a,b,r){const dir=b.clone().sub(a);this.instance('box',mat,a.clone().add(b).multiplyScalar(.5),v(r,dir.length(),r),new T.Quaternion().setFromUnitVectors(v(0,1,0),dir.normalize()));}
 flushBatches(){
  for(const batch of this.batches.values()){const mesh=new T.InstancedMesh(batch.geo,batch.mat,batch.matrices.length);batch.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.receiveShadow=false;mesh.castShadow=false;mesh.computeBoundingSphere();this.staticRoot.add(mesh);}this.batches.clear();
 }
 buildTerrain(){
  // Low dunes make the industrial cape sit in a coastline rather than on a void.
  const geo=new T.PlaneGeometry(6400,6400,80,80),p=geo.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){const x=p.getX(i)-1250,z=-p.getY(i)-3340,coast=610+Math.sin(z*.0011)*140+Math.sin(z*.003)*65;let h=x>coast?-7:Math.max(0,Math.sin(x*.003+z*.002)*7+Math.sin(z*.008)*2)*smooth((Math.abs(x+350)-230)/450)-.55;for(const site of this.ports){const d=Math.hypot(x-site.x,z-site.z);if(d<130)h=Math.min(h,0);if(d<110)h=Math.max(h,-.4);}p.setZ(i,h);const n=random(i+750),c=new T.Color().setRGB(.31+n*.075,.32+n*.065,.255+n*.055);colors.push(c.r,c.g,c.b);}
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0});const land=new T.Mesh(geo,mat);land.rotation.x=-Math.PI/2;land.position.set(-1250,0,-3340);this.staticRoot.add(land);this.resources.add(geo);this.resources.add(mat);
  // Barrier islands, dredged harbor walls and wave-facing pale beaches.
  for(let i=0;i<7;i++){const x=1550+i*170,z=-4100-i*430;this.instance('ball','sand',v(x,-2,z),v(180+random(i)*90,10+random(i+9)*10,380));}
  for(let i=0;i<3;i++){this.box('concrete',700+i*115,1,-2510,12,4,430);this.box('apron',700+i*115,3.2,-2510,8,.5,426);for(let k=0;k<7;k++)this.box('amber',700+i*115,5,-2700+k*60,1,1,1);}
 }
 buildPort(p,i){
  const x=p.x,z=p.z,tx=x+28,tz=z-17;
  this.cylinder('sand',x,-.6,z,109,1.3);this.cylinder('concrete',x,.05,z,88,1);this.cylinder('apron',x,.62,z,68,.22);this.cylinder('tower',x,11,z,12,6);
  for(let a=0;a<6;a++){let r=a*TAU/6;this.bar('tower',v(x+Math.sin(r)*16,1,z+Math.cos(r)*16),v(x+Math.sin(r)*11,14,z+Math.cos(r)*11),1.6);}
  // Thick four-column tower with cross-bracing and two catch arms.
  for(const xx of [-7,7])for(const zz of [-7,7])this.box('tower',tx+xx,76,tz+zz,1.6,152,1.6);
  this.box('dark',tx+2,74,tz-1,5,148,5);
  for(let y=8;y<151;y+=12){this.box('tower',tx,y,tz,16,1,16);for(const side of [-1,1]){this.bar('tower',v(tx-7,y,tz+side*7),v(tx+7,y+12,tz+side*7),.52);this.bar('tower',v(tx+side*7,y,tz-7),v(tx+side*7,y+12,tz+7),.52);}}
  this.box('roof',tx,154,tz,18,3,18);this.box('wall',tx+2,157,tz,5,4,6);this.bar('tower',v(tx,154,tz),v(tx,173,tz),.24);
  for(const side of [-1,1]){this.box('tower',tx-19,80,tz+17+side*5,34,2,2);this.bar('tower',v(tx-5,89,tz+17+side*5),v(tx-34,80,tz+17+side*5),.58);}
  for(let y of [53,110,160,173])this.box('red',tx,y,tz+8,.7,.7,.7);
  for(let a=0;a<12;a++){const q=a*TAU/12;this.box('mint',x+Math.sin(q)*72,1.3,z+Math.cos(q)*72,1,.65,1);}
  // Cryogenic storage, process racks, fire-water reservoir and support sheds.
  for(let k=0;k<5;k++){const xx=x-100-(k%3)*19,zz=z-40-Math.floor(k/3)*25;this.cylinder('roof',xx,17,zz,7,34);this.instance('ball','roof',v(xx,34,zz),v(7,2.5,7));this.box('tower',xx+7.5,18,zz,.7,36,.7);}
  this.cylinder('wall',x-100,8,z+34,15,16);this.box('wall',x-120,5.5,z+70,65,11,31);this.box('roof',x-120,11.4,z+70,68,.8,33);
  for(let k=0;k<5;k++)this.box('dark',x-146+k*13,5,z+86,10,8,.4);
  this.box('road',x-100,.9,z+121,208,.4,13);this.box('road',x-200,.9,z,14,.4,250);for(let k=0;k<8;k++)this.box('amber',x-190+k*25,1.15,z+121,8,.02,.35);
  for(let a=0;a<4;a++){const q=a*TAU/4;const xx=x+Math.sin(q)*76,zz=z+Math.cos(q)*76;this.box('tower',xx,13,zz,.65,26,.65);this.box('amber',xx,26,zz,3,.6,1);}
  // Very low geometric complexity labels are distinct in the overview camera.
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const g=canvas.getContext('2d');g.fillStyle='#24383b';g.fillRect(0,0,256,64);g.fillStyle='#d4ded7';g.font='bold 32px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('PORT '+p.id,128,33);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const labelMat=new T.MeshBasicMaterial({map:tex});const labelGeo=new T.PlaneGeometry(11,2.75);const label=new T.Mesh(labelGeo,labelMat);label.position.set(tx,137,tz+8.1);this.staticRoot.add(label);this.resources.add(tex);this.resources.add(labelMat);this.resources.add(labelGeo);
 }
 buildDistrict(){
  // Transit spine, fabrication campus and a cargo interchange behind the pads.
  this.box('road',-720,.2,-1700,23,.5,3150);this.box('road',-290,.21,-2240,890,.5,22);
  for(let k=0;k<46;k++)this.box('amber',-720,.48,-160-k*67,.4,.01,20);
  for(let i=0;i<8;i++){const x=-970-(i%3)*130,z=-420-Math.floor(i/3)*185;this.box('wall',x,26,z,100,52,145);this.box('roof',x,52.8,z,103,1.5,149);this.box('dark',x,22,z+73,75,43,.4);for(let j=0;j<6;j++)this.box('tower',x-48+j*19,25,z+74,.8,50,.7);this.box('mint',x,49,z+74,72,.65,.3);}
  for(let i=0;i<16;i++){const x=-485+(i%8)*60,z=-2450-Math.floor(i/8)*75;this.box('roof',x,5,z,42,10,25);this.box('dark',x,5,z+13,20,7,.3);}
  for(let i=0;i<38;i++){const x=-1000+random(i+90)*640,z=-2100-random(i+280)*550;this.box(i%2?'wall':'dark',x,2.7,z,12,5.4,26);}
  // Small highway traffic motion is supplied separately, using two instanced meshes.
  this.truckBody=new T.InstancedMesh(this.geos.box,this.mat.roof,hostLow(this.host)?4:9);this.truckCab=new T.InstancedMesh(this.geos.box,this.mat.dark,this.truckBody.count);this.dynamicRoot.add(this.truckBody,this.truckCab);this.truckBody.instanceMatrix.setUsage(T.DynamicDrawUsage);this.truckCab.instanceMatrix.setUsage(T.DynamicDrawUsage);
 }
 buildContext(){
  for(const p of this.ports){
   // Road connections and clear transport markings reveal the scale from above.
   const length=p.x+520,mid=-720+length*.5,roadZ=p.z+121;
   this.box('road',mid,.85,roadZ,length,.35,15);
   for(let x=-712;x<p.x-210;x+=25)this.box('amber',x,1.04,roadZ,10,.035,.28);
   for(const side of [-1,1])this.box('roof',mid,1.05,roadZ+side*6.4,length,.028,.22);
   for(let n=0;n<6;n++)this.box('roof',p.x-207+n*2.4,1.11,roadZ,1.1,.025,11);
   // Independent concrete recovery circle with painted H and approach markings.
   const lx=p.x+120,lz=p.z+34;
   this.cylinder('concrete',lx,.25,lz,39,1);this.cylinder('apron',lx,.79,lz,32,.1);
   this.instance('ring','roof',v(lx,.88,lz),v(29,29,29),[-Math.PI/2,0,0]);
   for(const side of [-1,1])this.box('roof',lx+side*8,.89,lz,1.8,.05,20);this.box('roof',lx,.89,lz,16,.05,1.8);
   for(let j=0;j<8;j++){const a=j*TAU/8;this.box('mint',lx+Math.sin(a)*36,1.1,lz+Math.cos(a)*36,.9,.4,.9);}
   // Numbered service bays, reusable container stacks and apron parking stripes.
   this.box('concrete',p.x-143,.36,p.z+151,95,.55,40);
   for(let j=0;j<9;j++){this.box('roof',p.x-187+j*11,.66,p.z+151,.16,.035,34);if(j%3!==2){this.box(j%2?'solar':'wall',p.x-182+j*11,2.3,p.z+151,8,3.2,22);this.box('roof',p.x-182+j*11,4,p.z+151,8,.2,22);}}
   for(let j=0;j<4;j++){this.box('tower',p.x-190+j*27,8,p.z+174,.3,16,.3);this.box('amber',p.x-190+j*27,16,p.z+174,2.5,.45,.6);}
  }
  // Clean-energy service campus and terraced solar arrays use one shared draw.
  this.box('concrete',-1160,.05,-1580,570,.3,260);
  for(let row=0;row<9;row++)for(let col=0;col<20;col++){
   const x=-1420+col*27,z=-1682+row*27;
   this.box('solar',x,2.3,z,23,.25,18,[.20,0,0]);
   this.box('tower',x,1.2,z,1.1,2.4,8);
   this.box('roof',x,2.54,z,.11,.04,18,[.20,0,0]);
  }
  // Sparse salt-marsh patches break up the flat terrain without texture assets.
  for(let i=0;i<280;i++){
   const x=-1580+random(i+1080)*2320,z=-290-random(i+908)*2300;
   if(this.ports.some(p=>Math.hypot(x-p.x,z-p.z)<180)||Math.abs(x+720)<25||x>500)continue;
   this.instance('ball','scrub',v(x,-.05,z),v(3+random(i+164)*10,.15+random(i+295)*.3,3+random(i+134)*7));
  }
  // A pale, irregular surf edge guides the eye along the far coastal horizon.
  for(let z=-1440;z>-6050;z-=55){
   const coast=q=>610+Math.sin(q*.0011)*140+Math.sin(q*.003)*65;
   const a=coast(z),b=coast(z-55),length=Math.hypot(b-a,55);
   this.box('foam',(a+b)*.5+12,-1.74,z-27.5,17,.07,length+2,[0,Math.atan2(b-a,-55),0]);
  }
 }

 buildFleet(){
  const shaped=[],dark=[],boost=[];const pose=(geometry,x,y,z,sx=1,sy=1,sz=1,rz=0)=>{const d=new T.Object3D();d.position.set(x,y,z);d.scale.set(sx,sy,sz);d.rotation.z=rz;d.updateMatrix();this.resources.add(geometry);return {geometry,matrix:d.matrix}};
  const profile=[[4.5,0],[4.5,30],[4.15,35],[3.3,40],[2.2,45],[.75,49],[.04,50]].map(p=>new T.Vector2(...p));shaped.push(pose(new T.LatheGeometry(profile,16),0,0,0));dark.push(pose(new T.LatheGeometry(profile.map(p=>new T.Vector2(p.x+.025,p.y)),12,Math.PI*.55,Math.PI*.85),0,0,0));
  for(let side of [-1,1])for(let y of [7,37])dark.push(pose(new T.BoxGeometry(4.5,8,.45),side*6,y,0,1,y===7?1:.7,1,side*-.19));
  for(let i=0;i<6;i++){let a=i*TAU/6;dark.push(pose(new T.CylinderGeometry(.55,1,2,10,1,true),Math.sin(a)*2.5,-.4,Math.cos(a)*2.5));}
  boost.push(pose(new T.CylinderGeometry(4.5,4.5,69,16),0,35.5,0));for(let i=0;i<4;i++){let a=i*TAU/4;boost.push(pose(new T.BoxGeometry(3,1,5),Math.sin(a)*5.5,65,Math.cos(a)*5.5));}
  this.shipGeo=merge(shaped);this.tileGeo=merge(dark);this.boostGeo=merge(boost);this.resources.add(this.shipGeo);this.resources.add(this.tileGeo);this.resources.add(this.boostGeo);
  for(const [name,geo,mat] of [['ships',this.shipGeo,this.mat.steel],['tiles',this.tileGeo,this.mat.tile],['boosters',this.boostGeo,this.mat.steel]]){this[name]=new T.InstancedMesh(geo,mat,this.ports.length);this[name].instanceMatrix.setUsage(T.DynamicDrawUsage);this[name].frustumCulled=false;this.dynamicRoot.add(this[name]);}
  this.buildPlumes();
 }
 buildPlumes(){
  // One shader draw for all five flames, one for each ship's expanding trail.
  const geo=new T.ConeGeometry(1,1,12,5,true);geo.translate(0,-.5,0);geo.rotateZ(Math.PI);geo.translate(0,-1,0);
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float time;void main(){float d=vUv.y;float pulse=.88+.12*sin(vUv.y*82.+time*22.);float edge=pow(max(0.,sin(vUv.x*3.14159)),.4);vec3 c=mix(vec3(3.,.49,.09),vec3(1.2,1.9,3.),pow(1.-d,5.));float a=pow(1.-d,.48)*edge*pulse;gl_FragColor=vec4(c,a*.85);}'});
  this.flames=new T.InstancedMesh(geo,mat,this.ports.length);this.flames.instanceMatrix.setUsage(T.DynamicDrawUsage);this.flames.frustumCulled=false;this.dynamicRoot.add(this.flames);this.resources.add(geo);this.resources.add(mat);this.flameMaterial=mat;
  // Shared world centers, soft billboards independently facing each live camera.
  // A radial noise mask prevents rectangular particles or hard cylinder bands.
  const puffGeo=new T.PlaneGeometry(1,1);
  const puffVertex='varying vec2 vUv;varying float vOpacity;void main(){vUv=uv;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));vOpacity=clamp(length(instanceMatrix[2].xyz),0.,1.);center.xy+=position.xy*size;gl_Position=projectionMatrix*center;}';
  const puffFragment='varying vec2 vUv;varying float vOpacity;uniform vec3 color;uniform float density;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}void main(){vec2 q=(vUv-.5)*2.;float n=noise(vUv*5.)*.55+noise(vUv*11.)*.30+noise(vUv*23.)*.15;float radius=length(q);float edge=1.-smoothstep(.25,.96,radius+n*.22);float a=edge*edge*(.35+n*.65)*density*vOpacity;if(a<.003)discard;gl_FragColor=vec4(color*(.82+n*.22),a);}';
  const trailMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{color:{value:new T.Color(0xd6d1c6)},density:{value:.30}},vertexShader:puffVertex,fragmentShader:puffFragment});
  this.trailCount=this.host.low?16:24;
  this.trails=new T.InstancedMesh(puffGeo,trailMat,this.ports.length*this.trailCount);this.trails.instanceMatrix.setUsage(T.DynamicDrawUsage);this.trails.frustumCulled=false;this.dynamicRoot.add(this.trails);this.resources.add(puffGeo);this.resources.add(trailMat);
  const puffMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{color:{value:new T.Color(0xc1b39d)},density:{value:.34}},vertexShader:puffVertex,fragmentShader:puffFragment});
  this.dust=new T.InstancedMesh(puffGeo,puffMat,this.ports.length*8);this.dust.instanceMatrix.setUsage(T.DynamicDrawUsage);this.dust.frustumCulled=false;this.dynamicRoot.add(this.dust);this.resources.add(puffMat);
 }
 buildClouds(){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const g=canvas.getContext('2d');for(let i=0;i<25;i++){let x=35+random(i+5)*180,y=52+random(i+15)*30,r=12+random(i+24)*28;const a=g.createRadialGradient(x,y,0,x,y,r);a.addColorStop(0,'rgba(245,241,225,.21)');a.addColorStop(.5,'rgba(223,225,216,.14)');a.addColorStop(1,'rgba(216,224,223,0)');g.fillStyle=a;g.fillRect(x-r,y-r,r*2,r*2);}const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;this.resources.add(tex);
  const geometry=new T.InstancedBufferGeometry();const plane=new T.PlaneGeometry(1,1);geometry.index=plane.index;geometry.attributes=plane.attributes;const count=hostLow(this.host)?7:15,centers=[],sizes=[];for(let i=0;i<count;i++){centers.push(-3600+random(i+505)*7500,1150+random(i+707)*430,-3000-random(i+802)*6500);sizes.push(1200+random(i+212)*1450,250+random(i+918)*370);}geometry.setAttribute('center',new T.InstancedBufferAttribute(new Float32Array(centers),3));geometry.setAttribute('cloudSize',new T.InstancedBufferAttribute(new Float32Array(sizes),2));geometry.instanceCount=count;
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,fog:true,uniforms:{map:{value:tex},time:{value:0},night:{value:0},fogColor:{value:this.host.scene.fog.color},fogDensity:{value:.0001}},vertexShader:'attribute vec3 center;attribute vec2 cloudSize;uniform float time;varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){vUv=uv;vec3 c=center+vec3(time*1.2,0.,0.);vec4 mvPosition=modelViewMatrix*vec4(c,1.);mvPosition.xy+=position.xy*cloudSize;gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',fragmentShader:'uniform sampler2D map;uniform float night;varying vec2 vUv;\n#include <fog_pars_fragment>\nvoid main(){vec4 c=texture2D(map,vUv);c.rgb*=1.-night*.8;gl_FragColor=vec4(c.rgb,c.a*.55);\n#include <fog_fragment>\n}'});const clouds=new T.Mesh(geometry,mat);clouds.frustumCulled=false;this.atmosphereRoot.add(clouds);this.cloudMaterial=mat;this.resources.add(geometry);this.resources.add(mat);
 }
 buildHorizonHaze(){
  // The local terrain and far globe meet a photographic sky at the horizon.
  // A shallow marine haze blends that tonal seam only in the port overview.
  const geometry=new T.SphereGeometry(100000,32,16);
  const amount={value:0};
  const mat=new T.MeshBasicMaterial({color:this.host.scene.fog.color,transparent:true,opacity:1,depthWrite:false,depthTest:true,side:T.BackSide,fog:false,toneMapped:false});
  mat.onBeforeCompile=shader=>{
   shader.uniforms.overviewHaze=amount;
   shader.vertexShader='varying vec3 hazeWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nhazeWorld=(modelMatrix*vec4(position,1.)).xyz;');
   shader.fragmentShader='varying vec3 hazeWorld;uniform float overviewHaze;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','float rayHeight=normalize(hazeWorld-cameraPosition).y;float marineBand=exp(-pow((rayHeight+.014)/.047,2.));diffuseColor.a*=marineBand*.99*overviewHaze;\n#include <opaque_fragment>');
  };
  const haze=new T.Mesh(geometry,mat);haze.frustumCulled=false;haze.renderOrder=-75;
  haze.onBeforeRender=(renderer,scene,camera)=>{
   amount.value=this.host.spaceportView&&camera===this.host.camera&&!this.host.night?1-smooth((camera.position.y-900)/2100):0;
   haze.position.copy(camera.position);haze.updateMatrixWorld(true);mat.color.copy(this.host.scene.fog.color);
  };
  this.atmosphereRoot.add(haze);this.resources.add(geometry);this.resources.add(mat);
 }

 matrix(mesh,index,x,y,z,sx,sy,sz,tilt=0){const d=this.dummy;d.position.set(x,y,z);d.rotation.set(0,0,tilt);d.scale.set(sx,sy,sz);d.updateMatrix();mesh.setMatrixAt(index,d.matrix);}
 update(state={},visualDt=0){
  if(!this.enabled)return;this.clock+=clamp(Number(visualDt)||0,0,.2);const t=this.clock;
  this.flameMaterial.uniforms.time.value=t;this.cloudMaterial.uniforms.time.value=t;this.cloudMaterial.uniforms.night.value=this.host.night?1:0;this.cloudMaterial.uniforms.fogDensity.value=this.host.scene.fog.density*.45;
  for(let i=0;i<this.ports.length;i++){
   const p=this.ports[i],u=(t+p.offset)%360,phase=phases.find(x=>u<x[1])||phases[0];let x=p.x,z=p.z,y=15,tilt=0,fire=0,full=1,visible=1,trail=0;
   if(u<25){y=15;}
   else if(u<70){const q=u-25;y=15+.26*q*q;x+=.024*q*q;tilt=-.055*smooth(q/25);fire=1;trail=clamp(q/28);}
   else if(u<110){const q=u-70;y=541+23.4*q+2*q*q;x+=48.6+2.16*q+.1*q*q;tilt=-.13;fire=1;trail=1;}
   else if(u<195){visible=0;y=10000;full=0;}
   else if(u<255){const q=(u-195)/60;full=0;y=280+4720*(1-q)*(1-q);x+=340*(1-q)*(1-q);tilt=.13*(1-q);fire=.38+.08*(1-q);}
   else if(u<280){const q=(u-255)/25;full=0;y=75+205*(1-q)*(1-q);fire=.35+.2*(1-q);}
   else if(u<312){full=0;y=75;}
   else{y=75+11*smooth((u-312)/48);full=smooth((u-326)/24);}
   // Launch phases place the upper stage above a 71 m booster. Captured ships
   // descend to the catch altitude, then undergo a visible slow turnaround lift.
   const shipY=u<110?y+71:y;
   const k=visible?1:0;
   this.matrix(this.ships,i,x-Math.sin(tilt)*(u<110?71:0),shipY,z,k,k,k,tilt);this.matrix(this.tiles,i,x-Math.sin(tilt)*(u<110?71:0),shipY,z,k,k,k,tilt);
   this.matrix(this.boosters,i,x,u<110?y:15,z,k*full,k*full,k*full,tilt);
   const nozzleY=u<110?y:shipY;const flameLength=(u<110?90:35)*fire*(.95+.05*Math.sin(t*30+i));this.matrix(this.flames,i,x,nozzleY-.3,z,5*fire,flameLength,5*fire,tilt);
   for(let n=0;n<this.trailCount;n++){
    const age=(n+.5)/this.trailCount,wake=Math.min(1800,Math.max(0,nozzleY-20)),behind=age*wake,drift=age*age*38;
    const width=22+age*100,height=Math.max(width*.8,wake/this.trailCount*2.8),alpha=trail*k*smooth((1-age)*4)*smooth(age*12)*.85;
    this.matrix(this.trails,i*this.trailCount+n,x-(x-p.x)*age*.65+drift+Math.sin(i+n*2.4)*width*.14,nozzleY-behind,z+Math.cos(n*1.7)*width*.1,width,height,alpha);
   }
   const dustFactor=fire*clamp(1-nozzleY/230);for(let n=0;n<8;n++){const age=(t*.14+n/8)%1,angle=n*TAU/8,r=12+age*74;this.matrix(this.dust,i*8+n,p.x+Math.sin(angle)*r,4+age*9,p.z+Math.cos(angle)*r,35+age*62,16+age*29,dustFactor*(1-age)*.9);}
   p.altitude=Math.max(0,Math.round(shipY));p.eta=Math.ceil(phase[1]-u);p.progress=u/360;p.phase=phase[0];p.visible=!!visible;
   if(p.lastPhase&&p.lastPhase!==p.phase){this.events.push({port:p.id,name:p.name,route:p.route,phase:p.phase,time:t});if(this.events.length>16)this.events.shift();}p.lastPhase=p.phase;
  }
  for(const mesh of [this.ships,this.tiles,this.boosters,this.flames,this.trails,this.dust])mesh.instanceMatrix.needsUpdate=true;
  for(let i=0;i<this.truckBody.count;i++){let z=-210-((i*319+t*8)%2670),x=-720+(i%2?5:-5);this.matrix(this.truckBody,i,x,2.5,z,3.6,4,12);this.matrix(this.truckCab,i,x,2.2,z+(i%2?8:-8),3.6,3.4,4);}
  this.truckBody.instanceMatrix.needsUpdate=true;this.truckCab.instanceMatrix.needsUpdate=true;
 }
 getTraffic(){return this.ports.map(p=>({port:'PORT '+p.id,name:p.name,route:p.route,phase:p.phase,eta:p.eta,altitude:p.altitude,visible:p.visible}));}
 drainEvents(){return this.events.splice(0);}
 getOverview(){return {position:[-650,430,700],target:[80,20,-850],fov:59};}
 setEnabled(enabled){this.enabled=!!enabled;this.groups.forEach(g=>g.visible=this.enabled);}
 dispose(){this.groups.forEach(g=>g.removeFromParent());this.resources.forEach(r=>r.dispose?.());this.resources.clear();}
}
function hostLow(host){return !!host.low;}
window.ActiveSpaceport=ActiveSpaceport;
})();
