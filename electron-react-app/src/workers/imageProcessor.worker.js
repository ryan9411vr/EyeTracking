// src/workers/imageProcessor.worker.js

/**
 * Worker for processing JPEG image buffers.
 *
 * This worker receives a JPEG buffer from the main thread, converts it into an image,
 * draws the image onto an OffscreenCanvas, and then converts the canvas back into a JPEG
 * blob and finally into a data URL. The resulting data URL is sent back to the main thread.
 *
 * The use of OffscreenCanvas enables image processing off the main thread,
 * thereby preventing UI blocking in the application.
 */
self.onmessage = async (event) => {
  try {
    // Extract the JPEG buffer from the incoming message.
    const { jpegBuffer, ctxFilter } = event.data;

    // Create a Blob from the JPEG buffer specifying the MIME type.
    const blob = new Blob([jpegBuffer], { type: 'image/jpeg' });
    
    // Convert the Blob into an ImageBitmap for efficient rendering.
    const imageBitmap = await createImageBitmap(blob);
    
    // Create an OffscreenCanvas matching the dimensions of the image.
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    
    // Get the 2D drawing context from the canvas.
    const ctx = canvas.getContext('2d');
    ctx.filter = ctxFilter;
    
    // Draw the image onto the canvas starting at the top-left corner.
    ctx.drawImage(imageBitmap, 0, 0);
    
    // Convert the canvas content back into a JPEG Blob.
    const outputBlob = await canvas.convertToBlob({ type: 'image/jpeg' });
    
    // Convert the Blob into a Data URL using FileReader.
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(outputBlob);
    });
    
    // Send the resulting data URL back to the main thread.
    self.postMessage({ dataUrl });
  } catch (error) {
    // If an error occurs during processing, send an error message back.
    self.postMessage({ error: error.message || String(error) });
  }
};
