/* STARBASE rendering pipeline · linear-light bloom, filmic output, physical environment. */
(function(){
'use strict';const T=THREE;
class FlightRenderer {
 constructor(renderer,settings={}){
  this.renderer=renderer;this.enabled=settings.quality!=='low';this.width=1;this.height=1;
  const options={type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true};
  this.sceneTarget=new T.WebGLRenderTarget(1,1,options);this.sceneTarget.samples=renderer.capabilities.isWebGL2&&settings.quality==='high'?4:0;this.glowA=new T.WebGLRenderTarget(1,1,{...options,depthBuffer:false});this.glowB=new T.WebGLRenderTarget(1,1,{...options,depthBuffer:false});
  this.screen=new T.Scene();this.camera=new T.OrthographicCamera(-1,1,1,-1,0,1);this.quad=new T.Mesh(new T.PlaneGeometry(2,2));this.screen.add(this.quad);
  const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  this.blur=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{image:{value:null},direction:{value:new T.Vector2()},extract:{value:1}},vertexShader:vertex,fragmentShader:`varying vec2 vUv;uniform sampler2D image;uniform vec2 direction;uniform float extract;vec3 sampleGlow(vec2 uv){vec3 c=texture2D(image,uv).rgb;return mix(c,max(c-vec3(.85),vec3(0.)),extract);}void main(){vec3 c=sampleGlow(vUv)*.227027;c+=sampleGlow(vUv+direction*1.384615)*.316216;c+=sampleGlow(vUv-direction*1.384615)*.316216;c+=sampleGlow(vUv+direction*3.230769)*.07027;c+=sampleGlow(vUv-direction*3.230769)*.07027;gl_FragColor=vec4(c,1.);}`});
  this.composite=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{sceneImage:{value:this.sceneTarget.texture},bloom:{value:this.glowB.texture},time:{value:0},interior:{value:0}},vertexShader:vertex,fragmentShader:`varying vec2 vUv;uniform sampler2D sceneImage;uniform sampler2D bloom;uniform float time;uniform float interior;float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}void main(){vec3 c=texture2D(sceneImage,vUv).rgb+texture2D(bloom,vUv).rgb*mix(.105,.07,interior);float vignette=smoothstep(.9,.14,length((vUv-.5)*vec2(1.,.8)));c*=mix(.86,1.025,vignette);c=mix(vec3(dot(c,vec3(.2126,.7152,.0722))),c,1.025);gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
gl_FragColor.rgb+=(hash(vUv*1800.+fract(time)*100.)-.5)*.0025;}`});
 }
 setQuality(quality){this.enabled=quality!=='low';const samples=this.renderer.capabilities.isWebGL2&&quality==='high'?4:0;if(this.sceneTarget.samples!==samples){this.sceneTarget.samples=samples;this.sceneTarget.dispose();}}
 resize(w,h){const pr=this.renderer.getPixelRatio();this.width=Math.max(1,Math.floor(w*pr));this.height=Math.max(1,Math.floor(h*pr));this.sceneTarget.setSize(this.width,this.height);this.glowA.setSize(Math.floor(this.width/3)||1,Math.floor(this.height/3)||1);this.glowB.setSize(Math.floor(this.width/3)||1,Math.floor(this.height/3)||1);}
 render(scene,camera,time,interior){const r=this.renderer;if(!this.enabled){r.setRenderTarget(null);r.render(scene,camera);return;}r.setRenderTarget(this.sceneTarget);r.render(scene,camera);this.quad.material=this.blur;this.blur.uniforms.image.value=this.sceneTarget.texture;this.blur.uniforms.extract.value=1;this.blur.uniforms.direction.value.set(2/this.width,0);r.setRenderTarget(this.glowA);r.render(this.screen,this.camera);this.blur.uniforms.image.value=this.glowA.texture;this.blur.uniforms.extract.value=0;this.blur.uniforms.direction.value.set(0,3/this.height);r.setRenderTarget(this.glowB);r.render(this.screen,this.camera);this.quad.material=this.composite;this.composite.uniforms.time.value=time;this.composite.uniforms.interior.value=interior?1:0;r.setRenderTarget(null);r.render(this.screen,this.camera);}
 dispose(){this.sceneTarget.dispose();this.glowA.dispose();this.glowB.dispose();this.blur.dispose();this.composite.dispose();this.quad.geometry.dispose();}
}
window.FlightRenderer=FlightRenderer;
})();
