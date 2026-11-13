// SPDX-License-Identifier: GPL-2.0-only OR MIT
#include <linux/fs.h>
#include <linux/init.h>
#include <linux/miscdevice.h>
#include <linux/module.h>

static const char greeting[] = "Hello from the Linux kernel!\n";

static ssize_t greeting_read(struct file *file, char __user *buffer,
			     size_t count, loff_t *position)
{
	return simple_read_from_buffer(buffer, count, position,
				       greeting, sizeof(greeting) - 1);
}

static const struct file_operations greeting_fops = {
	.owner = THIS_MODULE,
	.read = greeting_read,
};

static struct miscdevice greeting_device = {
	.minor = MISC_DYNAMIC_MINOR,
	.name = KBUILD_MODNAME,
	.fops = &greeting_fops,
	.mode = 0444,
};

static int __init greeting_init(void)
{
	return misc_register(&greeting_device);
}

static void __exit greeting_exit(void)
{
	misc_deregister(&greeting_device);
}

module_init(greeting_init);
module_exit(greeting_exit);
MODULE_LICENSE("Dual MIT/GPL");
MODULE_DESCRIPTION("Example read-only character device");
