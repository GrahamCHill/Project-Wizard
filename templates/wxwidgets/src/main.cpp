#include "starter.h"
#include <wx/wx.h>

class MainWindow final : public wxFrame {
public:
    MainWindow() : wxFrame(nullptr, wxID_ANY, "__PROJECT_NAME__", wxDefaultPosition, wxSize(480, 280))
    {
        auto *panel = new wxPanel(this);
        auto *layout = new wxBoxSizer(wxVERTICAL);
        label = new wxStaticText(panel, wxID_ANY, "Clicks: 0");
        auto *increment = new wxButton(panel, wxID_ANY, "Increment");
        auto *reset = new wxButton(panel, wxID_ANY, "Reset");
        increment->Bind(wxEVT_BUTTON, &MainWindow::OnIncrement, this);
        reset->Bind(wxEVT_BUTTON, &MainWindow::OnReset, this);
        layout->AddStretchSpacer();
        layout->Add(label, 0, wxALIGN_CENTER | wxBOTTOM, 12);
        layout->Add(increment, 0, wxALIGN_CENTER | wxBOTTOM, 8);
        layout->Add(reset, 0, wxALIGN_CENTER);
        layout->AddStretchSpacer();
        panel->SetSizer(layout);
        Centre();
    }

private:
    void OnIncrement(wxCommandEvent &)
    {
        count = starter_add(count, 1);
        RefreshCount();
    }

    void OnReset(wxCommandEvent &)
    {
        count = 0;
        RefreshCount();
    }

    void RefreshCount()
    {
        label->SetLabel(wxString::Format("Clicks: %d", count));
        label->GetParent()->Layout();
    }

    wxStaticText *label;
    int count = 0;
};

class StarterApp final : public wxApp {
public:
    bool OnInit() override
    {
        auto *window = new MainWindow();
        window->Show();
        return true;
    }
};

wxIMPLEMENT_APP(StarterApp);
