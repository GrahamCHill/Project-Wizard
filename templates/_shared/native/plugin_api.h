#pragma once

#include <stdint.h>

#ifdef _WIN32
#define PLUGIN_EXPORT __declspec(dllexport)
#else
#define PLUGIN_EXPORT __attribute__((visibility("default")))
#endif

#define PLUGIN_API_VERSION 1

#ifdef __cplusplus
extern "C" {
#endif

/* The host copies the returned text before unloading the library. */
PLUGIN_EXPORT uint32_t plugin_api_version(void);
PLUGIN_EXPORT const char *plugin_greet(void);

#ifdef __cplusplus
}
#endif
