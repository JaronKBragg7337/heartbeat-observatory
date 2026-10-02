// ============================================================================
// cinema/present.js — depth of field and motion blur for the desktop high tier.
//
// The scene is drawn into a target, then a screen pass blurs it. Phones and the
// safe tier never construct this: Engine.present stays unset and the frame is
// the one the game has always drawn.
//
// Depth is the logarithmic buffer (see math.js). Motion blur reprojects each
// pixel through the previous camera. The camera itself sits at the origin, so
// the previous view has to subtract how far the camera moved in the active frame.
// ============================================================================

import * as THREE from 'three';
import { logDepthBufFC, viewWFromLogDepth } from './math.js';

const FRAG = `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxCoc;
uniform float uMotion;
uniform float uLogFC;
uniform float uDepthOk;
uniform vec2 uTexel;
uniform mat4 uInvProj;
uniform mat4 uView;
uniform mat4 uInvView;
uniform mat4 uPrevView;
uniform mat4 uProj;
uniform mat4 uPrevProj;
uniform vec3 uCamDelta;
varying vec2 vUv;

float decodedW(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  float w = exp2(d * 2.0 / uLogFC) - 1.0;
  return w;
}

void main() {
  vec2 uv = vUv;
  vec4 base = texture2D(tColor, uv);
  float dist = uDepthOk > 0.5 ? decodedW(uv) : uFocus;
  float sane = (dist > 0.15 && dist < 800000.0) ? 1.0 : 0.0;
  float coc = sane * clamp(abs(dist - uFocus) * uAperture / max(dist, 1.0), 0.0, uMaxCoc);

  vec4 acc = base;
  float wsum = 1.0;
  // A 12-tap disk. The radius is the circle of confusion in pixels.
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 2.399963;
    float r = coc * (0.35 + 0.65 * fract(float(i) * 0.173));
    vec2 o = vec2(cos(a), sin(a)) * r;
    acc += texture2D(tColor, uv + o);
    wsum += 1.0;
  }
  vec3 color = acc.rgb / wsum;

  // Camera motion: where this view-space point was last frame.
  if (uMotion > 0.001 && sane > 0.5) {
    vec4 farH = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
    vec3 dir = normalize(farH.xyz / farH.w);
    float ahead = max(1e-3, -dir.z);
    vec3 viewPos = dir * (dist / ahead);
    vec3 R1 = (uInvView * vec4(viewPos, 1.0)).xyz;
    vec3 R0 = R1 - uCamDelta;
    vec4 prevClip = uPrevProj * uPrevView * vec4(R0, 1.0);
    vec4 curClip = uProj * uView * vec4(R1, 1.0);
    vec2 prevUv = prevClip.xy / max(prevClip.w, 1e-4) * 0.5 + 0.5;
    vec2 curUv = curClip.xy / max(curClip.w, 1e-4) * 0.5 + 0.5;
    vec2 vel = (prevUv - curUv) * uMotion;
    float vlen = length(vel);
    if (vlen > 0.0004 && vlen < 0.2) {
      vec3 blur = color;
      const int TAPS = 6;
      for (int i = 1; i <= TAPS; i++) {
        float k = (float(i) / float(TAPS)) - 0.5;
        blur += texture2D(tColor, uv + vel * k).rgb;
      }
      color = blur / float(TAPS + 1);
    }
  }
  gl_FragColor = vec4(color, 1.0);
}`;

// The vertex shader above does not declare vUv. Fix that.
const VERT_UV = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export class FilmPresent {
  constructor(engine) {
    this.engine = engine;
    this.enabled = false;
    this.focus = 40;
    this.aperture = 0.02;
    this.motion = 0;
    this._prevView = new THREE.Matrix4();
    this._prevProj = new THREE.Matrix4();
    this._prevCam = new THREE.Vector3();
    this._havePrev = false;
    this._size = new THREE.Vector2();
    const geo = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT_UV,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        uFocus: { value: 40 },
        uAperture: { value: 0.02 },
        uMaxCoc: { value: 0.012 },
        uMotion: { value: 0 },
        uLogFC: { value: logDepthBufFC(engine.camera.far) },
        uDepthOk: { value: engine.renderer.capabilities.logarithmicDepthBuffer ? 1 : 0 },
        uTexel: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
        uInvProj: { value: new THREE.Matrix4() },
        uView: { value: new THREE.Matrix4() },
        uInvView: { value: new THREE.Matrix4() },
        uPrevView: { value: new THREE.Matrix4() },
        uProj: { value: new THREE.Matrix4() },
        uPrevProj: { value: new THREE.Matrix4() },
        uCamDelta: { value: new THREE.Vector3() },
      },
    });
    this.quad = new THREE.Mesh(geo, this.material);
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.rt = null;
    this._resize();
    this._onResize = () => this._resize();
    engine.onResize(this._onResize);
  }

  _resize() {
    const r = this.engine.renderer;
    r.getDrawingBufferSize(this._size);
    const w = Math.max(2, this._size.x | 0), h = Math.max(2, this._size.y | 0);
    if (this.rt) this.rt.dispose();
    const depth = new THREE.DepthTexture(w, h);
    depth.type = THREE.UnsignedIntType;
    this.rt = new THREE.WebGLRenderTarget(w, h, {
      depthBuffer: true,
      stencilBuffer: false,
      depthTexture: depth,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
    });
    this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.material.uniforms.tColor.value = this.rt.texture;
    this.material.uniforms.tDepth.value = depth;
    this.material.uniforms.uTexel.value.set(1 / w, 1 / h);
    this._havePrev = false;
  }

  setShot(shot, playing) {
    this.focus = shot && shot.focus != null ? shot.focus : 40;
    this.aperture = playing && shot ? (shot.aperture == null ? 0.02 : shot.aperture) : 0;
    this.motion = playing && shot ? (shot.motion == null ? 0.7 : shot.motion) : 0;
    this.enabled = playing ? (shot ? shot.post !== false : true) : false;
    this._havePrev = false;
  }

  /** Draw the world into the target and the film pass onto the canvas. */
  render(engine) {
    const r = engine.renderer;
    const rt = this.rt;
    r.setRenderTarget(rt);
    r.render(engine.scene, engine.camera);
    if (engine.overlayScenes.length) {
      r.autoClear = false;
      for (const sc of engine.overlayScenes) r.render(sc, engine.camera);
      r.autoClear = true;
    }
    const cam = engine.camera;
    cam.updateMatrixWorld();
    const u = this.material.uniforms;
    u.uFocus.value = this.focus;
    u.uAperture.value = this.aperture;
    u.uMotion.value = this._havePrev ? this.motion : 0;
    u.uLogFC.value = logDepthBufFC(cam.far);
    u.uProj.value.copy(cam.projectionMatrix);
    u.uInvProj.value.copy(cam.projectionMatrixInverse);
    u.uView.value.copy(cam.matrixWorldInverse);
    u.uInvView.value.copy(cam.matrixWorld);
    u.uPrevView.value.copy(this._havePrev ? this._prevView : cam.matrixWorldInverse);
    u.uPrevProj.value.copy(this._havePrev ? this._prevProj : cam.projectionMatrix);
    const c = engine.cameraWorldPos;
    if (this._havePrev) u.uCamDelta.value.set(c.x - this._prevCam.x, c.y - this._prevCam.y, c.z - this._prevCam.z);
    else u.uCamDelta.value.set(0, 0, 0);
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
    this._prevView.copy(cam.matrixWorldInverse);
    this._prevProj.copy(cam.projectionMatrix);
    this._prevCam.set(c.x, c.y, c.z);
    this._havePrev = true;
  }

  dispose() {
    if (this.rt) this.rt.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}

// viewWFromLogDepth is re-exported so a caller can check the buffer the shader reads.
export { viewWFromLogDepth };
