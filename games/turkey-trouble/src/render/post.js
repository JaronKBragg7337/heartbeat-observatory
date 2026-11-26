// Turkey Trouble: the finishing pass. The scene is drawn into a high-range picture; bright things bleed (bloom), then the
// picture is toned for the screen with a vignette and a little film grain. Small on purpose: it has to run on a phone.
import * as THREE from 'three';

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';
const PRE = /* glsl */`
  varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold;
  vec3 take( vec2 o ) { vec3 c = texture2D( tSrc, vUv + o * uTexel ).rgb; c = min( c, vec3( 60.0 ) ); float l = max( c.r, max( c.g, c.b ) ); return c * smoothstep( uThreshold * 0.6, uThreshold * 1.6, l ); }
  void main() { gl_FragColor = vec4( ( take( vec2( -1.0, -1.0 ) ) + take( vec2( 1.0, -1.0 ) ) + take( vec2( -1.0, 1.0 ) ) + take( vec2( 1.0, 1.0 ) ) ) * 0.25, 1.0 ); }`;
const DOWN = /* glsl */`
  varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel;
  void main() { vec3 c = texture2D( tSrc, vUv ).rgb * 4.0;
    c += texture2D( tSrc, vUv + vec2( -1.0, -1.0 ) * uTexel ).rgb + texture2D( tSrc, vUv + vec2( 1.0, -1.0 ) * uTexel ).rgb + texture2D( tSrc, vUv + vec2( -1.0, 1.0 ) * uTexel ).rgb + texture2D( tSrc, vUv + vec2( 1.0, 1.0 ) * uTexel ).rgb;
    gl_FragColor = vec4( c * 0.125, 1.0 ); }`;
const UP = /* glsl */`
  varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uGain;
  void main() { vec3 c = texture2D( tSrc, vUv + vec2( -1.0, 0.0 ) * uTexel ).rgb + texture2D( tSrc, vUv + vec2( 1.0, 0.0 ) * uTexel ).rgb + texture2D( tSrc, vUv + vec2( 0.0, -1.0 ) * uTexel ).rgb + texture2D( tSrc, vUv + vec2( 0.0, 1.0 ) * uTexel ).rgb;
    c = c * 2.0 + texture2D( tSrc, vUv + vec2( -1.0, -1.0 ) * uTexel ).rgb + texture2D( tSrc, vUv + vec2( 1.0, -1.0 ) * uTexel ).rgb + texture2D( tSrc, vUv + vec2( -1.0, 1.0 ) * uTexel ).rgb + texture2D( tSrc, vUv + vec2( 1.0, 1.0 ) * uTexel ).rgb;
    gl_FragColor = vec4( c * ( uGain / 12.0 ), 1.0 ); }`;
const FINAL = /* glsl */`
  varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uBloom; uniform float uTime; uniform float uGrain; uniform float uVig; uniform float uSat; uniform float uContrast; uniform vec2 uRes;
  float hash( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
  void main() {
    vec3 c = texture2D( tScene, vUv ).rgb + texture2D( tBloom, vUv ).rgb * uBloom;
    vec2 q = vUv - 0.5;
    c *= 1.0 - smoothstep( 0.18, 0.95, dot( q, q ) * 2.3 ) * uVig;
    gl_FragColor = vec4( c, 1.0 );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    vec3 o = gl_FragColor.rgb;
    float l = dot( o, vec3( 0.2126, 0.7152, 0.0722 ) );
    o = mix( vec3( l ), o, uSat );
    o = mix( o, o * o * ( 3.0 - 2.0 * o ), uContrast );
    o += ( hash( vUv * uRes + fract( uTime ) * 91.7 ) - 0.5 ) * uGrain * ( 1.0 - l * 0.5 );
    gl_FragColor = vec4( o, 1.0 );
  }`;

export class Post {
  constructor(renderer, Q) {
    this.r = renderer; this.Q = Q;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(geo, null); this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    const mk = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra });
    this.mPre = mk(PRE, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.0 } });
    this.mDown = mk(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = mk(UP, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uGain: { value: 1.0 } }, { blending: THREE.AdditiveBlending, transparent: true });
    this.mFinal = mk(FINAL, { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.07 }, uTime: { value: 0 }, uGrain: { value: 0.035 }, uVig: { value: 0.42 }, uSat: { value: 1.12 }, uContrast: { value: 0.28 }, uRes: { value: new THREE.Vector2() } }, { toneMapped: true });
    this.rt = null; this.mips = [];
    this.size = new THREE.Vector2();
  }

  resize() {
    this.r.getDrawingBufferSize(this.size);
    const w = Math.max(2, this.size.x), h = Math.max(2, this.size.y);
    if (this.rt) { this.rt.dispose(); this.mips.forEach((m) => m.dispose()); }
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: this.Q.msaa, depthBuffer: true });
    this.mips = [];
    let mw = w, mh = h;
    for (let i = 0; i < this.Q.bloom; i++) {
      mw = Math.max(2, mw >> 1); mh = Math.max(2, mh >> 1);
      this.mips.push(new THREE.WebGLRenderTarget(mw, mh, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }));
    }
    this.mFinal.uniforms.uRes.value.set(w, h);
  }

  pass(material, target) {
    this.quad.material = material;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }

  render(scene, camera, time) {
    const r = this.r;
    if (!this.rt) this.resize();
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, camera);
    const auto = r.autoClear;
    const m = this.mips;
    this.mPre.uniforms.tSrc.value = this.rt.texture; this.mPre.uniforms.uTexel.value.set(0.5 / m[0].width, 0.5 / m[0].height);
    this.pass(this.mPre, m[0]);
    for (let i = 1; i < m.length; i++) {
      this.mDown.uniforms.tSrc.value = m[i - 1].texture; this.mDown.uniforms.uTexel.value.set(1 / m[i - 1].width, 1 / m[i - 1].height);
      this.pass(this.mDown, m[i]);
    }
    r.autoClear = false;
    for (let i = m.length - 2; i >= 0; i--) {
      this.mUp.uniforms.tSrc.value = m[i + 1].texture; this.mUp.uniforms.uTexel.value.set(1 / m[i + 1].width, 1 / m[i + 1].height);
      this.pass(this.mUp, m[i]);
    }
    r.autoClear = auto;
    this.mFinal.uniforms.tScene.value = this.rt.texture; this.mFinal.uniforms.tBloom.value = m[0].texture; this.mFinal.uniforms.uTime.value = time;
    this.pass(this.mFinal, null);
  }
}
