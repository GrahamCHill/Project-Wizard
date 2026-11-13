#include <SFML/Graphics.hpp>

int main()
{
    sf::RenderWindow window(sf::VideoMode({800, 500}), "__PROJECT_NAME__");
    window.setFramerateLimit(60);

    sf::CircleShape player(28.f);
    player.setOrigin({28.f, 28.f});
    player.setPosition({400.f, 250.f});
    player.setFillColor(sf::Color(94, 208, 191));
    sf::Clock clock;

    while (window.isOpen()) {
        while (const auto event = window.pollEvent()) {
            if (event->is<sf::Event::Closed>()) {
                window.close();
                break;
            }
        }
        if (!window.isOpen()) break;

        const float step = 220.f * clock.restart().asSeconds();
        if (window.hasFocus()) {
            using Key = sf::Keyboard::Key;
            const int x = sf::Keyboard::isKeyPressed(Key::Right) - sf::Keyboard::isKeyPressed(Key::Left);
            const int y = sf::Keyboard::isKeyPressed(Key::Down) - sf::Keyboard::isKeyPressed(Key::Up);
            player.move({x * step, y * step});
        }

        window.clear(sf::Color(23, 29, 40));
        window.draw(player);
        window.display();
    }
}
