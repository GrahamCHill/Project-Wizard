#include <iostream>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

int main()
{
    const auto transform = glm::translate(glm::mat4(1.0f), glm::vec3(2.0f, 3.0f, 4.0f));
    const auto point = transform * glm::vec4(1.0f, 1.0f, 1.0f, 1.0f);
    std::cout << "GLM translated the point to " << point.x << ", " << point.y << ", " << point.z << '\n';
    return point == glm::vec4(3.0f, 4.0f, 5.0f, 1.0f) ? 0 : 1;
}
