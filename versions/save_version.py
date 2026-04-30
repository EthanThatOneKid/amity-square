import json, time
from PIL import Image
import numpy as np

with open('/home/.z/chat-uploads/amity-square-walk-mask-66609b7265c8.json') as f:
    data = json.load(f)

w, h = data["dimensions"]["w"], data["dimensions"]["h"]
mask_flat = data["mask"]
ts = int(time.time())
version_id = f"v_{ts}"

# 1. Write versioned mask PNG (green=walkable, red=blocked)
rgb = np.zeros((h, w, 3), dtype=np.uint8)
for i, v in enumerate(mask_flat):
    x = i % w
    y = i // w
    rgb[y, x] = [0, 255, 0] if v == 255 else [255, 0, 0]

img = Image.fromarray(rgb, "RGB")
img.save(f"/home/workspace/amity-square/versions/{version_id}-mask.png")
print(f"Saved {version_id}-mask.png ({w}x{h})")

# 2. Write versioned objects JSON
blocked_tiles = []
for i, v in enumerate(mask_flat):
    if v == 0:
        blocked_tiles.append({"tx": (i % w) // 16, "ty": (i // w) // 16})

objects = {
    "version": version_id,
    "created_at": ts,
    "type": "amity-square-mask-v1",
    "dimensions": {"w": w, "h": h, "tile": 16, "gridCols": 63, "gridRows": 49},
    "mask": mask_flat,
    "blocked_tiles": blocked_tiles
}

with open(f"/home/workspace/amity-square/versions/{version_id}-objects.json", "w") as f:
    json.dump(objects, f)
print(f"Saved {version_id}-objects.json ({len(blocked_tiles)} blocked tiles)")

# 3. Write current (symlink-equivalent) files the game reads
img.save("/home/workspace/amity-square/amity-square-walk-mask.png")
with open("/home/workspace/amity-square/amity-square-objects.json", "w") as f:
    json.dump(objects, f)
print("Wrote current amity-square-walk-mask.png + amity-square-objects.json")

# 4. Write versions index
index = {"versions": [{"id": version_id, "created_at": ts, "mask_file": f"{version_id}-mask.png", "objects_file": f"{version_id}-objects.json"}]}
with open("/home/workspace/amity-square/versions/index.json", "w") as f:
    json.dump(index, f, indent=2)
print(f"Wrote versions/index.json")