#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <tinyfiledialogs.h>

int main(int argc, char **argv)
{
    printf("tinyfiledialogs %s\n", tinyfd_version);
    if (argc > 1 && strcmp(argv[1], "--dialog") == 0) {
        tinyfd_messageBox("Project Wizard", "tinyfiledialogs is working.", "ok", "info", 1);
    }
    return 0;
}
