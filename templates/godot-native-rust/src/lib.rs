use godot::prelude::*;

struct NativeExtension;

#[gdextension]
unsafe impl ExtensionLibrary for NativeExtension {}

#[derive(GodotClass)]
#[class(base=RefCounted, init)]
struct NativeGreeting {
    base: Base<RefCounted>,
}

#[godot_api]
impl NativeGreeting {
    #[func]
    fn message(&self) -> GString {
        "Rust GDExtension: hello from the native library".into()
    }
}
