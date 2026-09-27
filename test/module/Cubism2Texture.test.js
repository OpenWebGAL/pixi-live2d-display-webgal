import { Live2DModel } from '@';
import { Cubism2InternalModel, createCubism2Texture } from '@/cubism2';
import { MotionPreloadStrategy } from '@/cubism-common';
import { Application } from '@pixi/app';
import { BaseTexture, ImageResource, Texture } from '@pixi/core';
import { Sprite } from '@pixi/sprite';
import sinon from 'sinon';
import { TEST_MODEL, TEST_MODEL4 } from '../env';
import { createApp } from '../utils';

describe('Cubism2Texture', function() {
    const options = { autoUpdate: false, motionPreload: MotionPreloadStrategy.NONE };

    // the textures are rendered 1:1, so that nothing can blur the pixels
    const SIZE = 8;

    let app;

    before(function() {
        app = createApp(Application, false);
    });

    after(function() {
        app.destroy(true, { children: true });
    });

    /** An image with a red top half and a blue bottom half, so that a vertical flip is observable. */
    function createAsymmetricTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;

        const context = canvas.getContext('2d');
        context.fillStyle = '#ff0000';
        context.fillRect(0, 0, SIZE, SIZE / 2);
        context.fillStyle = '#0000ff';
        context.fillRect(0, SIZE / 2, SIZE, SIZE / 2);

        return new Promise((resolve, reject) => {
            const image = new Image();

            image.onload = () => resolve(new Texture(new BaseTexture(new ImageResource(image))));
            image.onerror = reject;

            image.src = canvas.toDataURL();
        });
    }

    /**
     * Draws the texture at the top-left corner and reads back the rendered
     * pixels. Reading directly from the framebuffer, because a WebGL canvas may
     * have already lost its drawing buffer by the time it's drawn to a 2D canvas.
     */
    function renderAndReadPixels(texture) {
        const sprite = new Sprite(texture);

        app.stage.addChild(sprite);
        app.render();

        const gl = app.renderer.gl;
        const pixels = new Uint8Array(SIZE * SIZE * 4);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // the framebuffer origin is at the bottom-left, while the sprite is
        // drawn at the top-left
        gl.readPixels(0, app.renderer.height - SIZE, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        app.stage.removeChildren();

        return Array.from(pixels);
    }

    /** Reverses the row order, which is what a vertical flip looks like in a pixel buffer. */
    function flipVertically(pixels, width, height) {
        const flipped = [];

        for (let y = height - 1; y >= 0; y--) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                flipped.push(pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]);
            }
        }

        return flipped;
    }

    function resolveTextures(model) {
        const settings = model.internalModel.settings;

        return settings.textures.map(texture => Texture.from(settings.resolveURL(texture)));
    }

    describe('createCubism2Texture', function() {
        it('should reuse the same image without touching the given texture', async function() {
            const original = await createAsymmetricTexture();
            const counterpart = createCubism2Texture(original);

            expect(counterpart).to.be.instanceOf(Texture);
            expect(counterpart).to.not.equal(original);
            expect(counterpart.baseTexture).to.not.equal(original.baseTexture);
            expect(counterpart.baseTexture.resource.source).to.equal(original.baseTexture.resource.source);
        });

        it('should be valid synchronously', async function() {
            const counterpart = createCubism2Texture(await createAsymmetricTexture());

            // `Live2DModel#_render` skips invalid textures
            expect(counterpart.valid).to.be.true;
            expect(counterpart.width).to.equal(SIZE);
            expect(counterpart.height).to.equal(SIZE);
        });

        it('should mirror the options of the given texture', async function() {
            const original = await createAsymmetricTexture();
            const counterpart = createCubism2Texture(original);

            for (const key of ['alphaMode', 'scaleMode', 'wrapMode', 'mipmap', 'anisotropicLevel', 'resolution']) {
                expect(counterpart.baseTexture[key], key).to.equal(original.baseTexture[key]);
            }
        });

        it('should not register itself in the texture caches', async function() {
            const original = await createAsymmetricTexture();
            const counterpart = createCubism2Texture(original);

            // the counterpart must not take over the cache ID of the original
            expect(counterpart.baseTexture.textureCacheIds).to.be.empty;
            expect(counterpart.baseTexture.cacheId).to.be.null;
        });

        it('should return the same counterpart for the same source', async function() {
            const original = await createAsymmetricTexture();

            expect(createCubism2Texture(original)).to.equal(createCubism2Texture(original));
        });

        it('should rebuild the counterpart after it has been destroyed', async function() {
            const original = await createAsymmetricTexture();
            const counterpart = createCubism2Texture(original);

            counterpart.destroy(true);

            const rebuilt = createCubism2Texture(original);

            expect(rebuilt).to.not.equal(counterpart);
            expect(rebuilt.valid).to.be.true;
        });

        it('should return non-image sources as is', function() {
            const buffer = Texture.fromBuffer(new Uint8Array(4), 1, 1);

            expect(createCubism2Texture(buffer)).to.equal(buffer);
        });

        it('should upload the counterpart vertically flipped', async function() {
            const original = await createAsymmetricTexture();
            const counterpart = createCubism2Texture(original);

            const originalPixels = renderAndReadPixels(original);
            const counterpartPixels = renderAndReadPixels(counterpart);

            expect(counterpartPixels).to.eql(flipVertically(originalPixels, SIZE, SIZE));
        });

        it('should upload the counterpart flipped even when the source was uploaded first', async function() {
            const original = await createAsymmetricTexture();

            // simulate a preload, or any other consumer, that puts the source
            // texture on the GPU before the model gets to bind it
            app.renderer.texture.bind(original.baseTexture, 0);

            const counterpart = createCubism2Texture(original);

            // unbinding the flip is irreversible, so the counterpart must hold a
            // GPU texture of its own to stay correct regardless of the ordering
            const counterpartPixels = renderAndReadPixels(counterpart);

            expect(counterpartPixels).to.eql(flipVertically(renderAndReadPixels(original), SIZE, SIZE));
        });

        it('should not leak UNPACK_FLIP_Y_WEBGL', async function() {
            const counterpart = createCubism2Texture(await createAsymmetricTexture());
            const gl = app.renderer.gl;

            const flipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
            const spy = sinon.spy(gl, 'pixelStorei');

            try {
                app.renderer.texture.bind(counterpart.baseTexture, 0);

                expect(spy).to.be.calledWith(gl.UNPACK_FLIP_Y_WEBGL, true);
                expect(gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL)).to.equal(flipY);
            } finally {
                spy.restore();
            }
        });

        it('should not upload the given texture to the GPU', async function() {
            const original = await createAsymmetricTexture();
            const counterpart = createCubism2Texture(original);

            app.renderer.texture.bind(counterpart.baseTexture, 0);

            expect(counterpart.baseTexture._glTextures[app.renderer.CONTEXT_UID]).to.be.ok;
            expect(original.baseTexture._glTextures[app.renderer.CONTEXT_UID]).to.be.undefined;
        });
    });

    describe('integration', function() {
        it('should give Cubism 2 models counterparts of the cached textures', async function() {
            const model = await Live2DModel.from(TEST_MODEL.file, options);

            try {
                expect(model.internalModel).to.be.instanceOf(Cubism2InternalModel);
                expect(model.textures.length).to.be.greaterThan(0);

                model.textures.forEach((texture, i) => {
                    const cached = resolveTextures(model)[i];

                    expect(texture).to.not.equal(cached);
                    expect(texture.baseTexture).to.not.equal(cached.baseTexture);
                    expect(texture.baseTexture.resource.source).to.equal(cached.baseTexture.resource.source);
                });
            } finally {
                model.destroy();
            }
        });

        it('should leave Cubism 4 models untouched', async function() {
            const model = await Live2DModel.from(TEST_MODEL4.file, options);

            try {
                expect(model.textures.length).to.be.greaterThan(0);

                model.textures.forEach((texture, i) => {
                    expect(texture).to.equal(resolveTextures(model)[i]);
                });
            } finally {
                model.destroy();
            }
        });

        it('should keep textureFlipY for the sources that cannot be rebuilt', async function() {
            const model = await Live2DModel.from(TEST_MODEL.file, options);

            try {
                expect(model.internalModel.textureFlipY).to.be.true;
            } finally {
                model.destroy();
            }
        });

        it('should adapt the textures through the InternalModel hook', async function() {
            const original = Cubism2InternalModel.prototype.transformTexture;

            Cubism2InternalModel.prototype.transformTexture = function(texture) {
                return texture;
            };

            try {
                const model = await Live2DModel.from(TEST_MODEL.file, options);

                try {
                    model.textures.forEach((texture, i) => {
                        expect(texture).to.equal(resolveTextures(model)[i]);
                    });
                } finally {
                    model.destroy();
                }
            } finally {
                Cubism2InternalModel.prototype.transformTexture = original;
            }
        });
    });
});
