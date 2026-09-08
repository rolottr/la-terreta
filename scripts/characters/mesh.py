"""Small Blender mesh tools. Coordinates use game axes: X right, Y up, Z front."""
import bpy
import math
from mathutils import Vector


def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def rgb(value):
    if isinstance(value, str):
        return tuple(linear(int(value[k:k + 2], 16) / 255) for k in (1, 3, 5))
    return value


def tint(color, factor):
    return tuple(min(1, c * factor) for c in rgb(color))


class Mesh:
    def __init__(self):
        self.vertices, self.faces, self.colors = [], [], []

    def poly(self, vertices, faces, color):
        start = len(self.vertices)
        self.vertices.extend(vertices)
        self.faces.extend(tuple(start + i for i in face) for face in faces)
        self.colors.extend([rgb(color)] * len(vertices))

    def rings(self, rings, color, sides=24, caps=True, folds=0):
        # Each section is (height, half width, half depth, X center, Z center).
        vertices, faces = [], []
        for k, (y, rx, rz, x, z) in enumerate(rings):
            for j in range(sides):
                a = j * math.tau / sides
                f = 1 + folds * math.sin(a * 6 + k * 1.9)
                vertices.append((x + rx * math.sin(a) * f, y, z + rz * math.cos(a) * f))
        for k in range(len(rings) - 1):
            for j in range(sides):
                a = k * sides + j
                b = k * sides + (j + 1) % sides
                faces.append((a, b, b + sides, a + sides))
        if caps:
            faces.append(tuple(reversed(range(sides))))
            faces.append(tuple((len(rings) - 1) * sides + j for j in range(sides)))
        self.poly(vertices, faces, color)

    def ellipsoid(self, center, radii, color, sides=20, rows=12):
        x, y, z = center
        rx, ry, rz = radii
        rings = []
        for k in range(rows + 1):
            a = math.pi * k / rows
            r = max(.0001, math.sin(a))
            rings.append((y - ry * math.cos(a), rx * r, rz * r, x, z))
        self.rings(rings, color, sides)

    def tube(self, points, radius, color, sides=8):
        vertices, faces = [], []
        pts = [Vector(p) for p in points]
        radii = radius if isinstance(radius, list) else [radius] * len(pts)
        for k, p in enumerate(pts):
            direction = (pts[min(k + 1, len(pts) - 1)] - pts[max(0, k - 1)]).normalized()
            axis = Vector((0, 1, 0)) if abs(direction.y) < .9 else Vector((0, 0, 1))
            u = direction.cross(axis).normalized()
            v = direction.cross(u).normalized()
            for j in range(sides):
                a = j * math.tau / sides
                vertices.append(tuple(p + radii[k] * (u * math.cos(a) + v * math.sin(a))))
        for k in range(len(pts) - 1):
            for j in range(sides):
                a = k * sides + j
                b = k * sides + (j + 1) % sides
                faces.append((a, b, b + sides, a + sides))
        faces.append(tuple(reversed(range(sides))))
        faces.append(tuple((len(pts) - 1) * sides + j for j in range(sides)))
        self.poly(vertices, faces, color)

    def ribbon(self, points, width, color, axis=(1, 0, 0), thickness=.003):
        # A closed strap with a real edge, not a single-sided plane.
        side = Vector(axis) * width / 2
        vertices = []
        for p in points:
            p = Vector(p)
            for depth in (0, -thickness):
                for sign in (-1, 1):
                    vertices.append(tuple(p + side * sign + Vector((0, 0, depth))))
        faces = []
        for k in range(len(points) - 1):
            a, b = 4 * k, 4 * (k + 1)
            faces.extend([(a, b, b+1, a+1), (a+2, a+3, b+3, b+2),
                          (a, a+2, b+2, b), (a+1, b+1, b+3, a+3)])
        faces.extend([(0, 1, 3, 2), tuple(4*(len(points)-1)+j for j in (0,2,3,1))])
        self.poly(vertices, faces, color)

    def finish(self, name, parent, pivot=(0, 0, 0), material=None):
        origin = Vector(pivot)
        verts = [Vector(v) - origin for v in self.vertices]
        mesh = bpy.data.meshes.new(name)
        # This is a rotation, so it preserves winding and handedness.
        mesh.from_pydata([(v.x, -v.z, v.y) for v in verts], [], self.faces)
        mesh.update()
        colors = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
        for attribute, color in zip(colors.data, self.colors):
            attribute.color = (*color, 1)
        for face in mesh.polygons:
            face.use_smooth = len(face.vertices) <= 4
        # Each polygon stays inside one padded material tile. Projection follows
        # its dominant normal, so sides and fronts both retain a fine weave.
        from materials import category
        uv = mesh.uv_layers.new(name='Material atlas')
        for polygon in mesh.polygons:
            axis = max(range(3), key=lambda i: abs(polygon.normal[i]))
            axes = [i for i in range(3) if i != axis]
            for li in polygon.loop_indices:
                vi = mesh.loops[li].vertex_index
                coord = mesh.vertices[vi].co
                tile = category(self.colors[vi])
                a, b = [(coord[i] * 12) % 1 for i in axes]
                uv.data[li].uv = ((tile + .02 + a * .96) / 4, .02 + b * .96)
        mesh.materials.append(material)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent = parent
        obj.location = (origin.x, -origin.z, origin.y)
        if getattr(self,'blink_indices',None):
            obj.vertex_groups.new(name='__blink').add(self.blink_indices,1,'REPLACE')
        return obj
