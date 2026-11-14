cmake_minimum_required(VERSION 3.24)

if(NOT DEFINED ENV{IDF_PATH})
    message(FATAL_ERROR "Activate the ESP-IDF environment as shown in README.md.")
endif()
include("$ENV{IDF_PATH}/tools/cmake/project.cmake")
project(__PROJECT_IDENTIFIER__)
