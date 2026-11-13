#include <gtkmm.h>
#include <string>
#include "starter.h"

class MainWindow : public Gtk::ApplicationWindow {
public:
    MainWindow()
    {
        set_title("__PROJECT_NAME__");
        set_default_size(440, 280);
        layout.set_halign(Gtk::Align::CENTER);
        layout.set_valign(Gtk::Align::CENTER);
        increment.signal_clicked().connect(sigc::mem_fun(*this, &MainWindow::on_increment));
        reset.signal_clicked().connect(sigc::mem_fun(*this, &MainWindow::on_reset));
        layout.append(label);
        layout.append(increment);
        layout.append(reset);
        set_child(layout);
    }

private:
    void on_increment()
    {
        count = starter_add(count, 1);
        refresh_count();
    }

    void on_reset()
    {
        count = 0;
        refresh_count();
    }

    void refresh_count() { label.set_text("Clicks: " + std::to_string(count)); }

    Gtk::Box layout{Gtk::Orientation::VERTICAL, 12};
    Gtk::Label label{"Clicks: 0"};
    Gtk::Button increment{"Increment"};
    Gtk::Button reset{"Reset"};
    int count = 0;
};

int main(int argc, char **argv)
{
    auto application = Gtk::Application::create("com.example.app-__PROJECT_SLUG__");
    return application->make_window_and_run<MainWindow>(argc, argv);
}
