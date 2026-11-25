#version 330 core

in vec3 vertexColor;
out vec4 fragmentColor;

void main()
{
    // Vertex colors are interpolated across the triangle.
    fragmentColor = vec4(vertexColor, 1.0);
}
