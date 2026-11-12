using UnityEngine;

public sealed class DemoScene : MonoBehaviour
{
    private Transform cube;

    private void Awake()
    {
        cube = GameObject.CreatePrimitive(PrimitiveType.Cube).transform;
        cube.name = "Spinning Cube";

        var cameraObject = new GameObject("Demo Camera", typeof(Camera));
        cameraObject.transform.position = new Vector3(2, 1.5f, -5);
        cameraObject.transform.LookAt(cube.position);

        var lightObject = new GameObject("Demo Light", typeof(Light));
        lightObject.GetComponent<Light>().type = LightType.Directional;
        lightObject.transform.rotation = Quaternion.Euler(50, -30, 0);
    }

    private void Update()
    {
        cube.Rotate(new Vector3(30, 60, 0) * Time.deltaTime);
    }
}
