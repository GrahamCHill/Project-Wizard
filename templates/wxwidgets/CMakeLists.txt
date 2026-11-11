cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES CXX)

add_executable(app WIN32 MACOSX_BUNDLE src/main.cpp)
target_compile_features(app PRIVATE cxx_std_17)

find_package(wxWidgets CONFIG QUIET COMPONENTS core base)
if(TARGET wx::core)
    target_link_libraries(app PRIVATE wx::core wx::base)
else()
    find_package(wxWidgets MODULE QUIET COMPONENTS core base)
    if(wxWidgets_FOUND)
        include(UsewxWidgets)
        target_link_libraries(app PRIVATE ${wxWidgets_LIBRARIES})
    else()
        include(FetchContent)
        set(wxBUILD_SHARED OFF CACHE BOOL "Build wxWidgets statically")
        set(wxBUILD_SAMPLES OFF CACHE BOOL "Build wxWidgets samples")
        set(wxBUILD_TESTS OFF CACHE BOOL "Build wxWidgets tests")
        set(wxBUILD_DEMOS OFF CACHE BOOL "Build wxWidgets demos")
        set(wxUSE_WEBVIEW OFF CACHE BOOL "Build the wxWidgets web view")
        FetchContent_Declare(wxwidgets
            URL https://github.com/wxWidgets/wxWidgets/releases/download/v3.2.9/wxWidgets-3.2.9.tar.bz2
            URL_HASH SHA1=7708bfb796dbf8cad90e9cb6c8ad06d8e0a22c81
            DOWNLOAD_EXTRACT_TIMESTAMP TRUE
        )
        FetchContent_MakeAvailable(wxwidgets)
        target_link_libraries(app PRIVATE wx::core wx::base)
    endif()
endif()
