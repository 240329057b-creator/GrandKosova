function inferType(src) {
  const ext = (src.split(".").pop() || "").toLowerCase();
  if (["mp4", "webm", "ogg", "mov"].includes(ext)) return "video";
  return "image";
}

async function loadGalleryList() {
  // Prefer embedded JSON (works even in environments where fetch is blocked).
  const embedded = document.getElementById("galleryData");
  if (embedded && embedded.textContent) {
    const data = JSON.parse(embedded.textContent);
    if (!Array.isArray(data)) throw new Error("Embedded gallery data must be an array");
    return data.map((src) => ({ src: String(src), type: inferType(String(src)) }));
  }

  // Fallback to fetching the manifest (works on http://localhost/...).
  const manifestUrl = new URL("assets/gallery.json", window.location.href).toString();
  const res = await fetch(manifestUrl, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load gallery.json: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("gallery.json must be an array");
  return data.map((src) => ({ src: String(src), type: inferType(String(src)) }));
}

function renderCards(container, items) {
  container.innerHTML = "";
  items.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "gallery-card";
    card.dataset.type = item.type;
    card.dataset.index = String(idx);

    if (item.type === "video") {
      const v = document.createElement("video");
      v.src = item.src;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.autoplay = false;
      v.preload = "metadata";
      card.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.src = item.src;
      img.loading = "lazy";
      img.alt = "";
      card.appendChild(img);
    }

    const badge = document.createElement("span");
    badge.className = "media-badge";
    badge.textContent = item.type === "video" ? "Video" : "Foto";
    card.appendChild(badge);

    container.appendChild(card);
  });
}

function optimizeGalleryVideos() {
  const videos = Array.from(document.querySelectorAll(".gallery-card video"));
  if (videos.length === 0) return;

  if (!("IntersectionObserver" in window)) {
    videos.forEach((video) => {
      video.play().catch(() => {});
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (!(video instanceof HTMLVideoElement)) return;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { threshold: 0.2, rootMargin: "150px 0px" },
  );

  videos.forEach((video) => observer.observe(video));
}

function initLightbox(items) {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxVideo = document.getElementById("lightbox-video");
  const nextBtn = document.querySelector(".next");
  const prevBtn = document.querySelector(".prev");
  const closeBtn = document.querySelector(".close");

  if (!lightbox || !lightboxImg || !lightboxVideo || !nextBtn || !prevBtn || !closeBtn) return;

  let current = 0;
  let zoom = 1;
  let slideInterval;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let dragX = 0;
  let dragY = 0;

  function startSlideshow() {
    slideInterval = window.setInterval(nextImage, 4000);
  }

  function stopSlideshow() {
    window.clearInterval(slideInterval);
  }

  function showMedia(index) {
    const item = items[index];
    if (!item) return;

    current = index;
    zoom = 1;
    dragX = 0;
    dragY = 0;

    if (item.type === "video") {
      lightboxImg.style.display = "none";
      lightboxImg.src = "";
      lightboxVideo.style.display = "block";
      lightboxVideo.src = item.src;
      lightboxVideo.play().catch(() => {});
    } else {
      lightboxVideo.pause();
      lightboxVideo.src = "";
      lightboxVideo.style.display = "none";
      lightboxImg.style.display = "block";
      lightboxImg.src = item.src;
      lightboxImg.style.transform = "scale(1)";
    }
  }

  function openLightbox(index) {
    lightbox.style.display = "flex";
    showMedia(index);
    startSlideshow();
  }

  function closeLightbox() {
    lightbox.style.display = "none";
    lightboxVideo.pause();
    lightboxVideo.src = "";
    stopSlideshow();
    zoom = 1;
    dragX = 0;
    dragY = 0;
    lightboxImg.style.transform = "scale(1)";
  }

  function nextImage() {
    const next = (current + 1) % items.length;
    showMedia(next);
  }

  function prevImage() {
    const prev = (current - 1 + items.length) % items.length;
    showMedia(prev);
  }

  document.addEventListener("click", (e) => {
    const card = e.target instanceof Element ? e.target.closest(".gallery-card") : null;
    if (!card) return;
    const index = parseInt(card.dataset.index || "0", 10);
    openLightbox(Number.isFinite(index) ? index : 0);
  });

  closeBtn.addEventListener("click", closeLightbox);
  nextBtn.addEventListener("click", nextImage);
  prevBtn.addEventListener("click", prevImage);

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (lightbox.style.display !== "flex") return;
    if (e.key === "ArrowRight") nextImage();
    if (e.key === "ArrowLeft") prevImage();
    if (e.key === "Escape") closeLightbox();
  });

  lightboxImg.addEventListener("wheel", (e) => {
    if (lightbox.style.display !== "flex") return;
    e.preventDefault();
    zoom += e.deltaY * -0.001;
    zoom = Math.min(Math.max(0.5, zoom), 4);
    lightboxImg.style.transform = `scale(${zoom}) translate(${dragX}px,${dragY}px)`;
  });

  lightboxImg.addEventListener("mousedown", (e) => {
    if (lightbox.style.display !== "flex") return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    lightboxImg.style.cursor = "grabbing";
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    lightboxImg.style.cursor = "grab";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    dragX += (e.clientX - startX) / zoom;
    dragY += (e.clientY - startY) / zoom;
    startX = e.clientX;
    startY = e.clientY;
    lightboxImg.style.transform = `scale(${zoom}) translate(${dragX}px,${dragY}px)`;
  });

  let touchStart = 0;
  lightbox.addEventListener("touchstart", (e) => {
    touchStart = e.touches[0]?.clientX || 0;
  });
  lightbox.addEventListener("touchend", (e) => {
    const touchEnd = e.changedTouches[0]?.clientX || 0;
    if (touchEnd - touchStart > 60) prevImage();
    if (touchStart - touchEnd > 60) nextImage();
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.querySelector(".gallery-grid");
  if (!grid) return;

  try {
    const items = await loadGalleryList();
    if (items.length === 0) {
      grid.innerHTML =
        '<div class="text-center" style="padding:40px;">Nuk ka media në galeri. Shto skedarë në <code>assets/images</code> dhe listo ata në <code>assets/gallery.json</code>.</div>';
      return;
    }

    renderCards(grid, items);
    optimizeGalleryVideos();
    initLightbox(items);
  } catch (e) {
    console.error(e);
    grid.innerHTML =
      '<div class="text-center" style="padding:40px;">Nuk u ngarkua galeria. Kontrollo <code>assets/gallery.json</code>.</div>';
  }
});

