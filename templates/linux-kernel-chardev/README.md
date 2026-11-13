# __PROJECT_NAME__

A Linux kernel module that registers a read-only character device with a dynamically allocated minor number. A read from `/dev/pw_greeting` returns a greeting and then reaches end of file. The module removes the device when it unloads.

Build from a project path without spaces using GNU Make, a kernel-compatible compiler, and the build headers for `uname -r`. For a different prepared kernel tree, use `make KDIR=/path/to/kernel/build`. The kernel must support loadable modules. See the [Linux kbuild guide](https://docs.kernel.org/kbuild/modules.html).

~~~sh
make
~~~

In a Linux VM running the kernel you built for, run the sample below. The `cat` command should print `Hello from the Linux kernel!`. If the kernel enforces module signatures, sign the module with a key the VM trusts before loading it.

~~~sh
sudo insmod ./pw_greeting.ko
cat /dev/pw_greeting
sudo rmmod pw_greeting
~~~

Run `make clean` to remove build outputs.
