#include <stdio.h>

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include <stb_image_write.h>

static void count_bytes(void *context, void *data, int size)
{
    (void)data;
    *(int *)context += size;
}

int main(void)
{
    const unsigned char pixels[] = {255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255};
    int bytes = 0;
    if (!stbi_write_png_to_func(count_bytes, &bytes, 2, 2, 3, pixels, 6)) return 1;
    printf("stb encoded a 2 x 2 PNG (%d bytes).\n", bytes);
    return bytes > 0 ? 0 : 1;
}
