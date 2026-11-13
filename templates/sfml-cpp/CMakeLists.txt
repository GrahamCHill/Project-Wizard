cmake_minimum_required(VERSION 3.28)
if(POLICY CMP0168)
    cmake_policy(SET CMP0168 NEW)
endif()
project(__PROJECT_IDENTIFIER__ LANGUAGES CXX)

include(cmake/SFML.cmake)

add_executable(app src/main.cpp)
target_compile_features(app PRIVATE cxx_std_17)
target_link_libraries(app PRIVATE SFML::Graphics)
