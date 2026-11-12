#include <asio.hpp>
#include <iostream>

int main()
{
    asio::io_context io;
    const auto loopback = asio::ip::address_v4::loopback();
    asio::ip::tcp::acceptor tcp(io, {loopback, 0});
    asio::ip::udp::socket udp(io, {loopback, 0});
    std::cout << "Asio TCP port " << tcp.local_endpoint().port()
              << ", UDP port " << udp.local_endpoint().port() << '\n';
}
