/**
 * Vitest setup — mock browser APIs not available in jsdom.
 */

// ResizeObserver is needed by D3 chart components
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Sigma.js requires WebGL rendering context globals at import time
if (typeof globalThis.WebGLRenderingContext === 'undefined') {
  globalThis.WebGLRenderingContext = class WebGLRenderingContext {}
}
if (typeof globalThis.WebGL2RenderingContext === 'undefined') {
  globalThis.WebGL2RenderingContext = {
    BOOL: 0x8B56,
    BYTE: 0x1400,
    UNSIGNED_BYTE: 0x1401,
    SHORT: 0x1402,
    UNSIGNED_SHORT: 0x1403,
    INT: 0x1404,
    UNSIGNED_INT: 0x1405,
    FLOAT: 0x1406,
  }
}

// Mock canvas getContext for WebGL
const originalGetContext = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = function (type, ...args) {
  if (type === 'webgl2' || type === 'webgl') {
    return {
      canvas: this,
      drawingBufferWidth: this.width,
      drawingBufferHeight: this.height,
      getExtension: () => null,
      getParameter: (p) => {
        if (p === 0x1F02) return 'Mock WebGL'
        return 0
      },
      createShader: () => ({}),
      shaderSource: () => {},
      compileShader: () => {},
      getShaderParameter: () => true,
      createProgram: () => ({}),
      attachShader: () => {},
      linkProgram: () => {},
      getProgramParameter: () => true,
      useProgram: () => {},
      getAttribLocation: () => 0,
      getUniformLocation: () => ({}),
      createBuffer: () => ({}),
      bindBuffer: () => {},
      bufferData: () => {},
      enableVertexAttribArray: () => {},
      vertexAttribPointer: () => {},
      createTexture: () => ({}),
      bindTexture: () => {},
      texImage2D: () => {},
      texParameteri: () => {},
      uniform1i: () => {},
      uniform1f: () => {},
      uniform2f: () => {},
      uniform4f: () => {},
      uniformMatrix3fv: () => {},
      viewport: () => {},
      clear: () => {},
      clearColor: () => {},
      enable: () => {},
      disable: () => {},
      blendFunc: () => {},
      drawArrays: () => {},
      drawElements: () => {},
      createFramebuffer: () => ({}),
      bindFramebuffer: () => {},
      framebufferTexture2D: () => {},
      checkFramebufferStatus: () => 0x8CD5,
      readPixels: () => {},
      pixelStorei: () => {},
      activeTexture: () => {},
      deleteTexture: () => {},
      deleteBuffer: () => {},
      deleteProgram: () => {},
      deleteShader: () => {},
      deleteFramebuffer: () => {},
      scissor: () => {},
      generateMipmap: () => {},
      isContextLost: () => false,
    }
  }
  return originalGetContext.call(this, type, ...args)
}
