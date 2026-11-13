#include <SFML/Graphics.hpp>

int main()
{
    sf::RenderWindow window(__SFML_WINDOW_MODE__, "__PROJECT_NAME__");
    window.setFramerateLimit(60);

    sf::CircleShape player(28.f);
    player.setOrigin({28.f, 28.f});
    player.setPosition({400.f, 250.f});
    player.setFillColor(sf::Color(94, 208, 191));
    sf::Clock clock;

    while (window.isOpen()) {
        __SFML_POLL_EVENT__ {
            if (__SFML_CLOSED__) {
                window.close();
                break;
            }
        }
        if (!window.isOpen()) break;

        const float step = 220.f * clock.restart().asSeconds();
        if (window.hasFocus()) {
            using Key = __SFML_KEY__;
            const int x = sf::Keyboard::isKeyPressed(Key::Right) - sf::Keyboard::isKeyPressed(Key::Left);
            const int y = sf::Keyboard::isKeyPressed(Key::Down) - sf::Keyboard::isKeyPressed(Key::Up);
            player.move({x * step, y * step});
        }

        window.clear(sf::Color(23, 29, 40));
        window.draw(player);
        window.display();
    }
}
