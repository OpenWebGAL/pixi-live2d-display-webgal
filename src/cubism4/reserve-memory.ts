/**
 * Reserve memory for Live2DCubismCore.
 * 
 * MUST ONLY BE CALLED BEFORE THE INITIAL LOADING OF THE MODEL.
 * OTHERWISE, IT WILL TRIGGER EMSCRIPTEN HEAP GROWTH AND CAUSE THE FOLLOWING CRITICAL BUG.
 *
 * The core part of Cubism Web Core is written in C/C++ and compiled with Emscripten. When Emscripten 
 * triggers heap growth, it invalidates all cached TypedArray views and their derived references on the 
 * JS/TS side.  The safe practice is to regenerate the corresponding TypedArray views from the Emscripten 
 * memory pointer each time they are used  (or when heap growth is detected).
 *
 * However, Cubism Web Core and Cubism Web Framework do not implement this. The JS part of Cubism Web Core, 
 * after allocating Emscripten memory, creates and stores the corresponding TypedArray views but discards the 
 * Emscripten pointer and the memory block length information. Cubism Web Framework further references these 
 * TypedArrays and relies entirely on them for operation. Neither implements any view reconstruction behavior.
 *
 * The consequence is that after Emscripten heap growth is triggered, the JS/TS part of the Cubism Web SDK will
 * be unable to access  Live2D objects created before the growth. The corresponding objects will be stuck on the 
 * stage and will no longer trigger any updates.
 *
 * THIS IS A KNOWN CRITICAL BUG CAUSED BY THE FAULTY IMPLEMENTATION OF THE CUBISM WEB SDK. 
 * The Live2D Inc. has no plan to fix it. 
 * The official solution only provides a `Memory.initializeAmountOfMemory(size)` function to pre-allocate Emscripten
 * heap memory in advance, avoiding heap growth during use, AS A WORKAROUND.
 *
 * Due to potential incompleteness and uncertainty in wasm/asm.js Emscripten heap growth event listening and global 
 * TypedArray view reconstruction at the third-party upper level, we only provide this function as a workaround solution, 
 * which is a wrapper around `Memory.initializeAmountOfMemory`.
 *
 * @param size - The amount of Emscripten heap memory to pre-allocate, in bytes. Values less than 16777216 (16MB) will be ignored.
 */
export function reserveCoreMemory(size: number) {
    if ((typeof (Live2DCubismCore as any).Memory?.initializeAmountOfMemory) === 'function') {
        try {
            (Live2DCubismCore as any).Memory.initializeAmountOfMemory(size)
        }
        catch (error) {
            console.error('Failed to reserve memory for cubism core:', error)
        }
    } else {
        console.warn('Loaded Live2DCubismCore do not support memory reservation.')
    }
}