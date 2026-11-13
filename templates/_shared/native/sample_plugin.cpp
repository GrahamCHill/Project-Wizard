#include "plugin_api.h"

uint32_t plugin_api_version()
{
    return PLUGIN_API_VERSION;
}

const char *plugin_greet()
{
    return "Hello from a dynamically loaded C++ plugin";
}
