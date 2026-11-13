# __PROJECT_NAME__

A Linux kernel module that logs when it loads and unloads.

Build from a project path without spaces using GNU Make, a kernel-compatible compiler, and the build headers for `uname -r`. For a different prepared kernel tree, use `make KDIR=/path/to/kernel/build`. The kernel must support loadable modules. See the [Linux kbuild guide](https://docs.kernel.org/kbuild/modules.html).

~~~sh
make
~~~

In a Linux VM running the kernel you built for, load the module, unload it, and confirm the log shows both events. If the kernel enforces module signatures, sign the module with a key the VM trusts before loading it.

~~~sh
sudo insmod ./pw_hello.ko
sudo rmmod pw_hello
sudo dmesg | grep 'pw_hello:' | tail -n 2
~~~

Run `make clean` to remove build outputs.
