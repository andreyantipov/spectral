// Background pass: colored rectangles for each cell
export const BG_VERTEX = `#version 300 es
precision mediump float;
in vec2 a_position;
in vec2 a_cellPos;
in vec3 a_bgColor;

uniform vec2 u_cellSize;
uniform vec2 u_resolution;

out vec3 v_bgColor;

void main() {
  vec2 pixel = (a_cellPos + a_position) * u_cellSize;
  vec2 clip = (pixel / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_bgColor = a_bgColor;
}
`;

export const BG_FRAGMENT = `#version 300 es
precision mediump float;
in vec3 v_bgColor;
out vec4 fragColor;
void main() {
  fragColor = vec4(v_bgColor, 1.0);
}
`;

// Foreground pass: textured glyph quads tinted with fg color
export const FG_VERTEX = `#version 300 es
precision mediump float;
in vec2 a_position;
in vec2 a_cellPos;
in vec3 a_fgColor;
in vec4 a_atlasUV;

uniform vec2 u_cellSize;
uniform vec2 u_resolution;
uniform vec2 u_atlasSize;

out vec3 v_fgColor;
out vec2 v_texCoord;

void main() {
  vec2 pixel = (a_cellPos + a_position) * u_cellSize;
  vec2 clip = (pixel / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_fgColor = a_fgColor;
  vec2 atlasOffset = a_atlasUV.xy;
  vec2 atlasExtent = a_atlasUV.zw;
  v_texCoord = (atlasOffset + a_position * atlasExtent) / u_atlasSize;
}
`;

export const FG_FRAGMENT = `#version 300 es
precision mediump float;
in vec3 v_fgColor;
in vec2 v_texCoord;
uniform sampler2D u_atlas;
out vec4 fragColor;
void main() {
  float alpha = texture(u_atlas, v_texCoord).r;
  fragColor = vec4(v_fgColor, alpha);
}
`;
