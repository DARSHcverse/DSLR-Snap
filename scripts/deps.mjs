// The files the app ships but git doesn't hold. Each has a pinned checksum, our own copy on
// downloads.dslrsnap.com (Cloudflare R2, kept by scripts/mirror-deps.mjs) and the original source.
export const MIRROR = 'https://downloads.dslrsnap.com/deps'

export const DEPS = {
  // MODNet portrait matting (Apache-2.0). The upstream URL points at "main", so it can change.
  modnet: {
    name: 'modnet.onnx',
    sha256: '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9',
    upstream: 'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx'
  },
  // ffmpeg for Windows, BtbN's LGPL shared build (uses Windows' own H.264 encoder). BtbN deletes old
  // autobuilds, so our mirror is the copy that lasts. LGPL: the zip includes the licence; the source
  // for this exact build is FFmpeg n8.1.3-24-g92611900bb (github.com/FFmpeg/FFmpeg).
  ffmpeg: {
    name: 'ffmpeg-n8.1.3-24-g92611900bb-win64-lgpl-shared-8.1.zip',
    sha256: '96afe9bee66012f4cbc336a473f0b595060d73bdc5efe4331d55101500d0a93e',
    upstream: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-10-26-14-25/ffmpeg-n8.1.3-24-g92611900bb-win64-lgpl-shared-8.1.zip'
  }
}

/** Our copy first, then the original. */
export const sources = (dep) => [`${MIRROR}/${dep.name}`, dep.upstream]
