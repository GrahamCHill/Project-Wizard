#include <gtkmm.h>
#include <string>
#include "starter.h"

class MainWindow : public Gtk::ApplicationWindow {
public:
    MainWindow()
    {
        set_title("__PROJECT_NAME__");
        set_default_size(440, 280);
        button.set_halign(Gtk::Align::CENTER);
        button.set_valign(Gtk::Align::CENTER);
        button.signal_clicked().connect([this] {
            count = starter_add(count, 1);
            button.set_label("Clicks: " + std::to_string(count));
        });
        set_child(button);
    }

private:
    Gtk::Button button{"Click me"};
    int count = 0;
};

int main(int argc, char **argv)
{
    auto application = Gtk::Application::create("com.example.app-__PROJECT_SLUG__");
    return application->make_window_and_run<MainWindow>(argc, argv);
}
