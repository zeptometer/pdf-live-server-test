import * as pdfjsLib from 'pdfjs-dist';

// Disable native scroll restoration
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

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

const prefetchCache = new Map<number, Promise<HTMLDivElement | null>>();

/**
 * Creates and renders a page into a new div.
 * Does NOT attach it to the DOM.
 */
async function createPageElement(pageNum: number): Promise<HTMLDivElement | null> {
  if (!pdfDocument) return null;
  
  try {
    const page = await pdfDocument.getPage(pageNum);
    
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
    const outputScale = window.devicePixelRatio || 1;

    const pageDiv = document.createElement('div');
    pageDiv.className = 'page-container';
    pageDiv.dataset.pageNum = pageNum.toString();
    pageDiv.style.width = Math.floor(viewport.width) + "px";
    pageDiv.style.height = Math.floor(viewport.height) + "px";

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    pageDiv.appendChild(canvas);

    await page.render({
      canvasContext: context,
      transform: transform,
      viewport: viewport
    }).promise;

    return pageDiv;
  } catch (err) {
    console.error(`Error rendering page ${pageNum}:`, err);
    return null;
  }
}

/**
 * Retrieves a page element from the prefetch cache, or creates it if not found.
 */
async function getPageElement(pageNum: number): Promise<HTMLDivElement | null> {
  if (prefetchCache.has(pageNum)) {
    const cachedPromise = prefetchCache.get(pageNum);
    prefetchCache.delete(pageNum);
    return cachedPromise || null;
  }
  return createPageElement(pageNum);
}

/**
 * Renders adjacent pages in the background.
 */
function prefetchAdjacentPages() {
  if (!pdfDocument) return;

  const prev = currentPageIndex; // 1-based page is prev
  const next = currentPageIndex + 2; // 1-based page is next

  // Clean up cache: remove anything that isn't prev or next
  for (const key of Array.from(prefetchCache.keys())) {
    if (key !== prev && key !== next) {
      prefetchCache.delete(key);
    }
  }

  // Prefetch previous page
  if (prev >= 1 && !prefetchCache.has(prev)) {
    prefetchCache.set(prev, createPageElement(prev));
  }

  // Prefetch next page
  if (next <= pdfDocument.numPages && !prefetchCache.has(next)) {
    prefetchCache.set(next, createPageElement(next));
  }
}

/**
 * Loads the document and renders the current page.
 */
async function renderPdf() {
  if (!container) return;
  if (isRendering) return;
  isRendering = true;

  try {
    const urlWithCacheBuster = `${pdfUrl}?t=${Date.now()}`;
    const loadingTask = pdfjsLib.getDocument({ url: urlWithCacheBuster });
    pdfDocument = await loadingTask.promise;
    
    // Clear cache because the PDF or zoom may have changed
    prefetchCache.clear();

    // Read the page from hash if available, otherwise use currentPageIndex
    const hashMatch = window.location.hash.match(/#page=(\d+)/);
    const hashPage = hashMatch ? parseInt(hashMatch[1]) - 1 : currentPageIndex;
    currentPageIndex = Math.max(0, Math.min(hashPage, pdfDocument.numPages - 1));
    history.replaceState(null, '', `#page=${currentPageIndex + 1}`);

    const newDiv = await getPageElement(currentPageIndex + 1);
    if (newDiv) {
      container.innerHTML = '';
      container.appendChild(newDiv);
    }

    prefetchAdjacentPages();
  } catch (err) {
    console.error('Error fetching PDF:', err);
  } finally {
    isRendering = false;
  }
}

/**
 * Navigates to a specific page using double buffering and prefetching.
 */
async function goToPage(newIndex: number) {
  if (!container || !pdfDocument || isRendering) return;
  if (newIndex < 0 || newIndex >= pdfDocument.numPages || newIndex === currentPageIndex) return;

  isRendering = true;
  currentPageIndex = newIndex;
  history.replaceState(null, '', `#page=${currentPageIndex + 1}`);

  try {
    const newDiv = await getPageElement(currentPageIndex + 1);
    // Double buffering: only replace the DOM when the new page is completely rendered
    if (newDiv) {
      container.innerHTML = '';
      container.appendChild(newDiv);
    }
    prefetchAdjacentPages();
  } finally {
    isRendering = false;
  }
}

// Initial render
renderPdf();

// === UI Controls ===

const btnFab = document.getElementById('btn-fab');
const zoomMenu = document.getElementById('zoom-menu');
const zoomOptions = document.querySelectorAll('.zoom-option');
const btnFullscreen = document.getElementById('btn-fullscreen');

btnFab?.addEventListener('click', (e) => {
  e.stopPropagation();
  zoomMenu?.classList.toggle('hidden');
});

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

let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
window.addEventListener('resize', () => {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (zoomMode === 'height' || zoomMode === 'width') {
      renderPdf();
    }
  }, 300);
});

// Navigation
const navLeft = document.getElementById('nav-left');
const navRight = document.getElementById('nav-right');

navLeft?.addEventListener('click', () => {
  goToPage(currentPageIndex - 1);
});

navRight?.addEventListener('click', () => {
  goToPage(currentPageIndex + 1);
});

// Listen for updates from the server
const eventSource = new EventSource('/events');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'reload') {
    renderPdf();
  }
};
