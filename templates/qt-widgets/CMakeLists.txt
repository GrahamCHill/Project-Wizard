cmake_minimum_required(VERSION 3.24)
project(__PROJECT_IDENTIFIER__ LANGUAGES CXX)

find_package(__QT_PACKAGE__ __QT_MINIMUM__ REQUIRED COMPONENTS Widgets)
__QT_ADD_EXECUTABLE__(app WIN32 MACOSX_BUNDLE src/main.cpp)
target_compile_features(app PRIVATE cxx_std_17)
target_link_libraries(app PRIVATE __QT_PACKAGE__::Widgets)
