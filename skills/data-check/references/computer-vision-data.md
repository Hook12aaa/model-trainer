# Computer Vision Data Quality Reference

## Core Principle

Verify images load, are consistent, and classes are represented.

## Checks

### Image Integrity

- PIL `verify()` + OpenCV `imread()` every image. >1% corrupt: fail. >0.5% truncated: fail.
- Flag if >2 formats present. Mixed PNG/JPEG must be intentional.
- All images must share channel count. Flag grayscale in RGB dataset or vice versa.
- Standard bit depth: uint8. Flag uint16/float unless HDR pipeline explicit.

### Resolution and Size

- Compute std(width). std(width) > 0.5 * mean(width): warn (high variance).
- Below 32x32: discard. Below 224x224: warn for pretrained backbones.
- Aspect ratio < 0.25 or > 4.0: flag extreme distortion.
- File size < 1KB: likely blank/corrupt. > 50MB: likely uncompressed/error.

### Class Distribution

- Same thresholds as classification: 4:1 monitor, 9:1 remediate, 19:1 severe.
- < 50 images per class: fail. < 100: warn for fine-tuning. < 1000: warn from scratch.
- Validate one-folder-per-class structure. Flag images in root, empty folders, nested subdirs.

### Image Quality

- Laplacian variance < 100: blurry. < 50: severely blurry. >5% blurry: warn.
- Mean pixel value < 30: too dark. > 225: too bright. >10% outside 40-215 range: flag.
- pHash distance < 5: duplicate. Cross-split duplicates: leakage fail.
- SSIM > 0.95: near-duplicate.

### Annotations (Object Detection / Segmentation)

- Bounding boxes within image bounds, non-zero area, aspect ratio < 10:1.
- >5% images with zero labels: warn (unless background class intentional).
- Validate format: COCO JSON, Pascal VOC XML, YOLO txt.

### Augmentation Readiness

- < 1000 images: augmentation mandatory. 1000-10K: recommended. > 50K: optional.
- Test set must never contain augmented images or pHash matches to augmented training images.

## Gate Functions

- BEFORE approving images: "Did I load-test every image, or am I assuming they're all valid?"
- BEFORE approving quality: "Did I compute blur scores, or am I eyeballing thumbnails?"
- BEFORE approving split: "Did I check for cross-split duplicates via perceptual hashing?"

## Rationalization Table

| Rationalization | Response |
|---|---|
| "Images look fine in the preview" | You are eyeballing. Compute Laplacian variance. |
| "A few corrupt images won't matter" | Compute the corruption rate. "A few" is not a count. |
| "Resolution is consistent enough" | Compute std/mean ratio. "Enough" is not a number. |
| "No duplicates -- the filenames are all different" | Filenames mean nothing. Compute pHash. |

## Red Flags

- "Images look good"
- "Resolution seems consistent"
- "I checked a few samples"
- Any quality claim without computed metrics

## Bottom Line

Write and execute a script that loads the quality report, asserts corruption rate < 1%, resolution std/mean < 0.5, cross-split duplicates = 0, and minimum per-class images met. Print CV CHECKS: PASS or FAIL with the specific failing check.
