#if STARTER_SDL_MAJOR == 3
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>
#include <SDL3/SDL_opengl.h>
#else
#define SDL_MAIN_HANDLED
#include <SDL.h>
#include <SDL_opengl.h>
#endif
#include "starter.h"
#include "triangle_vert.h"
#include "triangle_frag.h"
#include <stdio.h>

typedef struct GLApi {
    PFNGLCREATESHADERPROC CreateShader;
    PFNGLSHADERSOURCEPROC ShaderSource;
    PFNGLCOMPILESHADERPROC CompileShader;
    PFNGLGETSHADERIVPROC GetShaderiv;
    PFNGLGETSHADERINFOLOGPROC GetShaderInfoLog;
    PFNGLDELETESHADERPROC DeleteShader;
    PFNGLCREATEPROGRAMPROC CreateProgram;
    PFNGLATTACHSHADERPROC AttachShader;
    PFNGLLINKPROGRAMPROC LinkProgram;
    PFNGLGETPROGRAMIVPROC GetProgramiv;
    PFNGLGETPROGRAMINFOLOGPROC GetProgramInfoLog;
    PFNGLDELETEPROGRAMPROC DeleteProgram;
    PFNGLUSEPROGRAMPROC UseProgram;
    PFNGLGENVERTEXARRAYSPROC GenVertexArrays;
    PFNGLBINDVERTEXARRAYPROC BindVertexArray;
    PFNGLDELETEVERTEXARRAYSPROC DeleteVertexArrays;
} GLApi;

static int loadGL(GLApi *gl)
{
    // Windows exports only OpenGL 1.1 directly. Load modern functions after creating the context.
#define LOAD_GL(name, type) \
    gl->name = (type)SDL_GL_GetProcAddress("gl" #name); \
    if (!gl->name) { fprintf(stderr, "Missing OpenGL function: gl%s\n", #name); return 0; }
    LOAD_GL(CreateShader, PFNGLCREATESHADERPROC)
    LOAD_GL(ShaderSource, PFNGLSHADERSOURCEPROC)
    LOAD_GL(CompileShader, PFNGLCOMPILESHADERPROC)
    LOAD_GL(GetShaderiv, PFNGLGETSHADERIVPROC)
    LOAD_GL(GetShaderInfoLog, PFNGLGETSHADERINFOLOGPROC)
    LOAD_GL(DeleteShader, PFNGLDELETESHADERPROC)
    LOAD_GL(CreateProgram, PFNGLCREATEPROGRAMPROC)
    LOAD_GL(AttachShader, PFNGLATTACHSHADERPROC)
    LOAD_GL(LinkProgram, PFNGLLINKPROGRAMPROC)
    LOAD_GL(GetProgramiv, PFNGLGETPROGRAMIVPROC)
    LOAD_GL(GetProgramInfoLog, PFNGLGETPROGRAMINFOLOGPROC)
    LOAD_GL(DeleteProgram, PFNGLDELETEPROGRAMPROC)
    LOAD_GL(UseProgram, PFNGLUSEPROGRAMPROC)
    LOAD_GL(GenVertexArrays, PFNGLGENVERTEXARRAYSPROC)
    LOAD_GL(BindVertexArray, PFNGLBINDVERTEXARRAYPROC)
    LOAD_GL(DeleteVertexArrays, PFNGLDELETEVERTEXARRAYSPROC)
#undef LOAD_GL
    return 1;
}

static GLuint compileShader(const GLApi *gl, GLenum type, const unsigned char *bytes, const char *name)
{
    const GLuint shader = gl->CreateShader(type);
    if (!shader) return 0;
    const GLchar *source = (const GLchar *)bytes;
    gl->ShaderSource(shader, 1, &source, NULL);
    gl->CompileShader(shader);
    GLint compiled = GL_FALSE;
    gl->GetShaderiv(shader, GL_COMPILE_STATUS, &compiled);
    if (!compiled) {
        GLchar message[4096];
        gl->GetShaderInfoLog(shader, sizeof(message), NULL, message);
        fprintf(stderr, "%s compilation failed:\n%s\n", name, message);
        gl->DeleteShader(shader);
        return 0;
    }
    return shader;
}

static GLuint createProgram(const GLApi *gl)
{
    const GLuint vertex = compileShader(gl, GL_VERTEX_SHADER, triangle_vert, "triangle.vert");
    if (!vertex) return 0;
    const GLuint fragment = compileShader(gl, GL_FRAGMENT_SHADER, triangle_frag, "triangle.frag");
    if (!fragment) { gl->DeleteShader(vertex); return 0; }
    const GLuint program = gl->CreateProgram();
    if (program) {
        gl->AttachShader(program, vertex);
        gl->AttachShader(program, fragment);
        gl->LinkProgram(program);
    }
    gl->DeleteShader(vertex);
    gl->DeleteShader(fragment);
    if (!program) return 0;
    GLint linked = GL_FALSE;
    gl->GetProgramiv(program, GL_LINK_STATUS, &linked);
    if (!linked) {
        GLchar message[4096];
        gl->GetProgramInfoLog(program, sizeof(message), NULL, message);
        fprintf(stderr, "Shader program linking failed:\n%s\n", message);
        gl->DeleteProgram(program);
        return 0;
    }
    return program;
}

int main(int argc, char **argv)
{
    (void)argc;
    (void)argv;
#if STARTER_SDL_MAJOR == 3
    const int initialized = SDL_Init(SDL_INIT_VIDEO);
#else
    SDL_SetMainReady();
    const int initialized = SDL_Init(SDL_INIT_VIDEO) == 0;
#endif
    if (!initialized) {
        fprintf(stderr, "SDL_Init: %s\n", SDL_GetError());
        return 1;
    }

    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 3);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 3);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_FLAGS, SDL_GL_CONTEXT_FORWARD_COMPATIBLE_FLAG);
    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);

    const int windowWidth = starter_add(400, 400);
#if STARTER_SDL_MAJOR == 3
    SDL_Window *window = SDL_CreateWindow("__PROJECT_NAME__", windowWidth, 450,
        SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE | SDL_WINDOW_HIGH_PIXEL_DENSITY);
#else
    SDL_Window *window = SDL_CreateWindow("__PROJECT_NAME__", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
        windowWidth, 450, SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE | SDL_WINDOW_ALLOW_HIGHDPI);
#endif
    if (!window) {
        fprintf(stderr, "SDL_CreateWindow: %s\n", SDL_GetError());
        SDL_Quit();
        return 1;
    }

    SDL_GLContext context = SDL_GL_CreateContext(window);
    if (!context) {
        fprintf(stderr, "SDL_GL_CreateContext: %s\n", SDL_GetError());
        SDL_DestroyWindow(window);
        SDL_Quit();
        return 1;
    }
    SDL_GL_SetSwapInterval(1);

    GLApi gl = { 0 };
    GLuint program = 0;
    GLuint vertexArray = 0;
    int success = loadGL(&gl);
    if (success) {
        program = createProgram(&gl);
        gl.GenVertexArrays(1, &vertexArray);
        success = program != 0 && vertexArray != 0;
    }

    int running = 1;
    while (success && running) {
        SDL_Event event;
        while (SDL_PollEvent(&event)) {
#if STARTER_SDL_MAJOR == 3
            if (event.type == SDL_EVENT_QUIT) {
#else
            if (event.type == SDL_QUIT) {
#endif
                running = 0;
            }
        }

        int width = 0;
        int height = 0;
#if STARTER_SDL_MAJOR == 3
        SDL_GetWindowSizeInPixels(window, &width, &height);
#else
        SDL_GL_GetDrawableSize(window, &width, &height);
#endif
        if (width <= 0 || height <= 0) { SDL_Delay(16); continue; }
        glViewport(0, 0, width, height);
        glClearColor(0.08f, 0.16f, 0.27f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        gl.UseProgram(program);
        // The vertex shader supplies positions and colors using gl_VertexID.
        gl.BindVertexArray(vertexArray);
        glDrawArrays(GL_TRIANGLES, 0, 3);
        SDL_GL_SwapWindow(window);
    }

    if (vertexArray) gl.DeleteVertexArrays(1, &vertexArray);
    if (program) gl.DeleteProgram(program);
#if STARTER_SDL_MAJOR == 3
    SDL_GL_DestroyContext(context);
#else
    SDL_GL_DeleteContext(context);
#endif
    SDL_DestroyWindow(window);
    SDL_Quit();
    return success ? 0 : 1;
}
