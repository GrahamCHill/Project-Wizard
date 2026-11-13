cmake_minimum_required(VERSION 3.28)
if(POLICY CMP0168)
    cmake_policy(SET CMP0168 NEW)
endif()
project(__PROJECT_IDENTIFIER__ LANGUAGES CXX)

include(cmake/SFML.cmake)

FetchContent_Declare(imgui
    URL https://codeload.github.com/ocornut/imgui/tar.gz/refs/tags/v__SFML_DEAR_IMGUI_VERSION__
    URL_HASH SHA256=__SFML_DEAR_IMGUI_HASH__
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
FetchContent_MakeAvailable(imgui)
set(IMGUI_DIR "${imgui_SOURCE_DIR}")
set(IMGUI_SFML_FIND_SFML OFF)
FetchContent_Declare(imgui-sfml
    URL https://codeload.github.com/SFML/imgui-sfml/tar.gz/refs/tags/v__SFML_IMGUI_VERSION__
    URL_HASH SHA256=__SFML_IMGUI_HASH__
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    EXCLUDE_FROM_ALL
)
FetchContent_MakeAvailable(imgui-sfml)

add_executable(app src/main.cpp)
target_compile_features(app PRIVATE cxx_std_17)
target_link_libraries(app PRIVATE ImGui-SFML::ImGui-SFML)
