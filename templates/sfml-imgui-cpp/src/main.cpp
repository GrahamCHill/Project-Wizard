#include <SFML/Graphics.hpp>
#include <imgui.h>
#include <imgui-SFML.h>

#include <cstdint>
#include <iostream>

int main()
{
    sf::RenderWindow window(__SFML_WINDOW_MODE__, "__PROJECT_NAME__");
    window.setFramerateLimit(60);
    if (!ImGui::SFML::Init(window)) {
        std::cerr << "Could not initialize ImGui-SFML.\n";
        return 1;
    }

    sf::Clock clock;
    sf::CircleShape shape;
    shape.setPosition({560.f, 250.f});
    float radius = 64.f;
    float color[] = {0.37f, 0.82f, 0.75f};

    while (window.isOpen()) {
        __SFML_POLL_EVENT__ {
            ImGui::SFML::ProcessEvent(window, __SFML_EVENT_VALUE__);
            if (__SFML_CLOSED__) {
                window.close();
                break;
            }
        }
        if (!window.isOpen()) break;

        ImGui::SFML::Update(window, clock.restart());
        ImGui::SetNextWindowPos({24.f, 24.f}, ImGuiCond_FirstUseEver);
        ImGui::SetNextWindowSize({300.f, 140.f}, ImGuiCond_FirstUseEver);
        if (ImGui::Begin("Circle controls")) {
            ImGui::SliderFloat("Radius", &radius, 16.f, 120.f, "%.0f px");
            ImGui::ColorEdit3("Color", color);
        }
        ImGui::End();

        shape.setRadius(radius);
        shape.setOrigin({radius, radius});
        shape.setFillColor(sf::Color(static_cast<std::uint8_t>(color[0] * 255.f),
                                     static_cast<std::uint8_t>(color[1] * 255.f),
                                     static_cast<std::uint8_t>(color[2] * 255.f)));
        window.clear(sf::Color(23, 29, 40));
        window.draw(shape);
        ImGui::SFML::Render(window);
        window.display();
    }

    ImGui::SFML::Shutdown();
}
