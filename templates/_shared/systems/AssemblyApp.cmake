add_library(assembly_routines STATIC ${ASSEMBLY_SOURCE})
target_include_directories(assembly_routines INTERFACE include)

add_executable(app src/main.c)
target_link_libraries(app PRIVATE assembly_routines)

include(CTest)
if(BUILD_TESTING)
    add_executable(test_add tests/test_add.c)
    target_link_libraries(test_add PRIVATE assembly_routines)
    add_test(NAME assembly_add COMMAND test_add)
endif()
