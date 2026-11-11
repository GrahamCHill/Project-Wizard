#include "raylib.h"
#include "raymath.h"
#include "starter.h"
#include <android/looper.h>
#include <android/sensor.h>

typedef struct HeadTracker {
    ASensorEventQueue *queue;
    Quaternion rotation;
    Quaternion neutral;
    bool ready;
} HeadTracker;

static int readHeadRotation(int fd, int events, void *data)
{
    (void)fd;
    (void)events;
    HeadTracker *tracker = (HeadTracker *)data;
    ASensorEvent event;
    while (ASensorEventQueue_getEvents(tracker->queue, &event, 1) > 0) {
        if (event.type != ASENSOR_TYPE_GAME_ROTATION_VECTOR) continue;
        Quaternion rotation = { event.data[0], event.data[1], event.data[2], event.data[3] };
        tracker->rotation = QuaternionNormalize(rotation);
        if (!tracker->ready) tracker->neutral = tracker->rotation;
        tracker->ready = true;
    }
    return 1;
}

static Vector3 landscapeAxes(Vector3 vector)
{
    // Android sensor coordinates follow the phone's natural portrait orientation.
    Vector3 landscape = { -vector.y, vector.x, vector.z };
    return landscape;
}

int main(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    InitWindow(0, 0, "__PROJECT_NAME__");
    if (!IsWindowReady()) return 1;
    SetTargetFPS(60);

    ASensorManager *manager = ASensorManager_getInstanceForPackage("com.example.raylib.project___PROJECT_IDENTIFIER__");
    const ASensor *sensor = manager ? ASensorManager_getDefaultSensor(manager, ASENSOR_TYPE_GAME_ROTATION_VECTOR) : NULL;
    ALooper *looper = ALooper_forThread();
    HeadTracker tracker = { NULL, QuaternionIdentity(), QuaternionIdentity(), false };
    if (sensor && looper) {
        tracker.queue = ASensorManager_createEventQueue(manager, looper, ALOOPER_POLL_CALLBACK, readHeadRotation, &tracker);
        if (tracker.queue && ASensorEventQueue_enableSensor(tracker.queue, sensor) == 0) {
            int minimumDelay = ASensor_getMinDelay(sensor);
            ASensorEventQueue_setEventRate(tracker.queue, sensor, minimumDelay > 16667 ? minimumDelay : 16667);
        } else if (tracker.queue) {
            ASensorManager_destroyEventQueue(manager, tracker.queue);
            tracker.queue = NULL;
        }
    }
    if (!tracker.queue) TraceLog(LOG_WARNING, "Head tracking requires an Android game rotation vector sensor.");

    const int width = GetScreenWidth();
    const int height = GetScreenHeight();
    VrDeviceInfo viewer = { 0 };
    viewer.hResolution = width;
    viewer.vResolution = height;
    viewer.hScreenSize = 0.12f;
    viewer.vScreenSize = 0.068f;
    viewer.eyeToScreenDistance = 0.042f;
    viewer.lensSeparationDistance = 0.064f;
    viewer.interpupillaryDistance = 0.064f;
    viewer.lensDistortionValues[0] = 1.0f;
    viewer.lensDistortionValues[1] = 0.22f;
    viewer.lensDistortionValues[2] = 0.24f;
    VrStereoConfig stereo = LoadVrStereoConfig(viewer);
    RenderTexture2D eyes = LoadRenderTexture(width, height);
    Shader lens = LoadShader(NULL, "lens.frag");
    SetShaderValue(lens, GetShaderLocation(lens, "leftLensCenter"), stereo.leftLensCenter, SHADER_UNIFORM_VEC2);
    SetShaderValue(lens, GetShaderLocation(lens, "rightLensCenter"), stereo.rightLensCenter, SHADER_UNIFORM_VEC2);
    SetShaderValue(lens, GetShaderLocation(lens, "scale"), stereo.scale, SHADER_UNIFORM_VEC2);
    SetShaderValue(lens, GetShaderLocation(lens, "scaleIn"), stereo.scaleIn, SHADER_UNIFORM_VEC2);
    SetShaderValue(lens, GetShaderLocation(lens, "lensWarp"), viewer.lensDistortionValues, SHADER_UNIFORM_VEC4);

    Camera3D camera = { { 0, 1.6f, 0 }, { 0, 1.6f, -1 }, { 0, 1, 0 }, 70, CAMERA_PERSPECTIVE };
    const Vector3 forward = { 0, 0, -1 };
    const Vector3 up = { 1, 0, 0 };
    const Vector3 landmark = { 0, 1.0f, -(float)starter_add(2, 3) };
    const Vector2 floorSize = { 30, 30 };
    const Vector3 floorCenter = { 0, 0, 0 };
    const Rectangle source = { 0, 0, (float)width, -(float)height };
    const Rectangle screen = { 0, 0, (float)width, (float)height };
    const Vector2 origin = { 0, 0 };
    const Color sky = { 26, 35, 54, 255 };
    bool touched = false;

    while (!WindowShouldClose()) {
        const bool touching = GetTouchPointCount() > 0;
        if (tracker.ready && touching && !touched) tracker.neutral = tracker.rotation;
        touched = touching;
        const Quaternion relative = QuaternionMultiply(QuaternionInvert(tracker.neutral), tracker.rotation);
        camera.target = Vector3Add(camera.position, landscapeAxes(Vector3RotateByQuaternion(forward, relative)));
        camera.up = landscapeAxes(Vector3RotateByQuaternion(up, relative));

        BeginTextureMode(eyes);
            ClearBackground(sky);
            BeginVrStereoMode(stereo);
                BeginMode3D(camera);
                    DrawPlane(floorCenter, floorSize, DARKGRAY);
                    DrawGrid(30, 1.0f);
                    DrawCube(landmark, 1.5f, 2.0f, 1.5f, SKYBLUE);
                    DrawCubeWires(landmark, 1.5f, 2.0f, 1.5f, BLUE);
                EndMode3D();
            EndVrStereoMode();
        EndTextureMode();

        BeginDrawing();
            ClearBackground(BLACK);
            BeginShaderMode(lens);
                DrawTexturePro(eyes.texture, source, screen, origin, 0, WHITE);
            EndShaderMode();
        EndDrawing();
    }

    if (tracker.queue) ASensorManager_destroyEventQueue(manager, tracker.queue);
    UnloadShader(lens);
    UnloadRenderTexture(eyes);
    UnloadVrStereoConfig(stereo);
    CloseWindow();
    return 0;
}
