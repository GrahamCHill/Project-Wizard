#version 330 core

out vec3 vertexColor;

// No vertex buffer is needed for this introductory example.
const vec2 positions[3] = vec2[3](
    vec2(0.0, 0.65), vec2(-0.65, -0.55), vec2(0.65, -0.55)
);
const vec3 colors[3] = vec3[3](
    vec3(1.0, 0.35, 0.2), vec3(0.2, 0.85, 0.55), vec3(0.25, 0.5, 1.0)
);

void main()
{
    gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
    vertexColor = colors[gl_VertexID];
}
