import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker explicitly
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const container = document.getElementById('pdf-container');
const pdfUrl = '/target.pdf';

let isRendering = false;

async function renderPdf() {
  if (!container) return;
  if (isRendering) return;
  isRendering = true;

  try {
    // Save current scroll position
    const scrollY = window.scrollY;

    // Load the PDF with cache buster
    const urlWithCacheBuster = `${pdfUrl}?t=${Date.now()}`;
    const loadingTask = pdfjsLib.getDocument({
      url: urlWithCacheBuster
    });

    const pdf = await loadingTask.promise;
    
    // Clear the container
    container.innerHTML = '';

    // Render all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      container.appendChild(canvas);

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
    }

    // Restore scroll position
    window.scrollTo(0, scrollY);
    console.log('PDF rendered, scroll restored to:', scrollY);

  } catch (err) {
    console.error('Error rendering PDF:', err);
  } finally {
    isRendering = false;
  }
}

// Initial render
renderPdf();

// Listen for updates from the server
const eventSource = new EventSource('/events');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'reload') {
    console.log('Received reload event, refetching PDF...');
    renderPdf();
  } else if (data.type === 'connected') {
    console.log('Connected to live reload server.');
  }
};

eventSource.onerror = (err) => {
  console.error('EventSource error:', err);
};
