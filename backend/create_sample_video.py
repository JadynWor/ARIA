import cv2
import os

image_dir = "../data/heridal/test/images"
output = r"C:\Users\Owner\ARIA\backend\data\sample.mp4"

# Make sure output directory exists
os.makedirs(os.path.dirname(output), exist_ok=True)

images = sorted(os.listdir(image_dir))
frame = cv2.imread(os.path.join(image_dir, images[0]))
h, w = frame.shape[:2]

# Use XVID codec — more reliable on Windows
writer = cv2.VideoWriter(output, cv2.VideoWriter_fourcc(*'XVID'), 5, (w, h))

if not writer.isOpened():
    print("VideoWriter failed to open!")
else:
    for img_name in images:
        frame = cv2.imread(os.path.join(image_dir, img_name))
        if frame is not None:
            writer.write(frame)
    writer.release()
    print(f"Created {output} with {len(images)} frames")