include(BundleUtilities)

if(NOT IS_DIRECTORY "${APP_BUNDLE}")
    message(FATAL_ERROR "Set APP_BUNDLE to the published app bundle.")
endif()
set(frameworks "${APP_BUNDLE}/Contents/Frameworks")
set(executables "${APP_BUNDLE}/Contents/MacOS")
file(MAKE_DIRECTORY "${frameworks}")
if(EXISTS "${executables}/libMoltenVK.dylib")
    file(RENAME "${executables}/libMoltenVK.dylib" "${frameworks}/libMoltenVK.dylib")
endif()

# .NET loads its native runtime from Contents/MacOS. Include those libraries
# explicitly so dependencies of dynamically loaded libraries are also checked.
file(GLOB libraries "${executables}/*.dylib" "${frameworks}/*.dylib")
set(BU_CHMOD_BUNDLE_ITEMS ON)
fixup_bundle("${APP_BUNDLE}" "${libraries}" "${executables};${frameworks}")
execute_process(COMMAND /usr/bin/codesign --force --deep --sign - "${APP_BUNDLE}" COMMAND_ERROR_IS_FATAL ANY)
