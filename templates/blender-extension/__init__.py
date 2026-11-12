from math import tau

import bpy


class PW_OT_add_turntable(bpy.types.Operator):
    """Add an empty that rotates once over the current timeline."""

    bl_idname = "object.pw_add_turntable"
    bl_label = "Add Animated Turntable"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        scene = context.scene
        turntable = bpy.data.objects.new("Turntable", None)
        context.collection.objects.link(turntable)
        turntable.keyframe_insert(data_path="rotation_euler", index=2, frame=scene.frame_start)
        turntable.rotation_euler.z = tau
        turntable.keyframe_insert(data_path="rotation_euler", index=2, frame=scene.frame_end)
        scene.frame_set(scene.frame_current)
        return {"FINISHED"}


def draw_menu(self, context):
    self.layout.operator(PW_OT_add_turntable.bl_idname)


def register():
    bpy.utils.register_class(PW_OT_add_turntable)
    bpy.types.VIEW3D_MT_add.append(draw_menu)


def unregister():
    bpy.types.VIEW3D_MT_add.remove(draw_menu)
    bpy.utils.unregister_class(PW_OT_add_turntable)
