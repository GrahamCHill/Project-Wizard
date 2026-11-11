cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES CXX)

find_package(Qt6 6.5 REQUIRED COMPONENTS Quick)
qt_standard_project_setup(REQUIRES 6.5)
qt_add_executable(app WIN32 MACOSX_BUNDLE src/main.cpp)
qt_add_qml_module(app URI ProjectStarter QML_FILES Main.qml)
target_compile_features(app PRIVATE cxx_std_17)
target_link_libraries(app PRIVATE Qt6::Quick)
