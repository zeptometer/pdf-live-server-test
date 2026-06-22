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
    // Load the PDF with cache buster
    const urlWithCacheBuster = `${pdfUrl}?t=${Date.now()}`;
    const loadingTask = pdfjsLib.getDocument({
      url: urlWithCacheBuster
    });

    const pdf = await loadingTask.promise;
    
    // Create an off-screen fragment to hold the new pages
    const fragment = document.createDocumentFragment();

    // Render all pages into the fragment
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      fragment.appendChild(canvas);

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
    }

    // Capture the latest scroll position right before the DOM swap
    const currentScrollY = window.scrollY;

    // Synchronously swap the container contents and restore scroll
    // This prevents the browser from painting the intermediate empty state
    container.innerHTML = '';
    container.appendChild(fragment);
    window.scrollTo(0, currentScrollY);
    
    console.log('PDF rendered, scroll restored to:', currentScrollY);

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
