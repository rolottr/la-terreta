"""Curl fingers continuously, preserving their thickness and attached nails."""
import math


def add_relaxed_hands(mesh):
    if not mesh.data.shape_keys:
        mesh.shape_key_add(name='Basis')
    key = mesh.data.shape_keys.key_blocks.get('RelaxedHands') or mesh.shape_key_add(name='RelaxedHands')
    key.value = 0
    for vertex, out in zip(mesh.data.vertices, key.data):
        out.co = vertex.co
        x, back, height = vertex.co
        # All finger and nail vertices use the same smooth deformation. The
        # bend starts with zero displacement and slope at the palm boundary.
        if not (.25 < abs(x) < .35 and .62 < height < .708):
            continue
        forward = -back
        if not (-.005 < forward < .072):
            continue
        length = .708-height
        radius = .105
        angle = length/radius
        depth = forward-.034
        out.co.z = .708-(radius+depth)*math.sin(angle)
        out.co.y = -(.034-radius*(1-math.cos(angle))+depth*math.cos(angle))
