#include <bgfx/bgfx.h>
#include <iostream>

int main()
{
    bgfx::RendererType::Enum renderers[bgfx::RendererType::Count];
    const auto count = bgfx::getSupportedRenderers(bgfx::RendererType::Count, renderers);
    std::cout << "bgfx renderer backends:\n";
    for (unsigned index = 0; index < count; ++index) {
        std::cout << "  " << bgfx::getRendererName(renderers[index]) << '\n';
    }
    return count > 0 ? 0 : 1;
}
