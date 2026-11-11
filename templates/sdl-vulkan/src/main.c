#include <vulkan/vulkan.h>
#if STARTER_SDL_MAJOR == 3
#include <SDL3/SDL.h>
#include <SDL3/SDL_main.h>
#include <SDL3/SDL_vulkan.h>
#else
#define SDL_MAIN_HANDLED
#include <SDL.h>
#include <SDL_vulkan.h>
#endif
#include "starter.h"
#include <stdio.h>
#include <string.h>

typedef struct SwapImage {
    VkImageView view;
    VkFramebuffer framebuffer;
    VkSemaphore readyToPresent;
} SwapImage;

typedef struct VulkanApp {
    VkInstance instance;
    VkSurfaceKHR surface;
    VkPhysicalDevice gpu;
    VkDevice device;
    uint32_t graphicsFamily;
    uint32_t presentFamily;
    VkQueue graphicsQueue;
    VkQueue presentQueue;
    VkCommandPool commandPool;
    VkCommandBuffer commands;
    VkSemaphore imageAvailable;
    VkFence frameFinished;
    VkSwapchainKHR swapchain;
    VkExtent2D extent;
    VkRenderPass renderPass;
    uint32_t imageCount;
    SwapImage *images;
} VulkanApp;

static int vkOk(VkResult result, const char *operation)
{
    if (result == VK_SUCCESS) return 1;
    fprintf(stderr, "%s failed (%d)\n", operation, (int)result);
    return 0;
}

#define VK_OK(operation) vkOk((operation), #operation)

static SDL_Window *openWindow(void)
{
#if STARTER_SDL_MAJOR == 3
    if (!SDL_Init(SDL_INIT_VIDEO)) return NULL;
    return SDL_CreateWindow("__PROJECT_NAME__", 800, 450,
        SDL_WINDOW_VULKAN | SDL_WINDOW_RESIZABLE | SDL_WINDOW_HIGH_PIXEL_DENSITY);
#else
    SDL_SetMainReady();
    if (SDL_Init(SDL_INIT_VIDEO) != 0) return NULL;
    return SDL_CreateWindow("__PROJECT_NAME__", SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
        800, 450, SDL_WINDOW_VULKAN | SDL_WINDOW_RESIZABLE | SDL_WINDOW_ALLOW_HIGHDPI);
#endif
}

static int hasExtension(VkPhysicalDevice gpu, const char *name)
{
    uint32_t count = 0;
    VkResult result = gpu ? vkEnumerateDeviceExtensionProperties(gpu, NULL, &count, NULL) :
        vkEnumerateInstanceExtensionProperties(NULL, &count, NULL);
    if (result != VK_SUCCESS || count == 0) return 0;

    VkExtensionProperties *properties = (VkExtensionProperties *)SDL_calloc(count, sizeof(*properties));
    if (!properties) return 0;
    result = gpu ? vkEnumerateDeviceExtensionProperties(gpu, NULL, &count, properties) :
        vkEnumerateInstanceExtensionProperties(NULL, &count, properties);
    int found = 0;
    for (uint32_t i = 0; result == VK_SUCCESS && i < count; ++i) {
        if (strcmp(properties[i].extensionName, name) == 0) found = 1;
    }
    SDL_free(properties);
    return found;
}

static int createInstance(VulkanApp *app, SDL_Window *window)
{
    uint32_t count = 0;
#if STARTER_SDL_MAJOR == 3
    const char *const *required = SDL_Vulkan_GetInstanceExtensions(&count);
    if (!required) return 0;
#else
    if (!SDL_Vulkan_GetInstanceExtensions(window, &count, NULL)) return 0;
#endif
    const char **extensions = (const char **)SDL_calloc(count + 1, sizeof(*extensions));
    if (!extensions) return 0;
#if STARTER_SDL_MAJOR == 3
    memcpy(extensions, required, count * sizeof(*extensions));
#else
    if (!SDL_Vulkan_GetInstanceExtensions(window, &count, extensions)) {
        SDL_free(extensions);
        return 0;
    }
#endif

    VkApplicationInfo application = { VK_STRUCTURE_TYPE_APPLICATION_INFO };
    application.pApplicationName = "__PROJECT_NAME__";
    application.apiVersion = VK_API_VERSION_1_1;
    VkInstanceCreateInfo info = { VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO };
    if (hasExtension(VK_NULL_HANDLE, VK_KHR_PORTABILITY_ENUMERATION_EXTENSION_NAME)) {
        int listed = 0;
        for (uint32_t i = 0; i < count; ++i) {
            if (strcmp(extensions[i], VK_KHR_PORTABILITY_ENUMERATION_EXTENSION_NAME) == 0) listed = 1;
        }
        if (!listed) extensions[count++] = VK_KHR_PORTABILITY_ENUMERATION_EXTENSION_NAME;
        info.flags = VK_INSTANCE_CREATE_ENUMERATE_PORTABILITY_BIT_KHR;
    }
    info.pApplicationInfo = &application;
    info.enabledExtensionCount = count;
    info.ppEnabledExtensionNames = extensions;
    const int created = VK_OK(vkCreateInstance(&info, NULL, &app->instance));
    SDL_free(extensions);
    if (!created) return 0;

#if STARTER_SDL_MAJOR == 3
    return SDL_Vulkan_CreateSurface(window, app->instance, NULL, &app->surface);
#else
    return SDL_Vulkan_CreateSurface(window, app->instance, &app->surface);
#endif
}

static int findQueues(VkPhysicalDevice gpu, VkSurfaceKHR surface, uint32_t *graphics, uint32_t *present)
{
    uint32_t count = 0;
    vkGetPhysicalDeviceQueueFamilyProperties(gpu, &count, NULL);
    VkQueueFamilyProperties *queues = (VkQueueFamilyProperties *)SDL_calloc(count, sizeof(*queues));
    if (!queues) return 0;
    vkGetPhysicalDeviceQueueFamilyProperties(gpu, &count, queues);
    *graphics = *present = UINT32_MAX;
    for (uint32_t i = 0; i < count; ++i) {
        if (queues[i].queueCount == 0) continue;
        const int canDraw = (queues[i].queueFlags & VK_QUEUE_GRAPHICS_BIT) != 0;
        VkBool32 canPresent = VK_FALSE;
        if (vkGetPhysicalDeviceSurfaceSupportKHR(gpu, i, surface, &canPresent) != VK_SUCCESS) continue;
        if (canDraw && canPresent) {
            *graphics = *present = i;
            break;
        }
        if (canDraw && *graphics == UINT32_MAX) *graphics = i;
        if (canPresent && *present == UINT32_MAX) *present = i;
    }
    SDL_free(queues);
    return *graphics != UINT32_MAX && *present != UINT32_MAX;
}

static int selectGpu(VulkanApp *app)
{
    uint32_t count = 0;
    if (!VK_OK(vkEnumeratePhysicalDevices(app->instance, &count, NULL)) || count == 0) return 0;
    VkPhysicalDevice *devices = (VkPhysicalDevice *)SDL_calloc(count, sizeof(*devices));
    if (!devices) return 0;
    if (VK_OK(vkEnumeratePhysicalDevices(app->instance, &count, devices))) {
        for (uint32_t i = 0; i < count; ++i) {
            uint32_t formatCount = 0;
            if (hasExtension(devices[i], VK_KHR_SWAPCHAIN_EXTENSION_NAME) &&
                findQueues(devices[i], app->surface, &app->graphicsFamily, &app->presentFamily) &&
                vkGetPhysicalDeviceSurfaceFormatsKHR(devices[i], app->surface, &formatCount, NULL) == VK_SUCCESS &&
                formatCount > 0) {
                app->gpu = devices[i];
                break;
            }
        }
    }
    SDL_free(devices);
    return app->gpu != VK_NULL_HANDLE;
}

static int createDevice(VulkanApp *app)
{
    const float priority = 1.0f;
    VkDeviceQueueCreateInfo queues[] = {
        { VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO },
        { VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO }
    };
    queues[0].queueFamilyIndex = app->graphicsFamily;
    queues[0].queueCount = 1;
    queues[0].pQueuePriorities = &priority;
    queues[1] = queues[0];
    queues[1].queueFamilyIndex = app->presentFamily;

    const char *extensions[] = { VK_KHR_SWAPCHAIN_EXTENSION_NAME, "VK_KHR_portability_subset" };
    VkDeviceCreateInfo info = { VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO };
    info.queueCreateInfoCount = app->graphicsFamily == app->presentFamily ? 1 : 2;
    info.pQueueCreateInfos = queues;
    info.enabledExtensionCount = hasExtension(app->gpu, extensions[1]) ? 2 : 1;
    info.ppEnabledExtensionNames = extensions;
    if (!VK_OK(vkCreateDevice(app->gpu, &info, NULL, &app->device))) return 0;

    vkGetDeviceQueue(app->device, app->graphicsFamily, 0, &app->graphicsQueue);
    vkGetDeviceQueue(app->device, app->presentFamily, 0, &app->presentQueue);
    VkCommandPoolCreateInfo pool = { VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO };
    pool.flags = VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT;
    pool.queueFamilyIndex = app->graphicsFamily;
    if (!VK_OK(vkCreateCommandPool(app->device, &pool, NULL, &app->commandPool))) return 0;
    VkCommandBufferAllocateInfo buffers = { VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO };
    buffers.commandPool = app->commandPool;
    buffers.level = VK_COMMAND_BUFFER_LEVEL_PRIMARY;
    buffers.commandBufferCount = 1;
    VkSemaphoreCreateInfo semaphore = { VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO };
    VkFenceCreateInfo fence = { VK_STRUCTURE_TYPE_FENCE_CREATE_INFO };
    fence.flags = VK_FENCE_CREATE_SIGNALED_BIT;
    return VK_OK(vkAllocateCommandBuffers(app->device, &buffers, &app->commands)) &&
        VK_OK(vkCreateSemaphore(app->device, &semaphore, NULL, &app->imageAvailable)) &&
        VK_OK(vkCreateFence(app->device, &fence, NULL, &app->frameFinished));
}

static void destroySwapchain(VulkanApp *app)
{
    for (uint32_t i = 0; i < app->imageCount && app->images; ++i) {
        const SwapImage *image = &app->images[i];
        if (image->framebuffer) vkDestroyFramebuffer(app->device, image->framebuffer, NULL);
        if (image->view) vkDestroyImageView(app->device, image->view, NULL);
        if (image->readyToPresent) vkDestroySemaphore(app->device, image->readyToPresent, NULL);
    }
    SDL_free(app->images);
    if (app->renderPass) vkDestroyRenderPass(app->device, app->renderPass, NULL);
    if (app->swapchain) vkDestroySwapchainKHR(app->device, app->swapchain, NULL);
    app->images = NULL;
    app->imageCount = 0;
    app->renderPass = VK_NULL_HANDLE;
    app->swapchain = VK_NULL_HANDLE;
}

static int chooseFormat(const VulkanApp *app, VkSurfaceFormatKHR *selected)
{
    uint32_t count = 0;
    if (!VK_OK(vkGetPhysicalDeviceSurfaceFormatsKHR(app->gpu, app->surface, &count, NULL)) || count == 0) return 0;
    VkSurfaceFormatKHR *formats = (VkSurfaceFormatKHR *)SDL_calloc(count, sizeof(*formats));
    if (!formats) return 0;
    const int listed = VK_OK(vkGetPhysicalDeviceSurfaceFormatsKHR(app->gpu, app->surface, &count, formats));
    if (listed) {
        *selected = formats[0];
        for (uint32_t i = 0; i < count; ++i) {
            if (formats[i].format == VK_FORMAT_B8G8R8A8_SRGB &&
                formats[i].colorSpace == VK_COLOR_SPACE_SRGB_NONLINEAR_KHR) {
                *selected = formats[i];
                break;
            }
        }
        if (selected->format == VK_FORMAT_UNDEFINED) selected->format = VK_FORMAT_B8G8R8A8_UNORM;
    }
    SDL_free(formats);
    return listed;
}

static int createRenderPass(VulkanApp *app, VkFormat format)
{
    VkAttachmentDescription color = { 0 };
    color.format = format;
    color.samples = VK_SAMPLE_COUNT_1_BIT;
    color.loadOp = VK_ATTACHMENT_LOAD_OP_CLEAR;
    color.storeOp = VK_ATTACHMENT_STORE_OP_STORE;
    color.stencilLoadOp = VK_ATTACHMENT_LOAD_OP_DONT_CARE;
    color.stencilStoreOp = VK_ATTACHMENT_STORE_OP_DONT_CARE;
    color.initialLayout = VK_IMAGE_LAYOUT_UNDEFINED;
    color.finalLayout = VK_IMAGE_LAYOUT_PRESENT_SRC_KHR;
    const VkAttachmentReference attachment = { 0, VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL };
    VkSubpassDescription subpass = { 0 };
    subpass.pipelineBindPoint = VK_PIPELINE_BIND_POINT_GRAPHICS;
    subpass.colorAttachmentCount = 1;
    subpass.pColorAttachments = &attachment;
    VkSubpassDependency dependency = { 0 };
    dependency.srcSubpass = VK_SUBPASS_EXTERNAL;
    dependency.dstSubpass = 0;
    dependency.srcStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    dependency.dstStageMask = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    dependency.dstAccessMask = VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
    VkRenderPassCreateInfo info = { VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO };
    info.attachmentCount = 1;
    info.pAttachments = &color;
    info.subpassCount = 1;
    info.pSubpasses = &subpass;
    info.dependencyCount = 1;
    info.pDependencies = &dependency;
    return VK_OK(vkCreateRenderPass(app->device, &info, NULL, &app->renderPass));
}

static int createSwapImages(VulkanApp *app, VkFormat format)
{
    if (!VK_OK(vkGetSwapchainImagesKHR(app->device, app->swapchain, &app->imageCount, NULL))) return 0;
    VkImage *images = (VkImage *)SDL_calloc(app->imageCount, sizeof(*images));
    app->images = (SwapImage *)SDL_calloc(app->imageCount, sizeof(*app->images));
    const int listed = images && app->images &&
        VK_OK(vkGetSwapchainImagesKHR(app->device, app->swapchain, &app->imageCount, images));
    int complete = listed;
    for (uint32_t i = 0; complete && i < app->imageCount; ++i) {
        SwapImage *image = &app->images[i];
        VkImageViewCreateInfo view = { VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO };
        view.image = images[i];
        view.viewType = VK_IMAGE_VIEW_TYPE_2D;
        view.format = format;
        view.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
        view.subresourceRange.levelCount = 1;
        view.subresourceRange.layerCount = 1;
        VkFramebufferCreateInfo frame = { VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO };
        frame.renderPass = app->renderPass;
        frame.attachmentCount = 1;
        frame.pAttachments = &image->view;
        frame.width = app->extent.width;
        frame.height = app->extent.height;
        frame.layers = 1;
        VkSemaphoreCreateInfo semaphore = { VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO };
        complete = VK_OK(vkCreateImageView(app->device, &view, NULL, &image->view)) &&
            VK_OK(vkCreateFramebuffer(app->device, &frame, NULL, &image->framebuffer)) &&
            VK_OK(vkCreateSemaphore(app->device, &semaphore, NULL, &image->readyToPresent));
    }
    SDL_free(images);
    return complete;
}

static uint32_t clampExtent(uint32_t value, uint32_t minimum, uint32_t maximum)
{
    if (value < minimum) return minimum;
    return value > maximum ? maximum : value;
}

static VkCompositeAlphaFlagBitsKHR compositeAlpha(VkCompositeAlphaFlagsKHR supported)
{
    const VkCompositeAlphaFlagBitsKHR modes[] = {
        VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR, VK_COMPOSITE_ALPHA_PRE_MULTIPLIED_BIT_KHR,
        VK_COMPOSITE_ALPHA_POST_MULTIPLIED_BIT_KHR, VK_COMPOSITE_ALPHA_INHERIT_BIT_KHR
    };
    for (unsigned i = 0; i < sizeof(modes) / sizeof(modes[0]); ++i) {
        if (supported & modes[i]) return modes[i];
    }
    return VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR;
}

static int rebuildSwapchain(VulkanApp *app, int width, int height)
{
    if (!VK_OK(vkDeviceWaitIdle(app->device))) return 0;
    destroySwapchain(app);
    VkSurfaceCapabilitiesKHR capabilities;
    if (!VK_OK(vkGetPhysicalDeviceSurfaceCapabilitiesKHR(app->gpu, app->surface, &capabilities))) return 0;
    app->extent = capabilities.currentExtent;
    if (app->extent.width == UINT32_MAX) {
        app->extent.width = clampExtent((uint32_t)width, capabilities.minImageExtent.width, capabilities.maxImageExtent.width);
        app->extent.height = clampExtent((uint32_t)height, capabilities.minImageExtent.height, capabilities.maxImageExtent.height);
    }
    if (!app->extent.width || !app->extent.height) return 1;
    VkSurfaceFormatKHR format;
    if (!chooseFormat(app, &format)) return 0;

    VkSwapchainCreateInfoKHR info = { VK_STRUCTURE_TYPE_SWAPCHAIN_CREATE_INFO_KHR };
    info.surface = app->surface;
    info.minImageCount = capabilities.minImageCount + 1;
    if (capabilities.maxImageCount && info.minImageCount > capabilities.maxImageCount) {
        info.minImageCount = capabilities.maxImageCount;
    }
    info.imageFormat = format.format;
    info.imageColorSpace = format.colorSpace;
    info.imageExtent = app->extent;
    info.imageArrayLayers = 1;
    info.imageUsage = VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT;
    const uint32_t families[] = { app->graphicsFamily, app->presentFamily };
    info.imageSharingMode = VK_SHARING_MODE_EXCLUSIVE;
    if (app->graphicsFamily != app->presentFamily) {
        info.imageSharingMode = VK_SHARING_MODE_CONCURRENT;
        info.queueFamilyIndexCount = 2;
        info.pQueueFamilyIndices = families;
    }
    info.preTransform = capabilities.currentTransform;
    info.compositeAlpha = compositeAlpha(capabilities.supportedCompositeAlpha);
    info.presentMode = VK_PRESENT_MODE_FIFO_KHR;
    info.clipped = VK_TRUE;
    return VK_OK(vkCreateSwapchainKHR(app->device, &info, NULL, &app->swapchain)) &&
        createRenderPass(app, format.format) && createSwapImages(app, format.format);
}

static int recordClear(const VulkanApp *app, uint32_t index)
{
    VkCommandBufferBeginInfo begin = { VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO };
    begin.flags = VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT;
    if (!VK_OK(vkResetCommandBuffer(app->commands, 0)) ||
        !VK_OK(vkBeginCommandBuffer(app->commands, &begin))) return 0;

    VkClearValue color = { 0 };
    color.color.float32[0] = 0.04f;
    color.color.float32[1] = 0.12f;
    color.color.float32[2] = (float)starter_add(2, 3) / 10.0f;
    color.color.float32[3] = 1.0f;
    VkRenderPassBeginInfo pass = { VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO };
    pass.renderPass = app->renderPass;
    pass.framebuffer = app->images[index].framebuffer;
    pass.renderArea.extent = app->extent;
    pass.clearValueCount = 1;
    pass.pClearValues = &color;
    vkCmdBeginRenderPass(app->commands, &pass, VK_SUBPASS_CONTENTS_INLINE);
    vkCmdEndRenderPass(app->commands);
    return VK_OK(vkEndCommandBuffer(app->commands));
}

typedef enum FrameResult { FRAME_FAILED, FRAME_PRESENTED, FRAME_RESIZE } FrameResult;

static FrameResult drawFrame(const VulkanApp *app)
{
    if (!VK_OK(vkWaitForFences(app->device, 1, &app->frameFinished, VK_TRUE, UINT64_MAX))) return FRAME_FAILED;
    uint32_t index = 0;
    const VkResult acquired = vkAcquireNextImageKHR(app->device, app->swapchain, UINT64_MAX,
        app->imageAvailable, VK_NULL_HANDLE, &index);
    if (acquired == VK_ERROR_OUT_OF_DATE_KHR) return FRAME_RESIZE;
    if (acquired != VK_SUBOPTIMAL_KHR && !vkOk(acquired, "vkAcquireNextImageKHR")) return FRAME_FAILED;
    if (!recordClear(app, index) || !VK_OK(vkResetFences(app->device, 1, &app->frameFinished))) return FRAME_FAILED;

    // Reacquiring this image also releases its previous presentation semaphore.
    const VkSemaphore ready = app->images[index].readyToPresent;
    const VkPipelineStageFlags waitStage = VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    VkSubmitInfo submit = { VK_STRUCTURE_TYPE_SUBMIT_INFO };
    submit.waitSemaphoreCount = 1;
    submit.pWaitSemaphores = &app->imageAvailable;
    submit.pWaitDstStageMask = &waitStage;
    submit.commandBufferCount = 1;
    submit.pCommandBuffers = &app->commands;
    submit.signalSemaphoreCount = 1;
    submit.pSignalSemaphores = &ready;
    if (!VK_OK(vkQueueSubmit(app->graphicsQueue, 1, &submit, app->frameFinished))) return FRAME_FAILED;

    VkPresentInfoKHR present = { VK_STRUCTURE_TYPE_PRESENT_INFO_KHR };
    present.waitSemaphoreCount = 1;
    present.pWaitSemaphores = &ready;
    present.swapchainCount = 1;
    present.pSwapchains = &app->swapchain;
    present.pImageIndices = &index;
    const VkResult shown = vkQueuePresentKHR(app->presentQueue, &present);
    if (shown == VK_ERROR_OUT_OF_DATE_KHR || shown == VK_SUBOPTIMAL_KHR) return FRAME_RESIZE;
    if (!vkOk(shown, "vkQueuePresentKHR")) return FRAME_FAILED;
    return acquired == VK_SUBOPTIMAL_KHR ? FRAME_RESIZE : FRAME_PRESENTED;
}

static int run(VulkanApp *app, SDL_Window *window)
{
    int previousWidth = 0;
    int previousHeight = 0;
    int resize = 1;
    for (;;) {
        SDL_Event event;
        while (SDL_PollEvent(&event)) {
#if STARTER_SDL_MAJOR == 3
            if (event.type == SDL_EVENT_QUIT) return 1;
#else
            if (event.type == SDL_QUIT) return 1;
#endif
        }
        int width = 0;
        int height = 0;
#if STARTER_SDL_MAJOR == 3
        SDL_GetWindowSizeInPixels(window, &width, &height);
#else
        SDL_Vulkan_GetDrawableSize(window, &width, &height);
#endif
        if (width <= 0 || height <= 0 || (SDL_GetWindowFlags(window) & SDL_WINDOW_MINIMIZED)) {
            SDL_Delay(30);
            continue;
        }
        if (resize || width != previousWidth || height != previousHeight || !app->swapchain) {
            if (!rebuildSwapchain(app, width, height)) return 0;
            previousWidth = width;
            previousHeight = height;
        }
        if (!app->swapchain) {
            SDL_Delay(30);
            continue;
        }
        const FrameResult result = drawFrame(app);
        if (result == FRAME_FAILED) return 0;
        resize = result == FRAME_RESIZE;
    }
}

static void shutdown(VulkanApp *app)
{
    if (app->device) {
        vkDeviceWaitIdle(app->device);
        destroySwapchain(app);
        if (app->frameFinished) vkDestroyFence(app->device, app->frameFinished, NULL);
        if (app->imageAvailable) vkDestroySemaphore(app->device, app->imageAvailable, NULL);
        if (app->commandPool) vkDestroyCommandPool(app->device, app->commandPool, NULL);
        vkDestroyDevice(app->device, NULL);
    }
    if (app->surface) vkDestroySurfaceKHR(app->instance, app->surface, NULL);
    if (app->instance) vkDestroyInstance(app->instance, NULL);
}

int main(int argc, char **argv)
{
    (void)argc;
    (void)argv;
    SDL_Window *window = openWindow();
    if (!window) {
        fprintf(stderr, "Could not open an SDL Vulkan window: %s\n", SDL_GetError());
        SDL_Quit();
        return 1;
    }
    VulkanApp app = { 0 };
    int success = 0;
    if (!createInstance(&app, window)) {
        fprintf(stderr, "Could not create a Vulkan instance and surface: %s\n", SDL_GetError());
    } else if (!selectGpu(&app)) {
        fprintf(stderr, "No Vulkan device can render to this window.\n");
    } else if (createDevice(&app)) {
        success = run(&app, window);
    }
    shutdown(&app);
    SDL_DestroyWindow(window);
    SDL_Quit();
    return success ? 0 : 1;
}
