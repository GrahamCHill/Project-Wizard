#include <stdio.h>
#include <string.h>
#include <yyjson.h>

int main(void)
{
    const char *text = "{\"message\":\"Hello from yyjson\"}";
    yyjson_doc *document = yyjson_read(text, strlen(text), 0);
    if (!document) return 1;

    yyjson_val *value = yyjson_obj_get(yyjson_doc_get_root(document), "message");
    const char *message = yyjson_get_str(value);
    if (message) puts(message);
    int result = message ? 0 : 1;
    yyjson_doc_free(document);
    return result;
}
