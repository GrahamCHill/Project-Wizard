cmake_minimum_required(VERSION 3.28)
if(POLICY CMP0168)
    cmake_policy(SET CMP0168 NEW)
endif()
project(__PROJECT_IDENTIFIER__ LANGUAGES CXX)

include(cmake/SFML.cmake)

FetchContent_Declare(imgui
    URL https://codeload.github.com/ocornut/imgui/tar.gz/refs/tags/v1.91.9b
    URL_HASH SHA256=8e1bbc76c71d74fef2fb85db7e7ca8eba13d6a86623c54992b60162db554ffdb
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)
FetchContent_MakeAvailable(imgui)
set(IMGUI_DIR "${imgui_SOURCE_DIR}")
set(IMGUI_SFML_FIND_SFML OFF)
FetchContent_Declare(imgui-sfml
    URL https://codeload.github.com/SFML/imgui-sfml/tar.gz/refs/tags/v3.0
    URL_HASH SHA256=561a04407dcc913b8f1c25a164ad4907852b51fb4f11907d1ab9db6351af911b
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
    EXCLUDE_FROM_ALL
)
FetchContent_MakeAvailable(imgui-sfml)

add_executable(app src/main.cpp)
target_compile_features(app PRIVATE cxx_std_17)
target_link_libraries(app PRIVATE ImGui-SFML::ImGui-SFML)
