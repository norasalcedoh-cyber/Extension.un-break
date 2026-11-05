(async () => {
// Runs inside the extension's isolated content-script world on Instagram only.
let modoDemo = false;
try {
  const state = await chrome.runtime.sendMessage({ type: 'demo:get' });
  modoDemo = state?.ok === true && state.enabled === true;
} catch {
  // If the worker is unavailable, preserve normal behavior without claiming demo activation.
}

function showDemoControl(active) {
  const host = document.createElement('div');
  host.id = 'un-break-demo-control';
  host.style.cssText = 'position:fixed!important;bottom:20px!important;right:20px!important;z-index:2147483647!important;visibility:visible!important;';
  const root = host.attachShadow({ mode: 'closed' });
  const box = document.createElement('section');
  box.style.cssText = 'max-width:320px;padding:16px;background:#eeeeea;color:#111;border:1px solid #111;font:14px/1.45 Arial,sans-serif;box-shadow:0 4px 24px #0003;';
  const text = document.createElement('p');
  text.style.margin = '0 0 12px';
  text.setAttribute('role', 'status');
  text.textContent = active
    ? 'UN-BREAK · Demo activa en esta pestaña. Desliza rápido para comprimir; detente unos segundos para deformar. Tras 15 segundos de navegación activa empezarán a desaparecer imágenes.'
    : 'UN-BREAK · ¿Quieres activar la demostración en esta pestaña? Verás los efectos con tiempos más cortos. No se envían datos personales.';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = active ? 'Salir de la demo' : 'Activar demostración';
  button.style.cssText = 'padding:9px;background:#111;color:white;border:0;cursor:pointer;font:inherit;';
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'demo:set', enabled: !active });
      if (!result?.ok || result.enabled !== !active) throw new Error('Demo state not confirmed');
      // Reload restores all original DOM styles and restarts the normal/demo timers.
      location.reload();
    } catch {
      text.textContent = 'No se pudo cambiar el modo. Recarga la extensión en chrome://extensions y vuelve a intentarlo.';
      button.disabled = false;
    }
  });
  box.append(text, button);
  if (!active) {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Ahora no';
    cancel.style.cssText = 'margin-left:12px;padding:9px;cursor:pointer;font:inherit;';
    cancel.addEventListener('click', () => host.remove());
    box.append(cancel);
  }
  root.append(box);
  document.body.append(host);
}

function checkDemoRequest() {
  if (location.hash !== '#un-break-demo') return;
  // Consume the request so exiting and reloading never activates it again.
  history.replaceState(history.state, '', location.pathname + location.search);
  if (!document.getElementById('un-break-demo-control')) showDemoControl(modoDemo);
}
if (modoDemo) showDemoControl(true);
checkDemoRequest();
window.addEventListener('hashchange', checkDemoRequest);


console.log("CULACCINO — Iniciado");

// =====================================
// 1. CONFIGURACIÓN
// =====================================

// KERNING
const UMBRAL_VELOCIDAD_KERNING = 0.8; // Pixels per millisecond.
const COMPRESION_POR_PIXEL = 0.001;
const KERNING_MINIMO = -3;
const MAXIMA_COMPRESION_RELATIVA = 0.2;
const KERNING_BASE = 0;

// DESAPARICIÓN
const INICIO_DESAPARICION = modoDemo ? 15 * 1000 : 50 * 1000;
const INTERVALO_DESAPARICION = modoDemo ? 2000 : 2500;
const DURACION_DESAPARICION_IMAGEN = 8000;

// DEFORMACIÓN DE IMAGENES
const INICIO_SATURACION_IMAGEN = modoDemo ? 500 : 2 * 1000;
const DURACION_SATURACION_IMAGEN = modoDemo ? 1000 : 3 * 1000;
const INICIO_DEFORMACION_IMAGEN = modoDemo ? 1200 : 5 * 1000;
const DURACION_DEFORMACION_IMAGEN = modoDemo ? 2500 : 8 * 1000;
const INTERVALO_DEFORMACION_IMAGEN = 500;
const DURACION_RESTAURACION_IMAGEN = 20000;
const MAXIMO_DEFORMACION_IMAGEN = 150;
const MAXIMO_SATURACION_IMAGEN = 1.6;


// =====================================
// 2. TIEMPO DE NAVEGACIÓN
// =====================================

let tiempoActivo = 0;
let numeroScrolls = 0;

let instagramActivo = !document.hidden;
let inicioPeriodo = instagramActivo
  ? Date.now()
  : null;

function pausarTiempo() {
  if (!instagramActivo) return;

  tiempoActivo += Date.now() - inicioPeriodo;
  instagramActivo = false;
  inicioPeriodo = null;
}

function reanudarTiempo() {
  if (instagramActivo) return;

  instagramActivo = true;
  inicioPeriodo = Date.now();
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pausarTiempo();
  } else {
    reanudarTiempo();
  }
});

window.addEventListener("pagehide", pausarTiempo);

function obtenerTiempoActual() {
  if (!instagramActivo) {
    return tiempoActivo;
  }

  return tiempoActivo + (Date.now() - inicioPeriodo);
}


// =====================================
// 3. SCROLL
// =====================================

const posicionesScroll = new WeakMap();
let kerningActual = KERNING_BASE;
let finGlitch;
let capaGlitch;
let ultimoPatronGlitch = -Infinity;
let ruidoGlitch;
let desplazamientoGlitch;

function variarGlitch() {
  const centro = 8 + Math.random() * 84;
  const ancho = 10 + Math.random() * 20;
  const borde = (x) => Math.max(0, Math.min(100, x));
  const izquierda = [];
  const derecha = [];
  for (let y = 0; y <= 100; y += 10) {
    const desvio = (Math.random() - 0.5) * 18;
    izquierda.push(`${borde(centro - ancho + desvio)}% ${y}%`);
    derecha.unshift(`${borde(centro + ancho + desvio)}% ${y}%`);
  }
  capaGlitch.style.setProperty("--rotura", `polygon(${izquierda.concat(derecha).join(",")})`);
  const bandas = [];
  for (let i = 0; i < 5; i++) {
    const y = Math.random() * 94;
    const alto = 2 + Math.random() * 6;
    bandas.push(`0 ${y}%,100% ${y}%,100% ${y + alto}%,0 ${y + alto}%`);
  }
  capaGlitch.style.setProperty("--bandas", `polygon(${bandas.join(",")})`);
  capaGlitch.style.setProperty("--salto", `${(Math.random() - 0.5) * 14}%`);
  ruidoGlitch.setAttribute("seed", String(Math.floor(Math.random() * 10000)));
  desplazamientoGlitch.setAttribute("scale", String(100 + Math.random() * 120));
  for (const zona of capaGlitch.querySelectorAll(".culaccino-pixeles-muertos")) {
    zona.style.left = `${Math.random() * 85}%`;
    zona.style.top = `${Math.random() * 80}%`;
    zona.style.width = `${8 + Math.random() * 22}%`;
    zona.style.height = `${12 + Math.random() * 38}%`;
  }
  const x = centro * 10;
  const y = 200 + Math.random() * 600;
  let grietas = "";
  for (let i = 0; i < 8; i++) {
    const angulo = i * Math.PI / 4 + Math.random() * 0.3;
    const dx = Math.cos(angulo);
    const dy = Math.sin(angulo);
    grietas += `M${x},${y} l${dx * 80 + 15},${dy * 80} l${dx * 150 - 30},${dy * 150} l${dx * 900},${dy * 900} `;
  }
  capaGlitch.querySelector(".culaccino-grietas path").setAttribute("d", grietas);
  ultimoPatronGlitch = performance.now();
}
if (document.scrollingElement) {
  posicionesScroll.set(document.scrollingElement, {
    posicion: document.scrollingElement.scrollTop, tiempo: Date.now()
  });
}

function detenerGlitch() {
  clearTimeout(finGlitch);
  document.documentElement.classList.remove("culaccino-glitch");
  capaGlitch?.remove();
}

function activarGlitch() {
  if (!capaGlitch) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:fixed;width:0;height:0;pointer-events:none";
    svg.innerHTML = `<defs>
      <filter id="culaccino-pantalla-rota" x="-10%" y="-5%" width="120%" height="110%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.001 0.085" numOctaves="1" seed="17" result="ruido"/>
        <feColorMatrix in="ruido" type="matrix" values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1" result="cortes"/>
        <feDisplacementMap in="SourceGraphic" in2="cortes" scale="95" xChannelSelector="R" yChannelSelector="G" result="roto"/>
        <feColorMatrix in="roto" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="rojo"/>
        <feOffset in="rojo" dx="9" result="r"/>
        <feColorMatrix in="roto" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
        <feColorMatrix in="roto" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="azul"/>
        <feOffset in="azul" dx="-9" result="b"/>
        <feBlend in="r" in2="g" mode="screen" result="rg"/>
        <feBlend in="rg" in2="b" mode="screen"/>
      </filter>
    </defs>`;
    document.documentElement.appendChild(svg);
    ruidoGlitch = svg.querySelector("feTurbulence");
    desplazamientoGlitch = svg.querySelector("feDisplacementMap");
    capaGlitch = document.createElement("div");
    capaGlitch.className = "culaccino-glitch-capa";
    capaGlitch.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) {
      const zona = document.createElement("div");
      zona.className = "culaccino-pixeles-muertos";
      capaGlitch.appendChild(zona);
    }
    const grietas = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    grietas.setAttribute("viewBox", "0 0 1000 1000");
    grietas.setAttribute("preserveAspectRatio", "none");
    grietas.classList.add("culaccino-grietas");
    grietas.innerHTML = '<path fill="none" stroke="#dedede" stroke-width="1.2" vector-effect="non-scaling-stroke"/>';
    capaGlitch.appendChild(grietas);
  }
  if (!capaGlitch.isConnected || performance.now() - ultimoPatronGlitch >= 130) variarGlitch();
  if (!capaGlitch.isConnected) document.documentElement.appendChild(capaGlitch);
  document.documentElement.classList.add("culaccino-glitch");
  clearTimeout(finGlitch);
  finGlitch = setTimeout(detenerGlitch, 220);
}

document.addEventListener("visibilitychange", detenerGlitch);
window.addEventListener("pagehide", detenerGlitch);

window.addEventListener("scroll", (evento) => {
  if (!instagramActivo) return;
  const ahora = Date.now();
  const contenedor = evento.target === document ? document.scrollingElement : evento.target;
  if (!contenedor) return;
  const posicion = contenedor.scrollTop;
  const anterior = posicionesScroll.get(contenedor);
  // Store the position before changing spacing: reflow may emit another scroll.
  posicionesScroll.set(contenedor, { posicion, tiempo: ahora });
  numeroScrolls++;
  if (!anterior) return;
  const intervalo = ahora - anterior.tiempo;
  const distancia = posicion - anterior.posicion;
  if (distancia < -2) activarGlitch();
  if (distancia > 0) {
    detenerGlitch();
    filtrosDeformacion.forEach((filtro, imagen) => {
      const estado = estadosImagenes.get(imagen);
      if (!estado || estado.nivel <= 0) return;
      estado.ultimoMovimiento = ahora;
      restaurarDeformacionGradualmente(filtro, estado);
    });
  }
  if (intervalo > 0 && intervalo <= 150 &&
      distancia / intervalo >= UMBRAL_VELOCIDAD_KERNING) {
    // Accumulate small changes with distance instead of jumping every 600ms.
    // Cap each contribution so a programmatic scroll cannot compress all at once.
    kerningActual = Math.max(KERNING_MINIMO,
      kerningActual - Math.min(distancia, 120) * COMPRESION_POR_PIXEL);
    aplicarKerning();
  }
}, { passive: true, capture: true });

function aplicarKerning() {
  if (!instagramActivo || kerningActual === KERNING_BASE) return;
  const textos = document.querySelectorAll(
    "article p, article span, article a, article li, article time, article h1, article h2, article h3"
  );
  textos.forEach((elemento) => {
    if (elemento.closest(".culaccino-desaparecido, [data-culaccino-ascii-text]")) return;
    // Prepare whole posts outside the viewport: changing a parent can also
    // move its visible descendants or rewrap the text currently being read.
    const articulo = elemento.closest("article");
    const rect = articulo.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) return;
    if (elemento.style.getPropertyValue("transition") !== "none") {
      elemento.style.setProperty("transition", "none", "important");
    }
    // Small text needs a tighter limit so spacing never overwhelms its glyphs.
    const tamanoFuente = parseFloat(getComputedStyle(elemento).fontSize) || 14;
    const limiteElemento = Math.max(KERNING_MINIMO, -tamanoFuente * MAXIMA_COMPRESION_RELATIVA);
    const valor = Math.max(kerningActual, limiteElemento) + "px";
    if (elemento.style.getPropertyValue("letter-spacing") !== valor) {
      elemento.style.setProperty("letter-spacing", valor, "important");
    }
  });
}

// Newly loaded posts inherit the accumulated compression without adding steps.
setInterval(aplicarKerning, 500);


// =====================================
// 4. DESAPARICIÓN ALEATORIA
// =====================================

const elementosDesaparecidos = new WeakSet();
const marcosOcultos = new WeakMap();

function desaparecerElemento() {
  if (!instagramActivo) return;

  if (
    obtenerTiempoActual() <
    INICIO_DESAPARICION
  ) {
    return;
  }

  // Choose a category first so small avatars and text have the same chance
  // as the main photos, regardless of how many text spans a post contains.
  const grupos = { medios: [], perfiles: [], textos: [], controles: [] };
  const candidatos = Array.from(document.querySelectorAll(
    'article img, article video, article p, article figcaption, article li, ' +
    'article span[dir="auto"], article time, article button, article [role="button"]'
  )).filter((elemento) => {
    if (elementosDesaparecidos.has(elemento) ||
        elemento.closest("[data-culaccino-ascii-text], .culaccino-desaparecido") ||
        elemento.querySelector(".culaccino-desaparecido")) {
      return false;
    }
    const esMedio = elemento.matches("img, video");
    if (!esMedio && elemento.querySelector("img, video")) return false;
    if (!esMedio && !elemento.matches('button, [role="button"]') &&
        !elemento.textContent.trim()) return false;
    const rect = elemento.getBoundingClientRect();
    const estilo = getComputedStyle(elemento);
    return (
      estilo.visibility === "visible" && estilo.display !== "none" &&
      rect.width > 12 &&
      rect.height > 12 &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight &&
      rect.right > 0 && rect.left < window.innerWidth
    );
  });

  for (const elemento of candidatos) {
    if (elemento.matches("img, video")) {
      const rect = elemento.getBoundingClientRect();
      const perfil = elemento.matches("img") && rect.width <= 100 && rect.height <= 100;
      grupos[perfil ? "perfiles" : "medios"].push(elemento);
    } else if (elemento.matches('button, [role="button"]')) {
      grupos.controles.push(elemento);
    } else if (!candidatos.some((otro) => otro !== elemento &&
        !otro.matches("img, video") && otro.contains(elemento))) {
      grupos.textos.push(elemento);
    }
  }

  const disponibles = Object.values(grupos).filter((grupo) => grupo.length);
  if (!disponibles.length) return;
  const grupo = disponibles[Math.floor(Math.random() * disponibles.length)];
  const elegido = grupo[Math.floor(Math.random() * grupo.length)];
  if (!elegido.matches("img, video")) {
    elementosDesaparecidos.add(elegido);
    elegido.classList.add("culaccino-desaparecido", "culaccino-elemento-oculto");
    console.log("CULACCINO: texto o control ocultado conservando su espacio");
    return;
  }

  const estilo = getComputedStyle(elegido);
  const reemplazo = document.createElement("div");
  // Reuse the media's actual layout box instead of adding a floating overlay.
  for (const propiedad of estilo) {
    reemplazo.style.setProperty(propiedad, estilo.getPropertyValue(propiedad));
  }
  if (estilo.display === "inline") reemplazo.style.display = "inline-block";
  reemplazo.className = "culaccino-desaparecido";
  const rectElegido = elegido.getBoundingClientRect();
  const esPerfil = elegido.matches("img") && rectElegido.width <= 100 && rectElegido.height <= 100;
  if (esPerfil) {
    reemplazo.style.setProperty("border-radius", "50%", "important");
  }
  reemplazo.setAttribute("role", "img");
  reemplazo.setAttribute("aria-label", "Imagen sustituida por un espacio en blanco");
  const estado = estadosImagenes.get(elegido);
  if (estado?.animacionRecuperacion != null) {
    cancelAnimationFrame(estado.animacionRecuperacion);
  }
  estadosImagenes.delete(elegido);
  const filtro = filtrosDeformacion.get(elegido);
  if (filtro) {
    restaurarFiltroContenedor(filtro);
    filtro.elemento.remove();
    filtrosDeformacion.delete(elegido);
  }
  const reanudarVideo = elegido.matches("video") && !elegido.paused;
  if (elegido.matches("video")) elegido.pause();
  elementosDesaparecidos.add(elegido);
  // Clear every nested frame around the media, preserving its layout box.
  const marco = obtenerMarcoDeImagen(elegido);
  const marcos = [];
  for (let contenedor = esPerfil ? null : elegido.parentElement; contenedor; contenedor = contenedor.parentElement) {
    if (contenedor.matches("article, body, html")) break;
    let ocultacion = marcosOcultos.get(contenedor);
    if (!ocultacion) {
      ocultacion = { cantidad: 0, claseOriginal: contenedor.classList.contains("culaccino-hueco-blanco") };
      marcosOcultos.set(contenedor, ocultacion);
    }
    ocultacion.cantidad++;
    marcos.push(contenedor);
    contenedor.classList.add("culaccino-hueco-blanco");
    if (contenedor === marco) break;
  }
  elegido.replaceWith(reemplazo);
  setTimeout(() => {
    // Restore the same media node, keeping its listeners and original layout.
    for (const contenedor of marcos) {
      const ocultacion = marcosOcultos.get(contenedor);
      if (!ocultacion || --ocultacion.cantidad > 0) continue;
      if (!ocultacion.claseOriginal) contenedor.classList.remove("culaccino-hueco-blanco");
      marcosOcultos.delete(contenedor);
    }
    elementosDesaparecidos.delete(elegido);
    if (!reemplazo.isConnected) return;
    reemplazo.replaceWith(elegido);
    if (reanudarVideo) elegido.play().catch(() => {});
  }, DURACION_DESAPARICION_IMAGEN);

  console.log("CULACCINO: imagen sustituida por espacio en blanco");
}

setInterval(
  desaparecerElemento,
  INTERVALO_DESAPARICION
);

const estadosImagenes = new WeakMap();

function deformarImagenesQuietas() {
  if (!instagramActivo) return;

  filtrosDeformacion.forEach((filtro, imagen) => {
    if (!imagen.isConnected) {
      const estado = estadosImagenes.get(imagen);
      if (estado && estado.animacionRecuperacion !== null) {
        cancelAnimationFrame(estado.animacionRecuperacion);
      }
      restaurarFiltroContenedor(filtro);
      filtro.elemento.remove();
      filtrosDeformacion.delete(imagen);
    }
  });

  const imagenes = Array.from(
    document.querySelectorAll(
      "article img, article video"
    )
  );

  const marcosProcesados = new Set();
  imagenes.forEach((imagen) => {
    const rect = imagen.getBoundingClientRect();
    const ahora = Date.now();
    const visible = (
      rect.width > 50 &&
      rect.height > 12 &&
      rect.right > 0 && rect.left < window.innerWidth &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight
    );

    let estado = estadosImagenes.get(imagen);
    if (!estado) {
      if (!visible) return;

      estado = {
        izquierda: rect.left,
        arriba: rect.top,
        ancho: rect.width,
        alto: rect.height,
        ultimoMovimiento: ahora,
        nivel: 0,
        saturacion: 1,
        animacionRecuperacion: null
      };
      estadosImagenes.set(imagen, estado);
    }

    const seMovio = (
      Math.abs(rect.left - estado.izquierda) > 1 ||
      Math.abs(rect.top - estado.arriba) > 1 ||
      Math.abs(rect.width - estado.ancho) > 1 ||
      Math.abs(rect.height - estado.alto) > 1
    );
    estado.izquierda = rect.left;
    estado.arriba = rect.top;
    estado.ancho = rect.width;
    estado.alto = rect.height;

    if (seMovio) {
      estado.ultimoMovimiento = ahora;
      const filtro = filtrosDeformacion.get(imagen);
      if (filtro && estado.nivel > 0) {
        restaurarDeformacionGradualmente(filtro, estado);
      }
    }

    // Finish recovering before allowing another deformation, even if scrolling stops.
    if (!visible || estado.animacionRecuperacion !== null) return;
    const marcoActual = obtenerMarcoDeImagen(imagen);
    if (marcosProcesados.has(marcoActual)) return;
    marcosProcesados.add(marcoActual);

    const tiempoQuieto = ahora - estado.ultimoMovimiento;
    if (tiempoQuieto >= INICIO_SATURACION_IMAGEN) {
      const progresoSaturacion = Math.min(
        (tiempoQuieto - INICIO_SATURACION_IMAGEN) /
          DURACION_SATURACION_IMAGEN,
        1
      );
      estado.saturacion = Math.max(
        estado.saturacion,
        1 + progresoSaturacion * (MAXIMO_SATURACION_IMAGEN - 1)
      );
    }

    if (estado.saturacion > 1) {
      imagen.style.setProperty(
        "filter",
        `saturate(${estado.saturacion})`,
        "important"
      );
    } else {
      imagen.style.removeProperty("filter");
    }

    if (tiempoQuieto >= INICIO_DEFORMACION_IMAGEN) {
      const progreso = Math.min(
        (tiempoQuieto - INICIO_DEFORMACION_IMAGEN) /
          DURACION_DEFORMACION_IMAGEN,
        1
      );
      if (estado.animacionRecuperacion !== null) {
        cancelAnimationFrame(estado.animacionRecuperacion);
        estado.animacionRecuperacion = null;
      }
      estado.nivel = progreso * MAXIMO_DEFORMACION_IMAGEN;
      const filtro = obtenerFiltroDeformacion(
        imagen,
        obtenerEspacioFiltros()
      );
      actualizarDeformacion(filtro, estado.nivel);
    }
  });
}

let espacioFiltros;
let siguienteIdFiltro = 0;
const filtrosDeformacion = new Map();

function actualizarDeformacion(filtro, nivel) {
  filtro.desplazamiento.setAttribute("scale", nivel.toString());

  if (nivel > 0) {
    actualizarLimitesFiltroDeformacion(filtro);
    filtro.contenedor.style.setProperty(
      "filter",
      `url("#${filtro.id}")`,
      "important"
    );
    filtro.contenedor.style.setProperty(
      "overflow",
      "visible",
      "important"
    );
    // Outer photo wrappers must not crop the displaced frame back to a rectangle.
    for (const recorte of filtro.recortes) {
      recorte.elemento.style.setProperty("overflow", "visible", "important");
    }
  } else {
    restaurarFiltroContenedor(filtro);
  }
}

function restaurarDeformacionGradualmente(filtro, estado) {
  if (estado.animacionRecuperacion !== null) return;

  const nivelInicial = estado.nivel;
  const inicio = performance.now();

  function animarRestauracion(ahora) {
    const progreso = Math.min(
      (ahora - inicio) / DURACION_RESTAURACION_IMAGEN,
      1
    );
    // Smooth start and finish, with no abrupt change in speed at either end.
    const suavizado = progreso * progreso * (3 - 2 * progreso);
    estado.nivel = nivelInicial * (1 - suavizado);
    actualizarDeformacion(filtro, estado.nivel);

    if (progreso < 1) {
      estado.animacionRecuperacion = requestAnimationFrame(
        animarRestauracion
      );
    } else {
      estado.animacionRecuperacion = null;
      estado.ultimoMovimiento = Date.now();
    }
  }

  estado.animacionRecuperacion = requestAnimationFrame(animarRestauracion);
}

function obtenerEspacioFiltros() {
  if (espacioFiltros) return espacioFiltros;

  const svg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.style.width = "0";
  svg.style.height = "0";
  svg.style.overflow = "hidden";

  espacioFiltros = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "defs"
  );
  svg.appendChild(espacioFiltros);
  (document.body || document.documentElement).appendChild(svg);

  return espacioFiltros;
}

function obtenerMarcoDeImagen(imagen) {
  const rectImagen = imagen.getBoundingClientRect();
  let marco = imagen.parentElement;
  if (imagen.matches("img")) {
    // Use the media's geometry: overlays and hidden carousel slides are also
    // inside its frame, so counting images or checking text misses that frame.
    for (let padre = marco; padre && !padre.matches("article, body, html"); padre = padre.parentElement) {
      const rect = padre.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const margen = Math.max(16, Math.min(rectImagen.width, rectImagen.height) * 0.08);
      const coincide = Math.abs(rect.left - rectImagen.left) <= margen &&
        Math.abs(rect.top - rectImagen.top) <= margen &&
        Math.abs(rect.right - rectImagen.right) <= margen &&
        Math.abs(rect.bottom - rectImagen.bottom) <= margen;
      if (coincide) marco = padre;
      // A carousel track can be wider than the photo; continue past it to
      // include the viewport that clips it. Stop before captions and headers.
      if (rect.height > rectImagen.height + margen * 2 ||
          rect.top < rectImagen.top - margen || rect.bottom > rectImagen.bottom + margen) break;
    }
    return marco;
  }
  // Include the nested media frame, while leaving captions and the rest of
  // the article outside the distortion. No wrappers or DOM moves are needed.
  for (let padre = marco; padre && !padre.matches("article, body, html"); padre = padre.parentElement) {
    const rect = padre.getBoundingClientRect();
    const coincide = Math.abs(rect.left - rectImagen.left) <= 8 &&
      Math.abs(rect.top - rectImagen.top) <= 8 &&
      Math.abs(rect.right - rectImagen.right) <= 8 &&
      Math.abs(rect.bottom - rectImagen.bottom) <= 8;
    if (!coincide) break;
    marco = padre;
  }
  return marco;
}

function obtenerFiltroDeformacion(imagen, defs) {
  const existente = filtrosDeformacion.get(imagen);
  if (existente) return existente;

  const contenedor = obtenerMarcoDeImagen(imagen);
  if (!contenedor) {
    throw new Error("La imagen no tiene un contenedor para deformar");
  }

  const id = `culaccino-distortion-${Date.now()}-${siguienteIdFiltro++}`;
  const filtro = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "filter"
  );
  filtro.setAttribute("id", id);
  filtro.setAttribute("filterUnits", "userSpaceOnUse");
  filtro.setAttribute("color-interpolation-filters", "sRGB");

  const ruido = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "feTurbulence"
  );
  ruido.setAttribute("type", "fractalNoise");
  ruido.setAttribute("baseFrequency", imagen.matches("img") ? "0.004 0.007" : "0.006 0.025");
  ruido.setAttribute("numOctaves", imagen.matches("img") ? "1" : "2");
  ruido.setAttribute("seed", String(siguienteIdFiltro));
  ruido.setAttribute("result", "ondas");
  filtro.appendChild(ruido);

  const desplazamiento = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "feDisplacementMap"
  );
  desplazamiento.setAttribute("in", "SourceGraphic");
  desplazamiento.setAttribute("in2", "ondas");
  desplazamiento.setAttribute("xChannelSelector", "R");
  desplazamiento.setAttribute("yChannelSelector", "G");
  desplazamiento.setAttribute("scale", "0");
  filtro.appendChild(desplazamiento);

  defs.appendChild(filtro);

  const resultado = {
    id,
    desplazamiento,
    elemento: filtro,
    contenedor,
    recortes: [],
    filtroOriginalContenedor: contenedor.style.getPropertyValue("filter"),
    prioridadFiltroOriginalContenedor: contenedor.style.getPropertyPriority(
      "filter"
    ),
    overflowOriginalContenedor: contenedor.style.getPropertyValue("overflow"),
    prioridadOverflowOriginalContenedor: contenedor.style.getPropertyPriority(
      "overflow"
    )
  };
  if (imagen.matches("img")) {
    for (let padre = contenedor.parentElement; padre && !padre.matches("article, body, html"); padre = padre.parentElement) {
      // Stop at shared media containers so hidden carousel slides stay hidden.
      if (padre.querySelectorAll("img, video").length !== 1 || padre.textContent.trim()) break;
      resultado.recortes.push({
        elemento: padre,
        overflow: padre.style.getPropertyValue("overflow"),
        prioridad: padre.style.getPropertyPriority("overflow")
      });
    }
  }
  filtrosDeformacion.set(imagen, resultado);
  return resultado;
}

function actualizarLimitesFiltroDeformacion(filtro) {
  const rect = filtro.contenedor.getBoundingClientRect();
  const margen = MAXIMO_DEFORMACION_IMAGEN;

  filtro.elemento.setAttribute("x", String(-margen));
  filtro.elemento.setAttribute("y", String(-margen));
  filtro.elemento.setAttribute("width", String(rect.width + margen * 2));
  filtro.elemento.setAttribute("height", String(rect.height + margen * 2));
}

function restaurarFiltroContenedor(filtro) {
  const filtroAplicado = `url("#${filtro.id}")`;
  for (const recorte of filtro.recortes) {
    if (recorte.elemento.style.getPropertyValue("overflow") !== "visible") continue;
    if (recorte.overflow) {
      recorte.elemento.style.setProperty("overflow", recorte.overflow, recorte.prioridad);
    } else {
      recorte.elemento.style.removeProperty("overflow");
    }
  }

  if (filtro.contenedor.style.getPropertyValue("filter") === filtroAplicado) {
    if (filtro.filtroOriginalContenedor) {
      filtro.contenedor.style.setProperty(
        "filter",
        filtro.filtroOriginalContenedor,
        filtro.prioridadFiltroOriginalContenedor
      );
    } else {
      filtro.contenedor.style.removeProperty("filter");
    }
  }

  if (filtro.contenedor.style.getPropertyValue("overflow") === "visible") {
    if (filtro.overflowOriginalContenedor) {
      filtro.contenedor.style.setProperty(
        "overflow",
        filtro.overflowOriginalContenedor,
        filtro.prioridadOverflowOriginalContenedor
      );
    } else {
      filtro.contenedor.style.removeProperty("overflow");
    }
  }
}

setInterval(
  deformarImagenesQuietas,
  INTERVALO_DEFORMACION_IMAGEN
);

// =====================================
// 6. TRANSFORMACIÓN ASCII DEL FEED
// =====================================

const INICIO_ASCII = INICIO_DESAPARICION;
const DURACION_ASCII_VISIBLE = 3000;
const DURACION_ASCII_OCULTO = 5000;
let modoAsciiActivado = false;

// Keep decoded originals across ASCII appearances. A slow image download should
// not restart from zero every time the three-second visible phase ends.
const fuentesImagenAscii = new Map();
function cargarFuenteImagenAscii(url) {
  if (fuentesImagenAscii.has(url)) return fuentesImagenAscii.get(url);
  const pendiente = new Promise((resolve, reject) => {
    function decodificar(src, cors, fallo) {
      const imagen = new Image();
      if (cors) imagen.crossOrigin = "anonymous";
      imagen.onload = () => resolve(imagen);
      imagen.onerror = fallo;
      imagen.src = src;
    }
    decodificar(url, true, async () => {
      try {
        const resultado = await chrome.runtime.sendMessage({ type: "ascii:image", url });
        if (!resultado?.ok) throw new Error("Image unavailable for ASCII");
        decodificar(resultado.dataUrl, false, () => reject(new Error("Image decode failed")));
      } catch (error) { reject(error); }
    });
  });
  fuentesImagenAscii.set(url, pendiente);
  if (fuentesImagenAscii.size > 16) {
    fuentesImagenAscii.delete(fuentesImagenAscii.keys().next().value);
  }
  pendiente.catch(() => {
    if (fuentesImagenAscii.get(url) === pendiente) fuentesImagenAscii.delete(url);
  });
  return pendiente;
}

// Prepare visible publication photos before the first appearance of the effect.
setInterval(() => {
  if (!instagramActivo || obtenerTiempoActual() < Math.max(0, INICIO_ASCII - 10000)) return;
  document.querySelectorAll("img:not([data-culaccino-ascii-ready]):not([data-culaccino-ascii-text])").forEach((imagen) => {
    if (imagen.closest(".culaccino-desaparecido, [data-culaccino-ascii-text]")) return;
    const rect = imagen.getBoundingClientRect();
    const url = imagen.currentSrc || imagen.src;
    if (url && rect.width > 50 && rect.height > 12 && rect.bottom > 0 && rect.top < window.innerHeight) {
      cargarFuenteImagenAscii(url).catch(() => {});
    }
  });
}, 1000);

function transformarInterfazEnAscii() {
  if (modoAsciiActivado) return;
  modoAsciiActivado = true;

  const caracteres = " .:-=+*#%@";
  let medios = new WeakMap();
  const videos = new Map();
  let asciiVisible = false;
  let inicioFaseAscii = obtenerTiempoActual() - DURACION_ASCII_OCULTO;
  let restauraciones = [];
  let coloresGuardados = new WeakSet();
  let controles = new WeakMap();
  let fondos = new WeakMap();
  let semillaColor = Math.floor(Math.random() * 0xffffffff);
  let framePendiente = null;

  function guardarAtributos(elemento, nombres) {
    const valores = nombres.map((nombre) => [nombre, elemento.getAttribute(nombre)]);
    restauraciones.push(() => {
      for (const [nombre, valor] of valores) {
        if (valor === null) elemento.removeAttribute(nombre);
        else elemento.setAttribute(nombre, valor);
      }
    });
  }

  function alternarAscii() {
    if (document.hidden) return;
    const ahora = obtenerTiempoActual();
    if (!asciiVisible) {
      if (ahora - inicioFaseAscii < DURACION_ASCII_OCULTO) return;
      asciiVisible = true;
      inicioFaseAscii = ahora;
      semillaColor = Math.floor(Math.random() * 0xffffffff);
      document.documentElement.classList.add("culaccino-ascii-mode");
      programarConversion();
      return;
    }
    if (ahora - inicioFaseAscii < DURACION_ASCII_VISIBLE) return;
    asciiVisible = false;
    inicioFaseAscii = ahora;
    observadorAscii.disconnect();
    // Invalidates pending image loads from this appearance of the effect.
    medios = new WeakMap();
    for (const restaurar of restauraciones.reverse()) restaurar();
    restauraciones = [];
    coloresGuardados = new WeakSet();
    controles = new WeakMap();
    fondos = new WeakMap();
    videos.clear();
    document.documentElement.classList.remove("culaccino-ascii-mode");
  }
  const colores = ["#FFD600", "#FF7A00", "#FF0169", "#D300C5", "#7638FA"];

  function colorCelda(columna, fila) {
    // Random distribution that stays stable while video frames refresh.
    let valor = semillaColor ^ Math.imul(columna + 1, 374761393) ^ Math.imul(fila + 1, 668265263);
    valor = Math.imul(valor ^ (valor >>> 13), 1274126177);
    return colores[((valor ^ (valor >>> 16)) >>> 0) % colores.length];
  }

  function programarConversion() {
    if (!asciiVisible || framePendiente !== null) return;
    framePendiente = requestAnimationFrame(() => {
      framePendiente = null;
      convertirContenido();
    });
  }

  function crearAscii(origen, rect, estilo, celdaAncho = 5, celdaAlto = 8) {
    const anchoFuente = origen.videoWidth || origen.naturalWidth || origen.width;
    const altoFuente = origen.videoHeight || origen.naturalHeight || origen.height;
    if (!anchoFuente || !altoFuente) return null;
    const ancho = Math.max(1, Math.round(rect.width));
    const alto = Math.max(1, Math.round(rect.height));
    const columnas = Math.ceil(ancho / celdaAncho);
    const filas = Math.ceil(alto / celdaAlto);
    const muestra = document.createElement("canvas");
    muestra.width = columnas;
    muestra.height = filas;
    const ctx = muestra.getContext("2d", { willReadFrequently: true });
    const factor = estilo.objectFit === "cover"
      ? Math.max(ancho / anchoFuente, alto / altoFuente)
      : Math.min(ancho / anchoFuente, alto / altoFuente);
    const ajustar = ["cover", "contain"].includes(estilo.objectFit);
    const w = ajustar ? anchoFuente * factor : ancho;
    const h = ajustar ? altoFuente * factor : alto;
    // The replacement has exactly the original element's box. Object fitting
    // is baked in once, instead of drawing a second viewport approximation.
    ctx.drawImage(origen, (ancho - w) / 2 / ancho * columnas,
      (alto - h) / 2 / alto * filas, w / ancho * columnas, h / alto * filas);
    let pixeles;
    try { pixeles = ctx.getImageData(0, 0, columnas, filas).data; }
    catch { return null; }
    const resultado = document.createElement("canvas");
    resultado.width = ancho;
    resultado.height = alto;
    const salida = resultado.getContext("2d");
    salida.font = celdaAlto + "px 'Courier New', monospace";
    salida.textBaseline = "top";
    for (let fila = 0; fila < filas; fila++) {
      for (let columna = 0; columna < columnas; columna++) {
        const i = (fila * columnas + columna) * 4;
        if (pixeles[i + 3] < 16) continue;
        const luz = (pixeles[i] * 0.2126 + pixeles[i + 1] * 0.7152 + pixeles[i + 2] * 0.0722) / 255;
        const indice = Math.round((1 - luz) * (caracteres.length - 1));
        if (!indice) continue;
        salida.globalAlpha = pixeles[i + 3] / 255;
        salida.fillStyle = colorCelda(columna, fila);
        salida.fillText(caracteres[indice], columna * celdaAncho, fila * celdaAlto);
      }
    }
    return resultado;
  }

  function convertirMedio(elemento, rect) {
    const esSvg = elemento.matches("svg");
    const clave = esSvg ? elemento.outerHTML : elemento.currentSrc || elemento.src || "canvas";
    const anterior = medios.get(elemento);
    if (anterior?.aplicado && elemento.matches("img") &&
        elemento.src === anterior.clave && !elemento.srcset) return;
    if (anterior?.clave === clave) return;
    const entrada = { clave };
    medios.set(elemento, entrada);
    const estilo = getComputedStyle(elemento);

    function aplicar(origen) {
      if (!asciiVisible || !elemento.isConnected || medios.get(elemento) !== entrada) return false;
      let ascii;
      try { ascii = crearAscii(origen, rect, estilo); } catch { return false; }
      if (!ascii) return false;
      // Media frames must stay white through the gaps between ASCII glyphs.
      // Leave text and icons transparent so their native layout is preserved.
      if (elemento.matches("img, video, canvas")) {
        const fondo = ascii.getContext("2d");
        fondo.globalCompositeOperation = "destination-over";
        fondo.fillStyle = "#ffffff";
        fondo.fillRect(0, 0, ascii.width, ascii.height);
        fondo.globalCompositeOperation = "source-over";
      }
      if (elemento.matches("img")) {
        // Replace the image source itself: no overlay and no second element.
        const url = ascii.toDataURL();
        guardarAtributos(elemento, ["src", "srcset", "sizes", "data-culaccino-ascii-ready"]);
        elemento.setAttribute("data-culaccino-ascii-ready", "");
        const ajusteOriginal = elemento.style.getPropertyValue("object-fit");
        const prioridadOriginal = elemento.style.getPropertyPriority("object-fit");
        restauraciones.push(() => {
          if (ajusteOriginal) elemento.style.setProperty("object-fit", ajusteOriginal, prioridadOriginal);
          else elemento.style.removeProperty("object-fit");
        });
        if (elemento.parentElement?.matches("picture")) {
          elemento.parentElement.querySelectorAll("source").forEach((nodo) => {
            guardarAtributos(nodo, ["srcset"]);
            nodo.removeAttribute("srcset");
          });
        }
        elemento.removeAttribute("srcset");
        elemento.removeAttribute("sizes");
        elemento.style.setProperty("object-fit", "fill", "important");
        elemento.src = url;
        entrada.clave = url;
      } else if (esSvg) {
        guardarAtributos(elemento, ["viewBox"]);
        const hijosOriginales = Array.from(elemento.childNodes);
        restauraciones.push(() => elemento.replaceChildren(...hijosOriginales));
        const imagen = document.createElementNS("http://www.w3.org/2000/svg", "image");
        imagen.setAttribute("href", ascii.toDataURL());
        imagen.setAttribute("width", ascii.width);
        imagen.setAttribute("height", ascii.height);
        elemento.setAttribute("viewBox", "0 0 " + ascii.width + " " + ascii.height);
        elemento.replaceChildren(imagen);
        entrada.clave = elemento.outerHTML;
      } else if (elemento.matches("canvas")) {
        const ctx = elemento.getContext("2d", { willReadFrequently: true });
        if (!ctx) return false;
        // Instagram may have already created ctx without readback optimization.
        const copia = document.createElement("canvas");
        copia.width = elemento.width;
        copia.height = elemento.height;
        const lectura = copia.getContext("2d", { willReadFrequently: true });
        lectura.drawImage(elemento, 0, 0);
        const original = lectura.getImageData(0, 0, elemento.width, elemento.height);
        restauraciones.push(() => ctx.putImageData(original, 0, 0));
        ctx.clearRect(0, 0, elemento.width, elemento.height);
        ctx.drawImage(ascii, 0, 0, elemento.width, elemento.height);
      } else if (elemento.matches("video")) {
        // Keep Instagram's video node attached: replacing it breaks the page's
        // own DOM reconciliation when the ASCII phase ends.
        const padre = elemento.parentElement;
        if (!padre) return false;
        if (getComputedStyle(padre).position === "static") {
          guardarEstilos(padre, ["position"]);
          padre.style.setProperty("position", "relative", "important");
        }
        ascii.style.cssText = "position:absolute!important;display:block!important;" +
          "visibility:visible!important;pointer-events:none!important;margin:0!important;" +
          "padding:0!important;border:0!important;box-sizing:border-box!important;";
        ascii.style.borderRadius = estilo.borderRadius;
        ascii.style.backgroundColor = "#ffffff";
        ascii.style.zIndex = estilo.zIndex;
        ascii.setAttribute("data-culaccino-ascii-video", "");
        ascii.setAttribute("role", "img");
        ascii.setAttribute("aria-label", elemento.getAttribute("aria-label") || "Video en ASCII");
        elemento.after(ascii);
        posicionarAsciiVideo(ascii, elemento);
        guardarAtributos(elemento, ["data-culaccino-ascii-ready"]);
        elemento.setAttribute("data-culaccino-ascii-ready", "");
        restauraciones.push(() => ascii.remove());
        medios.set(ascii, { clave: "canvas" });
        videos.set(ascii, { original: elemento, estilo });
      }
      entrada.aplicado = true;
      return true;
    }

    if (esSvg) {
      const clon = elemento.cloneNode(true);
      clon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const originales = [elemento, ...elemento.querySelectorAll("*")];
      [clon, ...clon.querySelectorAll("*")].forEach((nodo, indice) => {
        const css = getComputedStyle(originales[indice]);
        for (const propiedad of ["fill", "stroke", "stroke-width", "color", "opacity"]) {
          nodo.style.setProperty(propiedad, css.getPropertyValue(propiedad));
        }
      });
      clon.setAttribute("width", rect.width);
      clon.setAttribute("height", rect.height);
      const imagen = new Image();
      imagen.onload = () => aplicar(imagen);
      imagen.src = "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(new XMLSerializer().serializeToString(clon));
    } else if (elemento.matches("img")) {
      // Use a reusable, readable original rather than downloading it again on
      // every appearance. The phase guard still prevents late DOM changes.
      if (!aplicar(elemento)) {
        const url = elemento.currentSrc || elemento.src;
        if (url) cargarFuenteImagenAscii(url).then(aplicar).catch(() => {});
      }
    } else {
      aplicar(elemento);
    }
    // Keep the original visible when pixel access or loading fails.
  }

  function convertirNodoTexto(nodo, estilo) {
    const original = nodo.textContent;
    if (!original.trim()) return;
    const reemplazo = document.createElement("span");
    reemplazo.dataset.culaccinoAsciiText = "";
    reemplazo.style.setProperty("display", "inline", "important");
    const rango = document.createRange();
    for (const parte of original.matchAll(/\s+|\S+/g)) {
      const palabra = parte[0];
      if (!palabra.trim()) {
        reemplazo.appendChild(document.createTextNode(palabra));
        continue;
      }
      rango.setStart(nodo, parte.index);
      rango.setEnd(nodo, parte.index + palabra.length);
      const rect = rango.getBoundingClientRect();
      if (!rect.width) continue;
      const fuente = document.createElement("canvas");
      const ctx = fuente.getContext("2d");
      const font = estilo.fontStyle + " " + estilo.fontWeight + " " + estilo.fontSize + " " + estilo.fontFamily;
      ctx.font = font;
      const medida = ctx.measureText(palabra);
      const tamano = parseFloat(estilo.fontSize) || 14;
      const ascenso = medida.fontBoundingBoxAscent || tamano;
      const descenso = medida.fontBoundingBoxDescent || tamano * 0.25;
      fuente.width = Math.max(1, Math.ceil(rect.width));
      fuente.height = Math.max(1, Math.ceil(ascenso + descenso));
      ctx.font = font;
      ctx.fillStyle = "#000000";
      ctx.textBaseline = "alphabetic";
      if ("letterSpacing" in ctx) ctx.letterSpacing = estilo.letterSpacing;
      ctx.fillText(palabra, 0, ascenso, rect.width);
      const ascii = crearAscii(fuente, { width: rect.width, height: fuente.height },
        { objectFit: "fill" }, 3, 4);
      if (!ascii) {
        reemplazo.appendChild(document.createTextNode(palabra));
        continue;
      }
      const imagen = document.createElement("img");
      imagen.src = ascii.toDataURL();
      imagen.alt = palabra;
      imagen.dataset.culaccinoAsciiText = "";
      // Each word occupies its measured native width and keeps its baseline.
      // Whitespace stays as text, so the browser still wraps at word boundaries.
      imagen.style.cssText = "display:inline!important;position:static!important;float:none!important;" +
        "width:" + rect.width + "px!important;height:" + fuente.height + "px!important;" +
        "max-width:none!important;min-width:0!important;margin:0!important;padding:0!important;" +
        "border:0!important;vertical-align:" + (-descenso) + "px!important;" +
        "pointer-events:none!important;object-fit:fill!important;";
      reemplazo.appendChild(imagen);
    }
    nodo.replaceWith(reemplazo);
    restauraciones.push(() => {
      if (reemplazo.isConnected) reemplazo.replaceWith(nodo);
    });
  }

  function guardarEstilos(elemento, propiedades) {
    const originales = propiedades.map((nombre) => [nombre,
      elemento.style.getPropertyValue(nombre), elemento.style.getPropertyPriority(nombre)]);
    restauraciones.push(() => {
      for (const [nombre, valor, prioridad] of originales) {
        if (valor) elemento.style.setProperty(nombre, valor, prioridad);
        else elemento.style.removeProperty(nombre);
      }
    });
  }

  function posicionarAsciiVideo(canvas, video) {
    const padre = canvas.offsetParent || video.parentElement;
    if (!padre) return;
    const rect = video.getBoundingClientRect();
    const caja = padre.getBoundingClientRect();
    const escalaX = padre.offsetWidth ? caja.width / padre.offsetWidth : 1;
    const escalaY = padre.offsetHeight ? caja.height / padre.offsetHeight : 1;
    const sx = escalaX || 1;
    const sy = escalaY || 1;
    canvas.style.left = ((rect.left - caja.left) / sx - padre.clientLeft + padre.scrollLeft) + "px";
    canvas.style.top = ((rect.top - caja.top) / sy - padre.clientTop + padre.scrollTop) + "px";
    canvas.style.width = rect.width / sx + "px";
    canvas.style.height = rect.height / sy + "px";
  }

  function convertirControl(elemento, rect, estilo) {
    const texto = elemento.matches("select") ? elemento.selectedOptions[0]?.textContent || ""
      : elemento.type === "password" ? "*".repeat(elemento.value.length)
      : elemento.value || elemento.placeholder || "";
    const clave = texto + ":" + rect.width + ":" + rect.height;
    if (controles.get(elemento) === clave) return;
    if (!coloresGuardados.has(elemento)) {
      coloresGuardados.add(elemento);
      guardarEstilos(elemento, ["color", "-webkit-text-fill-color", "background-image",
        "background-size", "background-repeat", "background-origin"]);
    }
    const fuente = document.createElement("canvas");
    fuente.width = Math.max(1, Math.round(rect.width));
    fuente.height = Math.max(1, Math.round(rect.height));
    const ctx = fuente.getContext("2d");
    ctx.font = estilo.fontWeight + " " + estilo.fontSize + " " + estilo.fontFamily;
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "middle";
    const x = parseFloat(estilo.paddingLeft) || 6;
    const y = elemento.matches("textarea")
      ? (parseFloat(estilo.paddingTop) || 0) + (parseFloat(estilo.fontSize) || 14) / 2
      : rect.height / 2;
    ctx.fillText(texto, x, y, Math.max(1, rect.width - x * 2));
    const ascii = crearAscii(fuente, rect, { objectFit: "fill" }, 3, 4);
    if (!ascii) return;
    elemento.style.setProperty("color", "transparent", "important");
    elemento.style.setProperty("-webkit-text-fill-color", "transparent", "important");
    elemento.style.setProperty("background-image", 'url("' + ascii.toDataURL() + '")', "important");
    elemento.style.setProperty("background-size", "100% 100%", "important");
    elemento.style.setProperty("background-repeat", "no-repeat", "important");
    elemento.style.setProperty("background-origin", "border-box", "important");
    controles.set(elemento, clave);
  }

  function convertirFondo(elemento, rect, estilo) {
    if (fondos.has(elemento)) return;
    const url = /^url\(["']?(.*?)["']?\)$/.exec(estilo.backgroundImage)?.[1];
    if (!url) return;
    const entrada = {};
    fondos.set(elemento, entrada);
    guardarEstilos(elemento, ["background-image", "background-size", "background-repeat"]);
    const imagen = new Image();
    function aplicar(origen) {
      if (!asciiVisible || fondos.get(elemento) !== entrada || !elemento.isConnected) return;
      let ascii;
      try { ascii = crearAscii(origen, rect, { objectFit: estilo.backgroundSize === "contain" ? "contain" : "cover" }); }
      catch { return; }
      if (!ascii) return;
      elemento.style.setProperty("background-image", 'url("' + ascii.toDataURL() + '")', "important");
      elemento.style.setProperty("background-size", "100% 100%", "important");
      elemento.style.setProperty("background-repeat", "no-repeat", "important");
    }
    imagen.crossOrigin = "anonymous";
    imagen.onload = () => aplicar(imagen);
    imagen.onerror = async () => {
      try {
        const resultado = await chrome.runtime.sendMessage({ type: "ascii:image", url });
        if (!resultado?.ok || !asciiVisible || fondos.get(elemento) !== entrada) return;
        const copia = new Image();
        copia.onload = () => aplicar(copia);
        copia.src = resultado.dataUrl;
      } catch { /* Keep the original background if conversion fails. */ }
    };
    imagen.src = url;
  }

  function convertirContenido() {
    if (!asciiVisible || document.hidden) return;
    // Stop observing our own edits so replacing a source does not recursively
    // convert its ASCII result or produce duplicate media on subsequent frames.
    observadorAscii.disconnect();
    try {
      for (const elemento of document.body.querySelectorAll("*")) {
        if (elemento.closest("[data-culaccino-ascii-text]")) continue;
        if (elemento.closest("script, style, noscript, svg, #un-break-demo-control") && !elemento.matches("svg")) continue;
        const rect = elemento.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0 ||
            rect.top >= window.innerHeight || rect.left >= window.innerWidth) continue;
        const estilo = getComputedStyle(elemento);
        const medioPendiente = elemento.matches("img, video") && !elemento.hasAttribute("data-culaccino-ascii-ready");
        if ((!medioPendiente && estilo.visibility !== "visible") || estilo.display === "none" ||
            elemento.closest(".culaccino-desaparecido, [hidden]")) continue;
        if (elemento.matches("img, video, canvas, svg")) {
          convertirMedio(elemento, rect);
          continue;
        }
        for (const nodo of Array.from(elemento.childNodes)) {
          if (nodo.nodeType === Node.TEXT_NODE && nodo.textContent.trim() &&
              !elemento.closest("[contenteditable], textarea, option")) {
            convertirNodoTexto(nodo, estilo);
          }
        }
        if (elemento.matches("input, textarea, select")) {
          convertirControl(elemento, rect, estilo);
        } else {
          convertirFondo(elemento, rect, estilo);
        }
      }
      for (const [canvas, estado] of videos) {
        if (!canvas.isConnected || !estado.original.isConnected ||
            canvas.parentElement !== estado.original.parentElement) {
          canvas.remove();
          videos.delete(canvas);
          continue;
        }
        posicionarAsciiVideo(canvas, estado.original);
        const rect = canvas.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
        let ascii;
        try { ascii = crearAscii(estado.original, rect, estado.estilo); } catch { continue; }
        if (!ascii) continue;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(ascii, 0, 0, canvas.width, canvas.height);
      }
    } finally {
      observadorAscii.observe(document.body, {
        childList: true, subtree: true, characterData: true, attributes: true
      });
    }
  }

  const observadorAscii = new MutationObserver(programarConversion);
  window.addEventListener("resize", programarConversion);
  window.addEventListener("scroll", programarConversion, { passive: true, capture: true });
  document.addEventListener("input", programarConversion, true);
  document.addEventListener("load", (evento) => {
    const elemento = evento.target;
    const estado = medios.get(elemento);
    if (estado?.aplicado && elemento.matches?.("img") && elemento.currentSrc === estado.clave) return;
    if (estado) medios.delete(elemento);
    programarConversion();
  }, true);
  setInterval(programarConversion, 500);
  setInterval(alternarAscii, 100);
  alternarAscii();
  console.log("CULACCINO: elementos sustituidos en su posicion original");
}

// Use active browsing time; background tabs do not advance the threshold.
setInterval(() => {
  if (!modoAsciiActivado && instagramActivo && obtenerTiempoActual() >= INICIO_ASCII) {
    transformarInterfazEnAscii();
  }
}, 100);


// =====================================
// 7. CONSOLA DE PRUEBAS
// =====================================

setInterval(() => {
  console.log("CULACCINO");
  console.log(
    "Tiempo:",
    Math.floor(obtenerTiempoActual() / 1000),
    "segundos"
  );
  console.log("Scroll:", numeroScrolls);
}, 5000);

})();
