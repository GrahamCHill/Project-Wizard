/* Walk around a world made in Blender, drawn with Raylib.
 *
 * world.c reads the glTF file and player.c moves the player. This file only draws. Each Blender object becomes one Raylib mesh,
 * and a small shader lights it with the lamps from the scene. */
#include <stdio.h>
#include <string.h>

#include "player.h"
#include "raylib.h"
#include "raymath.h"
#include "world.h"

#define MAX_LIGHTS 8
#define MOUSE_SENSITIVITY 0.0025f /* radians per pixel */
#define TURN_SPEED 2.0f           /* radians per second, for the arrow keys */

/* Raylib 6 uses OpenGL 3.3 on desktop. The shader does the same lighting as the SDL version of this example:
 * a flat ambient light plus every lamp, which gets weaker with distance and with the angle of the surface. */
static const char *VERTEX_SHADER =
    "#version 330\n"
    "in vec3 vertexPosition;\n"
    "in vec3 vertexNormal;\n"
    "in vec4 vertexColor;\n"
    "uniform mat4 mvp;\n"
    "uniform mat4 matModel;\n"
    "out vec3 fragPosition;\n"
    "out vec3 fragNormal;\n"
    "out vec4 fragColor;\n"
    "void main() {\n"
    "    fragPosition = vec3(matModel * vec4(vertexPosition, 1.0));\n"
    "    fragNormal = normalize(mat3(matModel) * vertexNormal);\n"
    "    fragColor = vertexColor;\n"
    "    gl_Position = mvp * vec4(vertexPosition, 1.0);\n"
    "}\n";

static const char *FRAGMENT_SHADER =
    "#version 330\n"
    "in vec3 fragPosition;\n"
    "in vec3 fragNormal;\n"
    "in vec4 fragColor;\n"
    "uniform int lightCount;\n"
    "uniform vec3 lightPosition[8];\n"
    "uniform vec3 lightColor[8];\n"
    "uniform float lightIntensity[8];\n"
    "uniform float ambient;\n"
    "uniform float lampUnit;\n"
    "out vec4 finalColor;\n"
    "void main() {\n"
    "    vec3 normal = normalize(fragNormal);\n"
    "    vec3 light = vec3(ambient);\n"
    "    for (int i = 0; i < lightCount; i++) {\n"
    "        vec3 toLight = lightPosition[i] - fragPosition;\n"
    "        float distance2 = dot(toLight, toLight);\n"
    "        float facing = max(dot(normal, normalize(toLight)), 0.0);\n"
    "        light += lightColor[i] * (lightIntensity[i] / lampUnit) * facing / (1.0 + 0.1 * distance2);\n"
    "    }\n"
    "    finalColor = vec4(fragColor.rgb * min(light, vec3(1.0)), fragColor.a);\n"
    "}\n";

typedef struct {
    Mesh *meshes;
    int count;
    Material material;
} Scene;

/* One Raylib mesh per glTF mesh. The triangles are written out one after another, so a mesh can have more than 65,535 vertices,
 * which Raylib's 16-bit index buffer could not hold. */
static Mesh make_mesh(const WorldMesh *source) {
    Mesh mesh = {0};
    mesh.vertexCount = (int)source->index_count;
    mesh.triangleCount = (int)(source->index_count / 3);
    mesh.vertices = MemAlloc(source->index_count * 3 * sizeof(float));
    mesh.normals = MemAlloc(source->index_count * 3 * sizeof(float));
    mesh.colors = MemAlloc(source->index_count * 4);
    for (size_t i = 0; i < source->index_count; i++) {
        size_t vertex = source->indices[i];
        memcpy(mesh.vertices + i * 3, source->positions + vertex * 3, 3 * sizeof(float));
        memcpy(mesh.normals + i * 3, source->normals + vertex * 3, 3 * sizeof(float));
        for (int channel = 0; channel < 4; channel++) {
            float value = source->color[channel];
            mesh.colors[i * 4 + channel] = (unsigned char)((value < 0 ? 0 : value > 1 ? 1 : value) * 255.0f + 0.5f);
        }
    }
    UploadMesh(&mesh, false);
    return mesh;
}

static Scene build_scene(const World *world, Shader shader) {
    Scene scene = {MemAlloc(sizeof(Mesh) * (world->mesh_count ? world->mesh_count : 1)), (int)world->mesh_count, LoadMaterialDefault()};
    scene.material.shader = shader;
    for (size_t i = 0; i < world->mesh_count; i++) scene.meshes[i] = make_mesh(&world->meshes[i]);
    return scene;
}

static void send_lights(Shader shader, const World *world) {
    int count = (int)world->light_count < MAX_LIGHTS ? (int)world->light_count : MAX_LIGHTS;
    float positions[MAX_LIGHTS][3] = {{0}}, colors[MAX_LIGHTS][3] = {{0}}, intensities[MAX_LIGHTS] = {0};
    for (int i = 0; i < count; i++) {
        memcpy(positions[i], world->lights[i].position, sizeof positions[i]);
        memcpy(colors[i], world->lights[i].color, sizeof colors[i]);
        intensities[i] = world->lights[i].intensity;
    }
    float ambient = 0.25f, lamp_unit = WORLD_LAMP_UNIT;
    SetShaderValue(shader, GetShaderLocation(shader, "lightCount"), &count, SHADER_UNIFORM_INT);
    SetShaderValueV(shader, GetShaderLocation(shader, "lightPosition"), positions, SHADER_UNIFORM_VEC3, MAX_LIGHTS);
    SetShaderValueV(shader, GetShaderLocation(shader, "lightColor"), colors, SHADER_UNIFORM_VEC3, MAX_LIGHTS);
    SetShaderValueV(shader, GetShaderLocation(shader, "lightIntensity"), intensities, SHADER_UNIFORM_FLOAT, MAX_LIGHTS);
    SetShaderValue(shader, GetShaderLocation(shader, "ambient"), &ambient, SHADER_UNIFORM_FLOAT);
    SetShaderValue(shader, GetShaderLocation(shader, "lampUnit"), &lamp_unit, SHADER_UNIFORM_FLOAT);
}

/* The world file may be given on the command line. Otherwise look in the folder you started from, then next to the program. */
static const char *find_world(const char *requested) {
    if (requested) return requested;
    if (FileExists("assets/world.gltf")) return "assets/world.gltf";
    return TextFormat("%sassets/world.gltf", GetApplicationDirectory());
}

int main(int argc, char **argv) {
    const char *requested = NULL;
    const char *screenshot = NULL;
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--screenshot") == 0 && i + 1 < argc) screenshot = argv[++i];
        else requested = argv[i];
    }

    SetTraceLogLevel(LOG_WARNING);
    SetConfigFlags(FLAG_MSAA_4X_HINT | FLAG_VSYNC_HINT | FLAG_WINDOW_RESIZABLE);
    InitWindow(1280, 720, "__PROJECT_NAME__");

    const char *path = find_world(requested);
    World world;
    char error[256];
    if (!world_load(path, &world, error, sizeof error)) {
        fprintf(stderr, "Cannot load %s: %s\n", path, error);
        CloseWindow();
        return 1;
    }

    Shader shader = LoadShaderFromMemory(VERTEX_SHADER, FRAGMENT_SHADER);
    shader.locs[SHADER_LOC_MATRIX_MODEL] = GetShaderLocation(shader, "matModel");
    send_lights(shader, &world);
    Scene scene = build_scene(&world, shader);

    Player player;
    player_init(&player, &world);

    if (!screenshot) DisableCursor();
    int frame = 0;
    while (!WindowShouldClose()) {
        float dt = GetFrameTime();

        float turn = (IsKeyDown(KEY_LEFT) ? 1 : 0) - (IsKeyDown(KEY_RIGHT) ? 1 : 0);
        float look_up = (IsKeyDown(KEY_UP) ? 1 : 0) - (IsKeyDown(KEY_DOWN) ? 1 : 0);
        /* The first reading after the cursor is captured can be a huge jump, so it is skipped. */
        Vector2 mouse = (screenshot || frame == 0) ? (Vector2){0, 0} : GetMouseDelta();
        player_look(&player, turn * TURN_SPEED * dt - mouse.x * MOUSE_SENSITIVITY, look_up * TURN_SPEED * dt - mouse.y * MOUSE_SENSITIVITY);

        float forward = (IsKeyDown(KEY_W) ? 1 : 0) - (IsKeyDown(KEY_S) ? 1 : 0);
        float strafe = (IsKeyDown(KEY_D) ? 1 : 0) - (IsKeyDown(KEY_A) ? 1 : 0);
        player_update(&player, &world, dt, strafe, forward, IsKeyDown(KEY_SPACE));

        float eye[3], direction[3];
        player_eye(&player, eye);
        player_direction(&player, direction);
        Camera3D camera = {
            .position = {eye[0], eye[1], eye[2]},
            .target = {eye[0] + direction[0], eye[1] + direction[1], eye[2] + direction[2]},
            .up = {0, 1, 0},
            .fovy = 70,
            .projection = CAMERA_PERSPECTIVE,
        };

        BeginDrawing();
        ClearBackground((Color){24, 28, 36, 255});
        BeginMode3D(camera);
        for (int i = 0; i < scene.count; i++) DrawMesh(scene.meshes[i], scene.material, MatrixIdentity());
        EndMode3D();
        DrawText("WASD move   Mouse look   Space jump   Esc quit", 16, 16, 20, RAYWHITE);
        DrawFPS(16, 44);
        EndDrawing();

        /* With --screenshot the program draws a few frames from the spawn point, saves a picture, and quits. */
        frame++;
        if (screenshot && frame == 5) {
            /* TakeScreenshot would put the file next to the program, so the picture is saved by hand to the path given. */
            Image picture = LoadImageFromScreen();
            if (!ExportImage(picture, screenshot)) fprintf(stderr, "Cannot save %s\n", screenshot);
            UnloadImage(picture);
            break;
        }
    }

    for (int i = 0; i < scene.count; i++) UnloadMesh(scene.meshes[i]);
    MemFree(scene.meshes);
    MemFree(scene.material.maps); /* the shader is unloaded once, below, so UnloadMaterial is not used */
    UnloadShader(shader);
    world_free(&world);
    CloseWindow();
    return 0;
}
