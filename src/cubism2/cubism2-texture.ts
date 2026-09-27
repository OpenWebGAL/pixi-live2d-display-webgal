import { BaseImageResource, BaseTexture, GLTexture, ImageResource, Renderer, Texture } from '@pixi/core';

/**
 * A texture resource that always uploads itself Y-flipped.
 *
 * The Cubism 2 core rewrites texture coordinates to `1 - v`, so it expects the
 * pixels stored on the GPU to be vertically flipped. Applying the flip inside
 * `upload()` rather than relying on the caller to set the global
 * `UNPACK_FLIP_Y_WEBGL` flag makes it independent of upload ordering and of the
 * `prepare` plugin's deferred, cross-tick uploads.
 */
class Cubism2ImageResource extends ImageResource {
    /** @override */
    upload(renderer: Renderer, baseTexture: BaseTexture, glTexture: GLTexture): boolean {
        const gl = renderer.gl;
        const prevFlipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        try {
            return super.upload(renderer, baseTexture, glTexture);
        } finally {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, prevFlipY);
        }
    }
}

/**
 * Source BaseTexture -> its Cubism 2 counterpart, so that one image only ever
 * has one counterpart, no matter how many models use it.
 */
const cubism2Textures = new WeakMap<BaseTexture, Texture>();

/**
 * Creates the Cubism 2 counterpart of the given texture.
 *
 * The counterpart wraps the same decoded image element, so it requires neither
 * another network request nor another decode. It only occupies one more GPU
 * texture. The given texture is left untouched.
 *
 * The counterpart is intentionally not registered in the texture caches:
 * doing so would take over the cache ID of the original URL and make other
 * consumers receive the flipped version.
 *
 * @param texture - A loaded texture, usually taken from the texture cache.
 * @return The Cubism 2 counterpart, or the given texture itself when it cannot
 * be safely rebuilt (video, GIF, render texture, ...).
 */
export function createCubism2Texture(texture: Texture): Texture {
    const source = texture.baseTexture;
    const resource = source.resource;

    // only static images can be rebuilt this way
    if (!(resource instanceof BaseImageResource) || !(resource.source instanceof HTMLImageElement)) {
        return texture;
    }

    let counterpart = cubism2Textures.get(source);

    // `Texture#destroy` nulls out `baseTexture`, hence the extra check
    if (!counterpart || !counterpart.baseTexture || counterpart.baseTexture.destroyed) {
        counterpart = new Texture(new BaseTexture(
            new Cubism2ImageResource(resource.source, { autoLoad: false }),
            // mirror every option, otherwise alpha handling or scaling would differ
            // from the original. `alphaMode` in particular drives
            // `UNPACK_PREMULTIPLY_ALPHA_WEBGL`.
            {
                alphaMode: source.alphaMode,
                scaleMode: source.scaleMode,
                wrapMode: source.wrapMode,
                mipmap: source.mipmap,
                anisotropicLevel: source.anisotropicLevel,
                resolution: source.resolution,
                format: source.format,
                type: source.type,
                target: source.target,
            },
        ));

        cubism2Textures.set(source, counterpart);
    }

    return counterpart;
}
