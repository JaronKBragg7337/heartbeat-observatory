# Measured anatomy and scene assets

Codex conversion, 2026-09-12. No generated fly geometry.

- **Fly**: [TuragaLab/flybody](https://github.com/TuragaLab/flybody), commit `d015e9bfe441bd90ae431bac24c55cb74bdbce26`, Apache-2.0 (see FLYBODY-LICENSE.txt). 85 OBJ parts; all 67 XML body nodes and 102 hinge definitions retained. Converted by tools/build_fly.py using Blender 5.1.2. Original mesh scale 0.1; source CGS lengths converted to metres by 0.01 at root. The source uses CGS in flybody/tasks/base.py and gravity 981 cm/s squared in fruitfly.xml. Welded coincident vertices and decimated larger parts; source and output counts are in fly.build.json. No source meshes edited.
- **Joint contract**: each body's extras.jointsJson preserves ordered joint name, axis (glTF Y-up), and range. Rest body/geom translations and normalized quaternions are from XML. All source hinge pivots are at body origins, asserted during conversion. Animation multiplies rest quaternion by ordered axis rotations and clamps to source ranges. Wings roll upward above +20; forelegs groom below -15; fresh PRESS taps the left foreleg. This is an illustrative pose mapping, not a MuJoCo physics simulation or measured motor reconstruction. The exported fly retains anatomical scale; the scene explicitly magnifies it 160 times.
- **Wood texture set**: [ambientCG Wood051](https://ambientcg.com/view?id=Wood051), [CC0 licence](https://docs.ambientcg.com/license/). Downloaded Wood051_1K-JPG.zip from ambientCG on 2026-09-12. Colour, OpenGL normal and roughness resized to 512 px JPEG. Wood on tabletop substrate and paddle; roughness variation under blue tabletop paint. CC0 imposes no attribution requirement; origin is retained for audit.
- **Table**: regulation envelope from SCENE-BRIEF: 2.74 x 1.525 m, playing surface 0.76 m above floor, net 0.1525 m above playing surface. Two 25 mm boards, 20 mm perimeter lines, 3 mm doubles line. Undercarriage, hardware, net weave spacing, floor and paddle dimensions are illustrative construction, not a measured manufacturer's model. Paddle blade 150 x 160 mm, 100 mm handle. Geometry is assembled from separately named components, not a supplied scan.
- **Debug**: Asset IDs toggles an overview with metre coordinates and a selector for every component, including all fly body nodes and mesh parts. Selection is inspection only. No grid or player controls. Orbit changes the camera only.
- **Atlas**: measured MaleCNS soma positions, separate from flybody anatomy and deliberately enlarged. No claim of anatomical registration between the two sources.

Rebuild from the pinned source:

    blender -b -P tools/build_fly.py -- PATH_TO_flybody/fruitfly/assets OUTPUT/fly.glb

Table, net and fly source scale are independently testable; display enlargement is applied only to the fly holder. Flybody keeps its Apache licence; the surrounding project licence does not replace it.
