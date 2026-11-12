#include <imgui.h>
#include <iostream>

int main()
{
    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    auto &io = ImGui::GetIO();
    io.IniFilename = nullptr;
    io.DisplaySize = ImVec2(640, 480);
    io.BackendFlags |= ImGuiBackendFlags_RendererHasTextures;

    ImGui::NewFrame();
    ImGui::SetNextWindowSize(ImVec2(300, 120));
    ImGui::Begin("Example");
    ImGui::TextUnformatted("Hello from Dear ImGui");
    ImGui::End();
    ImGui::Render();

    const int vertices = ImGui::GetDrawData()->TotalVtxCount;
    std::cout << "Dear ImGui generated " << vertices << " vertices for the example window.\n";
    ImGui::DestroyContext();
    return vertices > 0 ? 0 : 1;
}
