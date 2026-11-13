// SPDX-License-Identifier: GPL-2.0-only OR MIT
#define pr_fmt(fmt) KBUILD_MODNAME ": " fmt

#include <linux/init.h>
#include <linux/module.h>
#include <linux/printk.h>

static int __init hello_init(void)
{
	pr_info("loaded\n");
	return 0;
}

static void __exit hello_exit(void)
{
	pr_info("unloaded\n");
}

module_init(hello_init);
module_exit(hello_exit);
MODULE_LICENSE("Dual MIT/GPL");
MODULE_DESCRIPTION("Example loadable kernel module");
