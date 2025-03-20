declare module 'cropperjs' {
    export = Cropper;
    class Cropper {
      constructor(element: HTMLElement, options?: any);
      destroy(): void;
      getCroppedCanvas(): HTMLCanvasElement | null;
      // Add other methods and properties as needed
    }
  }
  