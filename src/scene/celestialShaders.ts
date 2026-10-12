export const celestialVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const haloFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float radius = length(vUv - 0.5) * 2.0;
    float alpha = exp(-radius * radius * 5.5) * (1.0 - smoothstep(0.72, 1.0, radius)) * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
    #include <colorspace_fragment>
  }
`

export const sunFragmentShader = /* glsl */ `
  uniform float uOpacity, uWarmth, uEmission;
  uniform vec3 uCenter, uEdge, uLowCenter, uLowEdge;
  varying vec2 vUv;
  void main() {
    float radius = length(vUv - .5) * 2.0;
    vec3 center = mix(uCenter, uLowCenter, uWarmth);
    vec3 edge = mix(uEdge, uLowEdge, uWarmth);
    vec3 color = mix(center, edge, smoothstep(.12, 1.0, radius) * .55);
    float limb = 1.0 - pow(radius, 3.0) * .07;
    float alpha = 1.0 - smoothstep(.98, 1.0, radius);
    gl_FragColor = vec4(color * limb * uEmission, alpha * uOpacity);
    #include <colorspace_fragment>
  }
`

export const moonFragmentShader = /* glsl */ `
  uniform float uOpacity, uPhase;
  varying vec2 vUv;

  float mare(vec2 p, vec2 center, vec2 radius) {
    float d = length((p - center) / radius);
    return 1.0 - smoothstep(.68, 1.08, d);
  }
  float crater(vec2 p, vec2 center, float radius) {
    vec2 local = (p - center) / radius;
    float d = length(local);
    float rim = exp(-pow((d - .92) * 9.0, 2.0));
    float bowl = 1.0 - smoothstep(.2, .78, d);
    return rim * .035 - bowl * .025 + rim * local.x * .025;
  }
  void main() {
    vec2 p = (vUv - .5) * 2.0;
    float r2 = dot(p,p);
    float z = sqrt(max(0.0, 1.0 - r2));
    vec3 normal = vec3(p,z);
    vec3 lightDirection = normalize(vec3(sin(uPhase), .04, cos(uPhase)));
    float incidence = dot(normal, lightDirection);
    float illuminated = smoothstep(-.045, .055, incidence);
    // Broad fixed maria make the face recognizable; no downloaded photo or noise texture.
    vec2 surface = p + vec2(sin(p.y * 13.0), sin(p.x * 11.0)) * .018;
    float maria = max(mare(surface, vec2(-.42,.26), vec2(.4,.43)), mare(surface, vec2(.2,.28),vec2(.32,.29)));
    maria = max(maria, mare(surface,vec2(-.1,-.12),vec2(.35,.24)) * .8);
    maria = max(maria, mare(surface,vec2(.5,.02),vec2(.2,.23)) * .9);
    maria = max(maria, mare(surface,vec2(-.05,.56),vec2(.25,.17)) * .75);
    float relief = crater(p,vec2(.12,-.6),.065) + crater(p,vec2(-.38,-.04),.08)
      + crater(p,vec2(-.65,.12),.05) + crater(p,vec2(-.1,.61),.065)
      + crater(p,vec2(-.28,-.67),.085) + crater(p,vec2(.52,-.42),.055);
    float rayDistance = length(p - vec2(.12,-.6));
    float rays = pow(max(0.0,cos(atan(p.y+.6,p.x-.12)*11.0)),18.0) * exp(-rayDistance*5.0) * .018;
    float albedo = .95 - maria * .24 + relief + rays;
    float diffuse = .83 + .17 * sqrt(max(0.0,incidence));
    // Earthshine reveals the unlit surface in cool gray-blue, especially at crescent phases.
    float earthshine = .065 + .045 * (1.0 - cos(uPhase)) * .5;
    vec3 shadowLight = vec3(.55,.64,.76) * earthshine;
    vec3 sunLight = vec3(.82,.815,.79) * (diffuse + .018);
    vec3 color = mix(shadowLight, sunLight, illuminated) * albedo * (.88 + z * .12);
    gl_FragColor = vec4(color,uOpacity * (1.0 - smoothstep(.98,1.0,sqrt(r2))));
    #include <colorspace_fragment>
  }
`
