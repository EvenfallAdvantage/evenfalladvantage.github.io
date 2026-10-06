# assets-src (not deployed)

Full-resolution source photos. `.github/workflows/deploy.yml` copies only the
listed site folders (`images/`, `audio/`, ...) into the Pages artifact, so
nothing here is served.

The site uses:
- `images/<name>.jpg`: web JPEG (max 1600 px wide, q80, progressive) at the
  original URL, so old links and fallbacks keep working.
- `images/responsive/<name>-{480,800,1200,1600}.{avif,webp}`: used through
  `<picture srcset>` (index.html) and CSS `image-set()` (blog.html,
  case-studies/*.html).

To regenerate after replacing a photo here, see the commands in the
`perf/media-diet` PR (ImageMagick resize, `cwebp -q 72 -m 6`,
`avifenc -q 50 -s 4`).
