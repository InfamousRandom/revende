// Checklist antes de comprar (Fase 5): datos fijos, sin servidor.
// `fraude: true` marca los puntos antifraude (robado, bloqueado o réplica): se resaltan.

export const GENERAL = [
  { texto: 'Revísalo en persona, en un lugar público y con buena luz.' },
  { texto: 'No pagues ni transfieras antes de ver y probar el artículo.', fraude: true },
  { texto: 'Si el precio está muy por debajo del típico, desconfía: puede ser robado o réplica.', fraude: true },
];

export const CHECKLISTS = {
  celulares: {
    nombre: 'Celulares',
    puntos: [
      { texto: 'Marca *#06# y compara el IMEI con el de la caja y el de Ajustes.', fraude: true },
      { texto: 'Consulta que el IMEI no esté reportado como robado (en la página de tu compañía telefónica o del IFT).', fraude: true },
      { texto: 'iPhone: sin cuenta de iCloud y con "Buscar mi iPhone" apagado. Android: sin cuenta de Google (bloqueo de fábrica).', fraude: true },
      { texto: 'Pide factura o comprobante de compra.', fraude: true },
      { texto: 'Señales de réplica: peso, logos, menús raros o tienda de apps distinta a la del fabricante.', fraude: true },
      { texto: 'Batería: en iPhone, Ajustes › Batería › Estado (salud en %).' },
      { texto: 'Pantalla: manchas, píxeles muertos y que el táctil responda en toda la pantalla.' },
      { texto: 'Face ID o huella, cámaras, bocinas y micrófono (graba una nota de voz).' },
      { texto: 'Mete una SIM: señal y una llamada de prueba (que esté liberado).' },
      { texto: 'Que cargue por cable y, si tiene, inalámbrico.' },
    ],
  },
  consolas: {
    nombre: 'Consolas',
    puntos: [
      { texto: 'El número de serie de la consola coincide con el de la caja.', fraude: true },
      { texto: 'Cuenta del dueño cerrada y consola restablecida de fábrica.', fraude: true },
      { texto: 'Switch: que entre a la eShop (una consola baneada no se conecta).', fraude: true },
      { texto: 'Tornillos y etiquetas sin señales de haberse abierto.' },
      { texto: 'Juega 10 minutos: ruido del ventilador, calentamiento o apagones.' },
      { texto: 'Si tiene lector, que lea un disco.' },
      { texto: 'Controles: palancas sin "drift", todos los botones y que carguen.' },
      { texto: 'Puertos HDMI y USB sin daños; cables y cargador originales.' },
    ],
  },
  laptops: {
    nombre: 'Laptops',
    puntos: [
      { texto: 'Mac: "Buscar mi Mac" apagado (bloqueo de activación) y sin cuenta del dueño.', fraude: true },
      { texto: 'Sin contraseña de BIOS ni de usuario; restablecida de fábrica.', fraude: true },
      { texto: 'Número de serie igual al de la caja o factura; pide factura.', fraude: true },
      { texto: 'RAM, disco y procesador coinciden con lo anunciado.' },
      { texto: 'Batería: ciclos y salud (Mac: Información del sistema; Windows: reporte de batería).' },
      { texto: 'Pantalla, todas las teclas, touchpad y bisagras firmes.' },
      { texto: 'Puertos, wifi, bocinas y cámara.' },
      { texto: 'Cargador original de la potencia correcta.' },
    ],
  },
  tablets: {
    nombre: 'Tablets',
    puntos: [
      { texto: 'iPad: sin cuenta de iCloud y "Buscar mi iPad" apagado. Android: sin cuenta de Google.', fraude: true },
      { texto: 'Número de serie igual al de la caja; pide factura.', fraude: true },
      { texto: 'Batería y que cargue bien.' },
      { texto: 'Pantalla: manchas, píxeles muertos y táctil en toda la pantalla.' },
      { texto: 'Bocinas, cámaras y lápiz o teclado si los incluye.' },
    ],
  },
  audio: {
    nombre: 'Audio',
    puntos: [
      { texto: 'Réplicas muy comunes (AirPods y similares): revisa el número de serie en la página del fabricante.', fraude: true },
      { texto: 'Que se vinculen con la app o animación oficial de la marca.', fraude: true },
      { texto: 'Ambos lados suenan; prueba micrófono y cancelación de ruido.' },
      { texto: 'El estuche carga y la batería dura.' },
      { texto: 'Almohadillas o puntas en buen estado.' },
    ],
  },
  relojes: {
    nombre: 'Relojes',
    puntos: [
      { texto: 'Apple Watch: desvinculado del iPhone del dueño (bloqueo de activación).', fraude: true },
      { texto: 'Relojes de marca: peso, acabados, número de serie, caja y papeles (réplicas comunes).', fraude: true },
      { texto: 'Smartwatch: batería, sensores y que cargue.' },
      { texto: 'Cristal sin rayones profundos; correa y broche en buen estado.' },
      { texto: 'Mecánicos o de cuarzo: que marque bien la hora.' },
    ],
  },
  tenis: {
    nombre: 'Tenis',
    puntos: [
      { texto: 'La etiqueta interior trae el mismo número de estilo y talla que la caja.', fraude: true },
      { texto: 'Costuras, pegamento y logos como en las fotos oficiales; olor fuerte a pegamento es mala señal.', fraude: true },
      { texto: 'Suela y talón: desgaste, despegado o amarillento.' },
      { texto: 'Plantillas, agujetas y manchas.' },
      { texto: 'Caja original (sube el precio de reventa).' },
    ],
  },
  ropa: {
    nombre: 'Ropa',
    puntos: [
      { texto: 'Marca: etiquetas, costuras, cierres y hologramas como en la original.', fraude: true },
      { texto: 'Manchas, hoyos, olor y bolitas.' },
      { texto: 'Talla real (mídela, no confíes solo en la etiqueta).' },
      { texto: 'Con etiquetas puestas se vende como nueva.' },
    ],
  },
};

// Palabras que delatan la categoría cuando el producto no está en tu historial.
const PISTAS = {
  celulares: ['iphone', 'celular', 'galaxy', 'xiaomi', 'redmi', 'motorola', 'moto g', 'pixel', 'huawei', 'oppo', 'honor', 'smartphone'],
  consolas: ['ps5', 'ps4', 'playstation', 'xbox', 'nintendo', 'switch', 'steam deck', 'consola'],
  laptops: ['laptop', 'macbook', 'notebook', 'thinkpad', 'chromebook', 'ideapad', 'vivobook', 'pavilion'],
  tablets: ['ipad', 'tablet', 'galaxy tab', 'kindle'],
  audio: ['audifonos', 'airpods', 'bocina', 'soundcore', 'jbl', 'beats', 'buds', 'headphones', 'auriculares'],
  relojes: ['reloj', 'watch', 'smartwatch', 'casio', 'rolex', 'seiko', 'garmin'],
  tenis: ['tenis', 'jordan', 'nike', 'adidas', 'yeezy', 'new balance', 'converse', 'vans', 'sneakers'],
  ropa: ['playera', 'sudadera', 'chamarra', 'pantalon', 'jeans', 'camisa', 'vestido', 'gorra', 'hoodie'],
};
// Más específicas primero ("galaxy tab" es tablet aunque "galaxy" sea celular; "watch" antes que "iphone").
const ORDEN = ['tablets', 'relojes', 'laptops', 'audio', 'consolas', 'celulares', 'tenis', 'ropa'];

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

export function categoriaDe(texto, categoriaHistorial) {
  if (categoriaHistorial && CHECKLISTS[categoriaHistorial]) return categoriaHistorial;
  const t = ` ${normalizar(texto)} `;
  return ORDEN.find((c) => PISTAS[c].some((p) => t.includes(` ${p}`) || t.includes(p.replace(/\s/g, '')))) || null;
}
