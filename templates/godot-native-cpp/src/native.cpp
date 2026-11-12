#include <godot_cpp/classes/ref_counted.hpp>
#include <godot_cpp/core/class_db.hpp>
#include <godot_cpp/godot.hpp>
#include "starter.h"

namespace godot {
class NativeGreeting : public RefCounted {
    GDCLASS(NativeGreeting, RefCounted)

protected:
    static void _bind_methods()
    {
        ClassDB::bind_method(D_METHOD("message"), &NativeGreeting::message);
    }

public:
    String message() const
    {
        return String("C++ GDExtension: 2 + 3 = ") + String::num_int64(starter_add(2, 3));
    }
};

void initialize_native(ModuleInitializationLevel level)
{
    if (level == MODULE_INITIALIZATION_LEVEL_SCENE)
        GDREGISTER_CLASS(NativeGreeting);
}

void uninitialize_native(ModuleInitializationLevel) {}
} // namespace godot

extern "C" GDExtensionBool GDE_EXPORT pw_native_init(
    GDExtensionInterfaceGetProcAddress get_proc_address,
    GDExtensionClassLibraryPtr library, GDExtensionInitialization* initialization)
{
    godot::GDExtensionBinding::InitObject bindings(get_proc_address, library, initialization);
    bindings.register_initializer(godot::initialize_native);
    bindings.register_terminator(godot::uninitialize_native);
    bindings.set_minimum_library_initialization_level(godot::MODULE_INITIALIZATION_LEVEL_SCENE);
    return bindings.init();
}
