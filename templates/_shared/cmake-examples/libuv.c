#include <stdio.h>
#include <uv.h>

int main(void)
{
    uv_loop_t loop;
    uv_tcp_t tcp;
    uv_udp_t udp;
    struct sockaddr_in loopback;
    if (uv_loop_init(&loop) < 0 ||
        uv_ip4_addr("127.0.0.1", 0, &loopback) < 0 ||
        uv_tcp_init(&loop, &tcp) < 0 ||
        uv_tcp_bind(&tcp, (const struct sockaddr *)&loopback, 0) < 0 ||
        uv_udp_init(&loop, &udp) < 0 ||
        uv_udp_bind(&udp, (const struct sockaddr *)&loopback, 0) < 0) {
        fputs("libuv could not bind the loopback sockets.\n", stderr);
        return 1;
    }

    uv_close((uv_handle_t *)&tcp, NULL);
    uv_close((uv_handle_t *)&udp, NULL);
    uv_run(&loop, UV_RUN_DEFAULT);
    if (uv_loop_close(&loop) < 0) return 1;

    printf("libuv %s bound both TCP and UDP loopback sockets.\n", uv_version_string());
    return 0;
}
