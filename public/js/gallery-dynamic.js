// Dynamic Gallery Loader
(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.location.pathname.includes('gallery')) return;

    try {
      const res = await fetch('/api/gallery');
      const images = await res.json();

      if (!images.length) return; // Keep existing hardcoded gallery

      const grid = document.querySelector('.masonry, .gallery-grid, [class*="masonry"]');
      if (!grid) return;

      grid.innerHTML = images.map(img => `
        <div class="masonry-item" style="break-inside:avoid;margin-bottom:12px">
          <img src="${img.url}" alt="${img.alt_text || 'Snow Adventure'}" loading="lazy"
               style="width:100%;border-radius:6px;display:block;cursor:pointer"
               onclick="openLightbox('${img.url}')">
        </div>
      `).join('');
    } catch (err) {
      // Silently fail, keep existing gallery
      console.log('Gallery API not available, using static gallery');
    }
  });

  // Simple lightbox
  window.openLightbox = function(src) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:200;display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(10px)';
    overlay.innerHTML = `<img src="${src}" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:8px">`;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  };
})();
