export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous') // needed to avoid cross-origin issues on CodeSandbox
    image.src = url
  })

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<File | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  // set canvas size to match the bounding box
  canvas.width = image.width
  canvas.height = image.height

  // translate canvas context to a central location to allow rotating and flipping around the center
  ctx.translate(image.width / 2, image.height / 2)
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)

  // draw rotated image
  ctx.drawImage(image, 0, 0)

  // extract the cropped image data from the canvas
  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  )

  // Create a canvas to hold the cropped image and resize it
  const MAX_SIZE = 400;
  let finalWidth = pixelCrop.width;
  let finalHeight = pixelCrop.height;

  if (finalWidth > MAX_SIZE || finalHeight > MAX_SIZE) {
      if (finalWidth > finalHeight) {
          finalHeight = Math.round((finalHeight * MAX_SIZE) / finalWidth);
          finalWidth = MAX_SIZE;
      } else {
          finalWidth = Math.round((finalWidth * MAX_SIZE) / finalHeight);
          finalHeight = MAX_SIZE;
      }
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = finalWidth;
  finalCanvas.height = finalHeight;
  const finalCtx = finalCanvas.getContext('2d');

  if(!finalCtx) return null;

  // We need an intermediate canvas to draw the cropped ImageData, so we can scale it with drawImage
  const intermediateCanvas = document.createElement('canvas');
  intermediateCanvas.width = pixelCrop.width;
  intermediateCanvas.height = pixelCrop.height;
  const intermediateCtx = intermediateCanvas.getContext('2d');
  intermediateCtx?.putImageData(data, 0, 0);

  finalCtx.drawImage(intermediateCanvas, 0, 0, finalWidth, finalHeight);

  // As a blob
  return new Promise((resolve, reject) => {
    finalCanvas.toBlob((blob) => {
        if (blob) {
            resolve(new File([blob], `profile_${Date.now()}.jpeg`, { type: 'image/jpeg' }))
        } else {
            reject(new Error('Canvas is empty'));
        }
    }, 'image/jpeg', 0.85)
  })
}
