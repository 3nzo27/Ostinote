import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Polyfill ReadableStream async iteration for Safari < 16.5 and any other
// WebKit build that ships ReadableStream without Symbol.asyncIterator.
// PDF.js's getTextContent does `for await (const value of readableStream)`
// internally, which throws "undefined is not a function (near '...value of
// readableStream...')" on those browsers. The native implementation in
// newer browsers wins; we only install when missing.
if (typeof ReadableStream !== "undefined" && !ReadableStream.prototype[Symbol.asyncIterator]) {
  ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
