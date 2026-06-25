import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker explicitly
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

const container = document.getElementById('pdf-container');
const pdfUrl = '/target.pdf';

let isRendering = false;
type ZoomMode = '100' | 'width' | 'height';
let zoomMode: ZoomMode = (localStorage.getItem('zoomMode') as ZoomMode) || 'width';
let currentPageIndex = 0;
let pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
const pageContainers: HTMLDivElement[] = [];

const visiblePages = new Map<number, number>();
let ignoreObserverUntil = 0;

// For tracking the current page
const visibilityObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const pageNumStr = (entry.target as HTMLElement).dataset.pageNum;
    if (pageNumStr) {
      const index = parseInt(pageNumStr) - 1;
      visiblePages.set(index, entry.intersectionRatio);
    }
  });

  let maxRatio = -1;
  let bestIndex = currentPageIndex;
  
  visiblePages.forEach((ratio, index) => {
    if (ratio > maxRatio) {
      maxRatio = ratio;
      bestIndex = index;
    }
  });

  if (Date.now() > ignoreObserverUntil && maxRatio > 0 && bestIndex !== currentPageIndex) {
    currentPageIndex = bestIndex;
    history.replaceState(null, '', `#page=${currentPageIndex + 1}`);
  }
}, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0] });

// For triggering render (preload adjacent pages)
const renderObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const div = entry.target as HTMLDivElement;
    if (entry.isIntersecting) {
      renderPageInDiv(div);
    } else {
      unmountPageInDiv(div);
    }
  });
}, { rootMargin: '100% 0px' });

async function renderPageInDiv(div: HTMLDivElement) {
  const data = div as any;
  if (data._hasRendered || data._isRendering) return;
  data._isRendering = true;

  try {
    const page = data._page;
    const viewport = data._viewport;
    const outputScale = window.devicePixelRatio || 1;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    // Fill the placeholder
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    div.innerHTML = ''; // clear placeholder text/spinner if any
    div.appendChild(canvas);

    await page.render({
      canvasContext: context,
      transform: transform,
      viewport: viewport
    }).promise;

    data._hasRendered = true;
  } catch (err) {
    console.error('Error rendering page:', err);
  } finally {
    data._isRendering = false;
  }
}

function unmountPageInDiv(div: HTMLDivElement) {
  const data = div as any;
  if (data._hasRendered) {
    div.innerHTML = ''; // clear canvas to free GPU memory
    data._hasRendered = false;
  }
}

async function renderPdf() {
  if (!container) return;
  if (isRendering) return;
  isRendering = true;

  try {
    const urlWithCacheBuster = `${pdfUrl}?t=${Date.now()}`;
    const loadingTask = pdfjsLib.getDocument({ url: urlWithCacheBuster });
    pdfDocument = await loadingTask.promise;
    
    // Read the page from hash if available, otherwise use currentPageIndex
    const hashMatch = window.location.hash.match(/#page=(\d+)/);
    const hashPage = hashMatch ? parseInt(hashMatch[1]) - 1 : currentPageIndex;
    const savedIndex = Math.max(0, Math.min(hashPage, pdfDocument.numPages - 1));

    // Disconnect observers
    visibilityObserver.disconnect();
    renderObserver.disconnect();
    pageContainers.length = 0;
    container.innerHTML = '';

    const fragment = document.createDocumentFragment();

    // Fetch all pages to get dimensions (fast)
    const pagePromises = [];
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      pagePromises.push(pdfDocument.getPage(pageNum));
    }
    const pages = await Promise.all(pagePromises);

    // Create placeholders
    pages.forEach((page, index) => {
      let scale = 1.5;
      if (zoomMode === 'width' || zoomMode === 'height') {
        const baseViewport = page.getViewport({ scale: 1.0 });
        if (zoomMode === 'height') {
          scale = window.innerHeight / baseViewport.height;
        } else {
          scale = document.documentElement.clientWidth / baseViewport.width;
        }
      }
      const viewport = page.getViewport({ scale });

      const pageDiv = document.createElement('div');
      pageDiv.className = 'page-container';
      pageDiv.dataset.pageNum = (index + 1).toString();
      
      // Explicit dimensions to maintain scroll space
      pageDiv.style.width = Math.floor(viewport.width) + "px";
      pageDiv.style.height = Math.floor(viewport.height) + "px";
      
      const data = pageDiv as any;
      data._viewport = viewport;
      data._page = page;
      data._isRendering = false;
      data._hasRendered = false;

      pageContainers.push(pageDiv);
      fragment.appendChild(pageDiv);
    });
    
    container.appendChild(fragment);

    // Ignore observer updates temporarily while the browser handles DOM updates & scroll jumps
    ignoreObserverUntil = Date.now() + 500;

    // Observe all placeholders
    pageContainers.forEach(div => {
      visibilityObserver.observe(div);
      renderObserver.observe(div);
    });

    // Restore scroll position
    if (pageContainers[savedIndex]) {
      pageContainers[savedIndex].scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      currentPageIndex = savedIndex;
    } else if (pageContainers.length > 0) {
      pageContainers[0].scrollIntoView({ behavior: 'instant', block: 'start', inline: 'center' });
      currentPageIndex = 0;
    }

  } catch (err) {
    console.error('Error fetching PDF:', err);
  } finally {
    isRendering = false;
  }
}

// Initial render
renderPdf();

const btnFab = document.getElementById('btn-fab');
const zoomMenu = document.getElementById('zoom-menu');
const zoomOptions = document.querySelectorAll('.zoom-option');

btnFab?.addEventListener('click', (e) => {
  e.stopPropagation();
  zoomMenu?.classList.toggle('hidden');
});

const btnFullscreen = document.getElementById('btn-fullscreen');

btnFullscreen?.addEventListener('click', (e) => {
  e.stopPropagation();
  zoomMenu?.classList.add('hidden');
  
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
});

document.addEventListener('fullscreenchange', () => {
  if (btnFullscreen) {
    const iconSpan = btnFullscreen.querySelector('.material-symbols-outlined');
    const textSpan = btnFullscreen.querySelector('.btn-text');
    if (document.fullscreenElement) {
      if (iconSpan) iconSpan.textContent = 'fullscreen_exit';
      if (textSpan) textSpan.textContent = 'Exit Fullscreen';
    } else {
      if (iconSpan) iconSpan.textContent = 'fullscreen';
      if (textSpan) textSpan.textContent = 'Fullscreen';
    }
  }
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  if (!zoomMenu?.classList.contains('hidden')) {
    const target = e.target as HTMLElement;
    if (!target.closest('#fab-container')) {
      zoomMenu.classList.add('hidden');
    }
  }
});

// Initial active state for zoom options
zoomOptions.forEach(b => {
  if (b.getAttribute('data-mode') === zoomMode) {
    b.classList.add('active');
  } else {
    b.classList.remove('active');
  }
});

zoomOptions.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const mode = target.getAttribute('data-mode') as ZoomMode;
    
    if (mode && mode !== zoomMode) {
      zoomMode = mode;
      localStorage.setItem('zoomMode', mode);
      
      // Update active state
      zoomOptions.forEach(b => b.classList.remove('active'));
      target.classList.add('active');
      
      // Re-render
      renderPdf();
    }
    
    // Hide menu after selection
    zoomMenu?.classList.add('hidden');
  });
});

const navLeft = document.getElementById('nav-left');
const navRight = document.getElementById('nav-right');

navLeft?.addEventListener('click', async () => {
  const prevIndex = Math.max(0, currentPageIndex - 1);
  const targetDiv = pageContainers[prevIndex];
  if (!targetDiv) return;

  // Double-buffering: Ensure the page is rendered before jumping
  if (!(targetDiv as any)._hasRendered) {
    await renderPageInDiv(targetDiv);
  }
  
  targetDiv.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
});

navRight?.addEventListener('click', async () => {
  const nextIndex = Math.min(pageContainers.length - 1, currentPageIndex + 1);
  const targetDiv = pageContainers[nextIndex];
  if (!targetDiv) return;

  // Double-buffering: Ensure the page is rendered before jumping
  if (!(targetDiv as any)._hasRendered) {
    await renderPageInDiv(targetDiv);
  }
  
  targetDiv.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
});

// Listen for updates from the server
const eventSource = new EventSource('/events');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'reload') {
    renderPdf();
  }
};
