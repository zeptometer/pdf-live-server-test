import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker explicitly
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const container = document.getElementById('pdf-container');
const pdfUrl = '/target.pdf';

let isRendering = false;
let isHorizontal = false;
type ZoomMode = '100' | 'width' | 'height';
let zoomMode: ZoomMode = 'width';
let currentPageIndex = 0;
const canvases: HTMLCanvasElement[] = [];

// Track the most visible page
const observer = new IntersectionObserver((entries) => {
  let maxRatio = 0;
  entries.forEach(entry => {
    if (entry.intersectionRatio > maxRatio) {
      maxRatio = entry.intersectionRatio;
      const index = canvases.indexOf(entry.target as HTMLCanvasElement);
      if (index !== -1) {
        currentPageIndex = index;
      }
    }
  });
}, { threshold: [0.1, 0.5, 0.9] });

async function renderPdf() {
  if (!container) return;
  if (isRendering) return;
  isRendering = true;

  try {
    const urlWithCacheBuster = `${pdfUrl}?t=${Date.now()}`;
    const loadingTask = pdfjsLib.getDocument({ url: urlWithCacheBuster });
    const pdf = await loadingTask.promise;
    
    const fragment = document.createDocumentFragment();
    const newCanvases: HTMLCanvasElement[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      
      let scale = 1.5;
      if (zoomMode === 'width' || zoomMode === 'height') {
        const baseViewport = page.getViewport({ scale: 1.0 });
        if (zoomMode === 'height') {
          scale = window.innerHeight / baseViewport.height;
        } else {
          // Use clientWidth to avoid horizontal scrollbars interfering
          scale = document.documentElement.clientWidth / baseViewport.width;
        }
      }
      
      const viewport = page.getViewport({ scale: scale });
      const outputScale = window.devicePixelRatio || 1;

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + "px";
      // height is left to 'auto' via CSS to preserve aspect ratio
      
      canvas.classList.add(`zoom-${zoomMode}`);
      newCanvases.push(canvas);
      fragment.appendChild(canvas);

      const transform = outputScale !== 1 
        ? [outputScale, 0, 0, outputScale, 0, 0] 
        : null;

      const renderContext = {
        canvasContext: context,
        transform: transform,
        viewport: viewport
      };

      await page.render(renderContext).promise;
    }

    // Save scroll state before swapping
    const savedIndex = currentPageIndex;
    
    observer.disconnect();
    canvases.length = 0;
    
    container.innerHTML = '';
    container.appendChild(fragment);
    
    // Register new canvases
    newCanvases.forEach(c => {
      canvases.push(c);
      observer.observe(c);
    });

    // Restore position to the page the user was looking at
    if (canvases[savedIndex]) {
      canvases[savedIndex].scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      currentPageIndex = savedIndex;
    }

  } catch (err) {
    console.error('Error rendering PDF:', err);
  } finally {
    isRendering = false;
  }
}

// Initial render
renderPdf();

// Setup UI Controls
const btnScroll = document.getElementById('btn-scroll');
const btnZoom = document.getElementById('btn-zoom');

btnScroll?.addEventListener('click', () => {
  isHorizontal = !isHorizontal;
  document.body.classList.toggle('horizontal-mode', isHorizontal);
  btnScroll.textContent = isHorizontal ? 'Scroll: Horiz' : 'Scroll: Vert';
  
  if (zoomMode !== '100') {
    // Re-render because the fit dimension might need recalculation
    renderPdf();
  } else {
    // Re-align to current page immediately
    if (canvases[currentPageIndex]) {
      canvases[currentPageIndex].scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
    }
  }
});

btnZoom?.addEventListener('click', () => {
  if (zoomMode === 'width') zoomMode = 'height';
  else if (zoomMode === 'height') zoomMode = '100';
  else zoomMode = 'width';
  
  const labels = {
    'width': 'Zoom: Width',
    'height': 'Zoom: Height',
    '100': 'Zoom: 100%'
  };
  btnZoom.textContent = labels[zoomMode];
  renderPdf(); // Re-render to get crisp text at the new scale
});

const navLeft = document.getElementById('nav-left');
const navRight = document.getElementById('nav-right');

navLeft?.addEventListener('click', () => {
  const prevIndex = Math.max(0, currentPageIndex - 1);
  canvases[prevIndex]?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
});

navRight?.addEventListener('click', () => {
  const nextIndex = Math.min(canvases.length - 1, currentPageIndex + 1);
  canvases[nextIndex]?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
});

// Listen for updates from the server
const eventSource = new EventSource('/events');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'reload') {
    renderPdf();
  }
};
