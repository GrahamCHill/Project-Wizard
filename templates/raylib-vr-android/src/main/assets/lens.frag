#version 100
precision mediump float;

varying vec2 fragTexCoord;
uniform sampler2D texture0;
uniform vec2 leftLensCenter;
uniform vec2 rightLensCenter;
uniform vec2 scale;
uniform vec2 scaleIn;
uniform vec4 lensWarp;

void main()
{
    bool left = fragTexCoord.x < 0.5;
    vec2 center = left ? leftLensCenter : rightLensCenter;
    vec2 offset = (fragTexCoord - center) * scaleIn;
    float r2 = dot(offset, offset);
    float warp = lensWarp.x + r2 * (lensWarp.y + r2 * (lensWarp.z + r2 * lensWarp.w));
    vec2 samplePoint = center + offset * warp * scale;
    vec2 low = vec2(left ? 0.0 : 0.5, 0.0);
    vec2 high = vec2(left ? 0.5 : 1.0, 1.0);
    if (any(lessThan(samplePoint, low)) || any(greaterThan(samplePoint, high))) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        gl_FragColor = texture2D(texture0, samplePoint);
    }
}
