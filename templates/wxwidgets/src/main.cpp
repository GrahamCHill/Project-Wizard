#include <wx/wx.h>

class StarterApp final : public wxApp {
public:
    bool OnInit() override
    {
        auto *window = new wxFrame(nullptr, wxID_ANY, "__PROJECT_NAME__", wxDefaultPosition, wxSize(480, 280));
        auto *panel = new wxPanel(window);
        auto *layout = new wxBoxSizer(wxVERTICAL);
        layout->AddStretchSpacer();
        layout->Add(new wxStaticText(panel, wxID_ANY, "__PROJECT_NAME__"), 0, wxALIGN_CENTER);
        layout->AddStretchSpacer();
        panel->SetSizer(layout);
        window->Centre();
        window->Show();
        return true;
    }
};

wxIMPLEMENT_APP(StarterApp);
