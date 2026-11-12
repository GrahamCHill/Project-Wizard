if(EMSCRIPTEN OR ANDROID)
    return()
endif()

set(distribution_target __APP_TARGET__)
set(distribution_component ProjectRuntime)
set(distribution_vulkan __HAS_VULKAN__)
set(distribution_qt "__QT_DEPLOY__")
set(distribution_lua __HAS_LUA_SCRIPT__)

if(distribution_qt)
    include(GNUInstallDirs)
    install(TARGETS ${distribution_target}
        RUNTIME DESTINATION "${CMAKE_INSTALL_BINDIR}" COMPONENT ${distribution_component}
        BUNDLE DESTINATION . COMPONENT ${distribution_component})
    if(distribution_qt STREQUAL "Quick")
        qt_generate_deploy_qml_app_script(TARGET ${distribution_target} OUTPUT_SCRIPT deploy_script
            NO_UNSUPPORTED_PLATFORM_ERROR DEPLOY_USER_QML_MODULES_ON_UNSUPPORTED_PLATFORM)
    else()
        qt_generate_deploy_app_script(TARGET ${distribution_target} OUTPUT_SCRIPT deploy_script
            NO_UNSUPPORTED_PLATFORM_ERROR)
    endif()
    install(SCRIPT "${deploy_script}" COMPONENT ${distribution_component})
elseif(APPLE)
    install(TARGETS ${distribution_target} BUNDLE DESTINATION . COMPONENT ${distribution_component})
    if(distribution_vulkan)
        get_filename_component(vulkan_lib_dir "${Vulkan_LIBRARY}" DIRECTORY)
        find_file(PROJECT_MOLTENVK_LIBRARY NAMES libMoltenVK.dylib
            HINTS "$ENV{VULKAN_SDK}/lib" "${vulkan_lib_dir}")
        find_file(PROJECT_MOLTENVK_ICD NAMES MoltenVK_icd.json
            HINTS "$ENV{VULKAN_SDK}/share/vulkan/icd.d" "${vulkan_lib_dir}/../share/vulkan/icd.d")
    endif()
    configure_file("${CMAKE_CURRENT_LIST_DIR}/FixupBundle.cmake.in" DistributionBundle.in @ONLY)
    file(GENERATE OUTPUT "${CMAKE_CURRENT_BINARY_DIR}/DistributionBundle-$<CONFIG>.cmake"
        INPUT "${CMAKE_CURRENT_BINARY_DIR}/DistributionBundle.in")
    install(SCRIPT "${CMAKE_CURRENT_BINARY_DIR}/DistributionBundle-$<CONFIG>.cmake"
        COMPONENT ${distribution_component})
else()
    set(runtime_dirs)
    set(exclude_names)
    set(exclude_paths)
    if(WIN32)
        list(APPEND runtime_dirs ${distribution_runtime_dirs})
        foreach(language IN ITEMS C CXX)
            if(CMAKE_${language}_COMPILER)
                get_filename_component(compiler_dir "${CMAKE_${language}_COMPILER}" DIRECTORY)
                list(APPEND runtime_dirs "${compiler_dir}")
            endif()
        endforeach()
        list(APPEND exclude_names "^api-ms-" "^ext-ms-")
        list(APPEND exclude_paths [=[[/\\][Ss][Yy][Ss][Tt][Ee][Mm]32[/\\]]=]
            [=[[/\\][Ss][Yy][Ss][Ww][Oo][Ww]64[/\\]]=])
        set(CMAKE_INSTALL_SYSTEM_RUNTIME_LIBS_SKIP TRUE)
        include(InstallRequiredSystemLibraries)
        foreach(runtime IN LISTS CMAKE_INSTALL_SYSTEM_RUNTIME_LIBS)
            get_filename_component(runtime_dir "${runtime}" DIRECTORY)
            list(APPEND runtime_dirs "${runtime_dir}")
        endforeach()
        if(CMAKE_INSTALL_SYSTEM_RUNTIME_LIBS)
            install(FILES ${CMAKE_INSTALL_SYSTEM_RUNTIME_LIBS} DESTINATION . COMPONENT ${distribution_component})
        endif()
        if(distribution_vulkan)
            list(APPEND exclude_names "^vulkan-1[.]dll$")
            set(PROJECT_VULKAN_RUNTIME_DIR "" CACHE PATH "Local Vulkan loader redistribution directory")
            set(vulkan_arch x64)
            if("${CMAKE_SYSTEM_PROCESSOR};${CMAKE_GENERATOR_PLATFORM};${CMAKE_C_COMPILER_ARCHITECTURE_ID};${CMAKE_CXX_COMPILER_ARCHITECTURE_ID}"
                MATCHES "([Aa][Rr][Mm]64|aarch64)")
                set(vulkan_arch arm64)
            elseif(CMAKE_SIZEOF_VOID_P EQUAL 4)
                set(vulkan_arch x86)
            endif()
            configure_file("${CMAKE_CURRENT_LIST_DIR}/VulkanRuntime.cmake.in" DistributionVulkan.cmake @ONLY)
            install(SCRIPT "${CMAKE_CURRENT_BINARY_DIR}/DistributionVulkan.cmake" COMPONENT ${distribution_component})
        endif()
    else()
        list(APPEND exclude_names
            "^linux-vdso[.]" "^ld-linux" "^lib(c|m|dl|pthread|rt|resolv|util|anl)[.]so"
            "^lib(nss_.*|GL|GLX|GLdispatch|EGL|drm|gbm)[.]so")
        set_property(TARGET ${distribution_target} APPEND PROPERTY INSTALL_RPATH "$ORIGIN/lib")
        configure_file("${CMAKE_CURRENT_LIST_DIR}/Run.sh.in" DistributionRun.in @ONLY NEWLINE_STYLE UNIX)
        file(GENERATE OUTPUT "${CMAKE_CURRENT_BINARY_DIR}/DistributionRun-$<CONFIG>.sh"
            INPUT "${CMAKE_CURRENT_BINARY_DIR}/DistributionRun.in")
        install(PROGRAMS "${CMAKE_CURRENT_BINARY_DIR}/DistributionRun-$<CONFIG>.sh"
            DESTINATION . RENAME run.sh COMPONENT ${distribution_component})
    endif()
    install(TARGETS ${distribution_target} RUNTIME DESTINATION . COMPONENT ${distribution_component})
    configure_file("${CMAKE_CURRENT_LIST_DIR}/InstallRuntime.cmake.in" DistributionRuntime.in @ONLY)
    file(GENERATE OUTPUT "${CMAKE_CURRENT_BINARY_DIR}/DistributionRuntime-$<CONFIG>.cmake"
        INPUT "${CMAKE_CURRENT_BINARY_DIR}/DistributionRuntime.in")
    install(SCRIPT "${CMAKE_CURRENT_BINARY_DIR}/DistributionRuntime-$<CONFIG>.cmake"
        COMPONENT ${distribution_component})
endif()

if(distribution_lua)
    set(script_dir .)
    if(APPLE)
        set(script_dir "$<TARGET_BUNDLE_DIR_NAME:${distribution_target}>/Contents/MacOS")
    endif()
    install(FILES scripts/message.lua DESTINATION "${script_dir}" COMPONENT ${distribution_component})
endif()

foreach(dependency IN ITEMS sdl2 sdl3 raylib wxwidgets yyjson fmt nlohmann_json cxxopts glm stb imgui asio libuv)
    if(${dependency}_SOURCE_DIR)
        set(source_dir "${${dependency}_SOURCE_DIR}")
        install(FILES "${source_dir}/LICENSE.txt" "${source_dir}/LICENSE" "${source_dir}/LICENSE.md"
            "${source_dir}/COPYING" "${source_dir}/copying.txt" "${source_dir}/LICENSE_1_0.txt" "${source_dir}/LICENSE-extra"
            DESTINATION "licenses/${dependency}" OPTIONAL COMPONENT ${distribution_component})
    endif()
endforeach()
if(wxwidgets_SOURCE_DIR)
    install(FILES "${wxwidgets_SOURCE_DIR}/docs/licence.txt" "${wxwidgets_SOURCE_DIR}/docs/lgpl.txt"
        DESTINATION licenses/wxwidgets OPTIONAL COMPONENT ${distribution_component})
endif()
if(tinyfiledialogs_SOURCE_DIR)
    install(FILES "${tinyfiledialogs_SOURCE_DIR}/README.txt" DESTINATION licenses/tinyfiledialogs
        COMPONENT ${distribution_component})
endif()
if(bgfx_cmake_SOURCE_DIR)
    foreach(dependency IN ITEMS bgfx bimg bx)
        FetchContent_GetProperties(${dependency} SOURCE_DIR source_dir)
        if(source_dir)
            install(FILES "${source_dir}/LICENSE" DESTINATION "licenses/${dependency}"
                OPTIONAL COMPONENT ${distribution_component})
        endif()
    endforeach()
endif()
if(distribution_lua)
    install(FILES "${lua_SOURCE_DIR}/doc/readme.html" DESTINATION licenses/lua COMPONENT ${distribution_component})
endif()

set(distribution_dir "${CMAKE_CURRENT_BINARY_DIR}/dist/$<IF:$<BOOL:$<CONFIG>>,$<CONFIG>,Default>")
add_custom_target(distribution
    COMMAND "${CMAKE_COMMAND}" -E rm -rf "${distribution_dir}"
    COMMAND "${CMAKE_COMMAND}" --install "${CMAKE_CURRENT_BINARY_DIR}" --config "$<CONFIG>"
        --prefix "${distribution_dir}" --component "${distribution_component}"
    DEPENDS ${distribution_target}
    USES_TERMINAL
    VERBATIM)
