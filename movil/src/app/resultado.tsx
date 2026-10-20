import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Calculator, ExternalLink, Globe, History, Search, Store, TrendingDown, TrendingUp, WifiOff, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CampoBusqueda } from '@/components/campo-busqueda';
import { CampoPesos, Hoja } from '@/components/hoja';
import { TarjetaAutenticidad, TarjetaInsight } from '@/components/ia';
import { PantallaVacia } from '@/components/pantalla-vacia';
import { ThemedText } from '@/components/themed-text';
import { AvisoEjemplo, Boton, Destacado, Miniatura, Pildora, Tarjeta } from '@/components/ui';
import { FUNCIONES } from '@/constants/funciones';
import { Fonts, IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import * as api from '@/datos/api';
import type { CapturaApi, OfertaApi } from '@/datos/api';
import { useArticulos } from '@/datos/articulos';
import { PASOS, useBusqueda, type Entrada, type Resultado as DatosResultado } from '@/datos/busqueda';
import { precioDeReventa, veredicto, type Veredicto } from '@/datos/decision';
import { fechaCorta, pesos } from '@/datos/formato';
import { guardarPendiente, leerPendiente } from '@/datos/pendientes';
import { NOMBRE_CONDICION, type Condicion } from '@/datos/tipos';
import { useTheme } from '@/hooks/use-theme';

const VISIBLES = 6;

/**
 * Resultado de una búsqueda por foto (`foto`), código de barras (`codigo`) o texto (`consulta`).
 * Nunca muestra un precio sin su fuente.
 */
export default function Resultado() {
  const p = useLocalSearchParams<{ consulta?: string; codigo?: string; foto?: string; extra?: string; pendiente?: string }>();
  // Búsqueda guardada sin señal que ya se hizo: se muestra su resultado sin volver a buscar.
  const guardada = p.pendiente ? leerPendiente(p.pendiente) : undefined;
  if (guardada?.resultado) {
    const extraGuardado = guardada.entrada.tipo === 'foto' ? JSON.stringify(guardada.entrada.extra ?? []) : undefined;
    return <VistaResultado r={guardada.resultado} entrada={guardada.entrada} extra={extraGuardado} />;
  }
  const entrada: Entrada = p.consulta
    ? { tipo: 'texto', consulta: p.consulta }
    : p.codigo
      ? { tipo: 'codigo', codigo: p.codigo }
      : { tipo: 'foto', uri: p.foto ?? '', extra: leerExtra(p.extra) };
  const clave = p.consulta ?? p.codigo ?? p.foto ?? '';
  return <Flujo key={`${entrada.tipo}:${clave}`} entrada={entrada} extra={p.extra} />;
}

function leerExtra(extra?: string): string[] {
  try {
    return extra ? (JSON.parse(extra) as string[]) : [];
  } catch {
    return [];
  }
}

function Flujo({ entrada, extra }: { entrada: Entrada; extra?: string }) {
  const { sonDeEjemplo } = useArticulos();
  const { paso, resultado, error, sinConexion } = useBusqueda(entrada, sonDeEjemplo);

  if (error) return <Falla error={error} entrada={entrada} sinConexion={sinConexion} />;
  if (!resultado) return <Procesando entrada={entrada} paso={paso} />;
  return <VistaResultado r={resultado} entrada={entrada} extra={extra} />;
}

function Procesando({ entrada, paso }: { entrada: Entrada; paso: number }) {
  const theme = useTheme();
  const pasos = PASOS[entrada.tipo];

  return (
    <SafeAreaView style={[styles.contenedor, styles.centrado, { backgroundColor: theme.fondo }]}>
      {entrada.tipo === 'foto' && entrada.uri ? (
        <Image source={{ uri: entrada.uri }} style={styles.procesandoFoto} contentFit="cover" />
      ) : (
        <ThemedText type="subtitulo" style={{ textAlign: 'center' }}>
          «{entrada.tipo === 'texto' ? entrada.consulta : entrada.tipo === 'codigo' ? entrada.codigo : ''}»
        </ThemedText>
      )}
      <View style={styles.pasos} accessibilityRole="progressbar" aria-valuenow={paso + 1} aria-valuemax={pasos.length}>
        {pasos.map((nombre, i) => (
          <View key={nombre} style={[styles.segmento, { backgroundColor: i <= paso ? theme.primario : theme.superficieAlta }]} />
        ))}
      </View>
      <ThemedText type="cuerpoFuerte" themeColor="textoSecundario" aria-live="polite">
        {pasos[paso]}…
      </ThemedText>
    </SafeAreaView>
  );
}

function Falla({ error, entrada, sinConexion }: { error: string; entrada: Entrada; sinConexion: boolean }) {
  const theme = useTheme();
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    setGuardando(true);
    await guardarPendiente(entrada);
    router.dismissAll();
    router.navigate('/buscar');
  };
  return (
    <SafeAreaView style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
      <BarraSuperior />
      <PantallaVacia Icono={sinConexion ? WifiOff : Search} titulo={sinConexion ? 'Sin señal' : 'No encontramos el artículo'} texto={error} />
      <View style={styles.falla}>
        {sinConexion ? (
          <View style={{ marginBottom: Spacing.lg }}>
            <Boton texto={guardando ? 'Guardando…' : 'Buscar cuando vuelva la señal'} onPress={guardar} />
          </View>
        ) : null}
        <CampoBusqueda
          etiqueta="Escribir el nombre o modelo"
          placeholder="Escribe el nombre o modelo"
          valorInicial={entrada.tipo === 'texto' ? entrada.consulta : ''}
          onBuscar={(consulta) => router.setParams({ consulta, codigo: undefined, foto: undefined })}
        />
      </View>
    </SafeAreaView>
  );
}

function BarraSuperior() {
  const theme = useTheme();
  return (
    <View style={styles.barraSuperior}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        onPress={() => router.dismissAll()}
        style={({ pressed }) => [styles.cerrar, { backgroundColor: theme.superficie, opacity: pressed ? 0.6 : 1 }]}>
        <X size={IconSize.md} color={theme.texto} />
      </Pressable>
      <ThemedText type="cuerpoFuerte">Resultado</ThemedText>
      <View style={styles.cerrar} />
    </View>
  );
}

function VistaResultado({ r, entrada, extra }: { r: DatosResultado; entrada: Entrada; extra?: string }) {
  const theme = useTheme();
  const { sonDeEjemplo } = useArticulos();

  // Lo que viste publicado se puede agregar aquí mismo y cuenta para la calculadora.
  const [capturas, setCapturas] = useState<CapturaApi[]>(r.capturas);
  const [producto, setProducto] = useState(r.producto);

  // Precio de venta para la calculadora: tus ventas, lo que viste publicado o usados en Google.
  const reventa = useMemo(() => precioDeReventa({ ...r, capturas }), [r, capturas]);
  const [venta, setVenta] = useState(reventa ? String(reventa.precio) : '');
  const [ganancia, setGanancia] = useState('800');
  const [piden, setPiden] = useState('');
  const maximo = (Number(venta) || 0) - (Number(ganancia) || 0);
  const decision = veredicto(Number(venta) || 0, maximo, Number(piden) || 0);
  const fuenteVenta = reventa && String(reventa.precio) === venta ? reventa.fuente : 'Escribe en cuánto lo venderías';

  const comprar = () =>
    router.push({
      pathname: '/registrar',
      params: {
        nombre: r.nombre,
        marca: r.marca ?? '',
        categoria: r.categoria ?? '',
        maximo: String(Math.max(maximo, 0)),
        precio: piden,
        foto: r.foto ?? '',
        extra: extra ?? '',
      },
    });

  return (
    <SafeAreaView edges={['top']} style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
      <BarraSuperior />

      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        {sonDeEjemplo ? <AvisoEjemplo /> : null}

        <CampoBusqueda
          etiqueta="Corregir el nombre o modelo"
          placeholder="¿No es? Corrige el nombre"
          onBuscar={(consulta) => router.setParams({ consulta, codigo: undefined, foto: undefined })}
        />

        <Tarjeta style={styles.sugerencia}>
          {r.foto ? (
            <Image source={{ uri: r.foto }} style={styles.fotoChica} contentFit="cover" />
          ) : (
            <Miniatura categoria={null} tamano="chica" />
          )}
          <View style={{ flex: 1, gap: Spacing.xs }}>
            <Destacado texto={origenTexto(r.origen)} />
            <ThemedText type="cuerpoFuerte">{r.nombre}</ThemedText>
            {r.marca || r.lanzamiento ? (
              <ThemedText type="chico" themeColor="textoTenue">
                {[r.marca, r.lanzamiento ? `Lanzado en ${r.lanzamiento}` : null].filter(Boolean).join(' · ')}
              </ThemedText>
            ) : null}
          </View>
        </Tarjeta>

        {r.alternativas.length ? (
          <View style={{ gap: Spacing.sm }}>
            <ThemedText type="chico" themeColor="textoSecundario">
              ¿No es? Prueba con:
            </ThemedText>
            <View style={styles.pildoras}>
              {r.alternativas.map((a) => (
                <Pildora
                  key={a}
                  texto={a.length > 40 ? `${a.slice(0, 40)}…` : a}
                  activa={false}
                  onPress={() => router.setParams({ consulta: a, codigo: undefined, foto: undefined })}
                />
              ))}
            </View>
          </View>
        ) : null}

        {r.avisos.map((a) => (
          <ThemedText key={a} type="chico" themeColor="textoSecundario">
            {a}
          </ThemedText>
        ))}

        <View style={styles.dosColumnas}>
          <Rango titulo="Nuevo" rango={r.nuevos?.rango ?? null} fuente="Google Shopping" />
          <Rango titulo="Usado" rango={r.usados?.rango ?? null} fuente="Google Shopping" />
        </View>

        {r.tusVentas ? (
          <Tarjeta style={{ gap: 2 }}>
            <View style={styles.tituloSeccion}>
              <History size={IconSize.sm} color={theme.textoSecundario} />
              <ThemedText type="cuerpoFuerte">Tus ventas de este artículo</ThemedText>
            </View>
            <ThemedText type="subtitulo" style={{ color: theme.dinero }}>
              {pesos(r.tusVentas.rango.mediana)}
            </ThemedText>
            <ThemedText type="chico" themeColor="textoTenue">
              {r.tusVentas.rango.n} {r.tusVentas.rango.n === 1 ? 'registro' : 'registros'} · {pesos(r.tusVentas.rango.min)} –{' '}
              {pesos(r.tusVentas.rango.max)}
              {r.tusVentas.diasMediana != null ? ` · se vende en ~${r.tusVentas.diasMediana} días` : ''}
            </ThemedText>
          </Tarjeta>
        ) : null}

        {r.mercadoLibre ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Ver en Mercado Libre"
            onPress={() => r.mercadoLibre && Linking.openURL(r.mercadoLibre.link)}>
            <Tarjeta style={{ gap: 2 }}>
              <View style={styles.tituloSeccion}>
                <ThemedText type="cuerpoFuerte" style={{ flex: 1 }}>
                  Mercado Libre (catálogo)
                </ThemedText>
                <ExternalLink size={14} color={theme.textoTenue} />
              </View>
              <ThemedText type="subtitulo">
                {pesos(r.mercadoLibre.precios[0].precio)} – {pesos(r.mercadoLibre.precios[r.mercadoLibre.precios.length - 1].precio)}
              </ThemedText>
              <ThemedText type="chico" themeColor="textoTenue">
                {r.mercadoLibre.total} {r.mercadoLibre.total === 1 ? 'publicación' : 'publicaciones'} del catálogo
              </ThemedText>
            </Tarjeta>
          </Pressable>
        ) : null}

        {FUNCIONES.insight ? (
          <TarjetaInsight
            nombre={r.nombre}
            nuevo={r.nuevos?.rango?.mediana}
            usado={r.usados?.rango?.mediana}
            tus_ventas={r.tusVentas?.rango.mediana}
          />
        ) : null}
        {FUNCIONES.autenticidad && r.foto ? <TarjetaAutenticidad foto={r.foto} /> : null}

        <Tarjeta style={styles.calculadora}>
          <View style={styles.tituloSeccion}>
            <Calculator size={IconSize.sm} color={theme.textoSecundario} />
            <ThemedText type="cuerpoFuerte">¿Cuánto pagar como máximo?</ThemedText>
          </View>
          <Campo etiqueta="Lo venderías en" valor={venta} onCambio={setVenta} ayuda={fuenteVenta} />
          <Campo etiqueta="Ganancia que buscas" valor={ganancia} onCambio={setGanancia} />
          <View style={[styles.maximo, { backgroundColor: theme.superficieAlta }]}>
            <ThemedText themeColor="textoSecundario">Paga como máximo</ThemedText>
            <ThemedText type="titulo" style={{ color: maximo > 0 ? theme.dinero : theme.peligro }}>
              {Number(venta) > 0 ? (maximo > 0 ? pesos(maximo) : 'No conviene') : '—'}
            </ThemedText>
          </View>
          <Campo etiqueta="¿Cuánto piden?" valor={piden} onCambio={setPiden} ayuda="Escríbelo y te digo si conviene" />
          {decision ? <TarjetaVeredicto v={decision} /> : null}
        </Tarjeta>

        <SeccionCapturas
          nombre={r.nombre}
          marca={r.marca}
          capturas={capturas}
          producto={producto}
          deEjemplo={sonDeEjemplo}
          onGuardada={(c, p) => {
            setCapturas((lista) => [c, ...lista]);
            setProducto(p);
            // Si la calculadora no tenía precio de tus ventas, se actualiza con la nueva mediana.
            if (!r.tusVentas) {
              const nueva = precioDeReventa({ ...r, capturas: [c, ...capturas] });
              if (nueva) setVenta(String(nueva.precio));
            }
          }}
        />

        {r.historial.length > 1 ? <SeccionHistorial historial={r.historial} /> : null}

        {r.ebay ? <SeccionEbay ebay={r.ebay} /> : null}

        {r.nuevos ? <ListaOfertas titulo="Nuevos" ofertas={r.nuevos.ofertas} /> : null}
        {r.usados ? <ListaOfertas titulo="Usados y reacondicionados" ofertas={r.usados.ofertas} /> : null}
        {r.lens.length ? (
          <ListaOfertas titulo="Vistos por Google Lens" ofertas={r.lens.map((o) => ({ ...o, usado: false, condicion: '', miniatura: null }))} />
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.acciones, { borderTopColor: theme.borde, backgroundColor: theme.fondo }]}>
        <View style={{ flex: 1 }}>
          <Boton texto={entrada.tipo === 'texto' ? 'Buscar otro' : 'Otra foto'} variante="secundario" onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1 }}>
          <Boton texto="Lo compré" onPress={comprar} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

function TarjetaVeredicto({ v }: { v: Veredicto }) {
  const theme = useTheme();
  const fondo = v.tipo === 'compra' ? theme.dinero : v.tipo === 'regatea' ? theme.destacado : theme.peligro;
  const color = v.tipo === 'compra' ? theme.sobreDinero : v.tipo === 'regatea' ? theme.sobreDestacado : theme.fondo;
  return (
    <View accessibilityRole="summary" aria-live="polite" style={[styles.maximo, { backgroundColor: fondo }]}>
      <ThemedText type="titulo" style={{ color }}>
        {v.titulo}
      </ThemedText>
      <ThemedText type="cuerpoFuerte" style={{ color }}>
        {v.detalle}
      </ThemedText>
    </View>
  );
}

const FUENTES: { valor: CapturaApi['fuente']; texto: string }[] = [
  { valor: 'marketplace', texto: 'Marketplace' },
  { valor: 'ml_usado', texto: 'Mercado Libre' },
  { valor: 'otro', texto: 'Otro' },
];
const CONDICIONES: Condicion[] = ['sellado', 'como_nuevo', 'usado_bueno', 'con_detalles'];
const nombreFuente = (f: CapturaApi['fuente']) => FUENTES.find((x) => x.valor === f)?.texto ?? 'Otro';

/** Precios de usado que viste publicados (Marketplace, etc.): se anotan a mano, nunca automático. */
function SeccionCapturas({
  nombre,
  marca,
  capturas,
  producto,
  deEjemplo,
  onGuardada,
}: {
  nombre: string;
  marca: string | null;
  capturas: CapturaApi[];
  producto: { id: number; nombre: string } | null;
  deEjemplo: boolean;
  onGuardada: (c: CapturaApi, producto: { id: number; nombre: string } | null) => void;
}) {
  const theme = useTheme();
  const [abierta, setAbierta] = useState(false);
  const [precio, setPrecio] = useState('');
  const [fuente, setFuente] = useState<CapturaApi['fuente']>('marketplace');
  const [condicion, setCondicion] = useState<Condicion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const precios = capturas.map((c) => c.precio).sort((a, b) => a - b);

  const guardar = async () => {
    if (!(Number(precio) > 0)) return setError('Escribe el precio que viste.');
    setGuardando(true);
    setError(null);
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
    if (deEjemplo) {
      onGuardada({ id: Date.now(), precio: Number(precio), fecha: hoy, fuente, condicion, url: null }, producto);
    } else {
      // El precio se liga a tu catálogo: si el artículo aún no está, se agrega con este nombre.
      let p = producto;
      if (!p) {
        const creado = await api.crearProducto({ nombre, marca });
        if (!creado.ok) {
          setGuardando(false);
          return setError(creado.error);
        }
        p = { id: creado.datos.producto.id, nombre: creado.datos.producto.nombre };
      }
      const r = await api.crearCaptura({ producto_id: p.id, precio: Number(precio), fuente, condicion });
      if (!r.ok) {
        setGuardando(false);
        return setError(r.error);
      }
      onGuardada(r.datos.captura, p);
    }
    setGuardando(false);
    setPrecio('');
    setAbierta(false);
  };

  return (
    <Tarjeta style={{ gap: Spacing.sm }}>
      <View style={styles.tituloSeccion}>
        <Store size={IconSize.sm} color={theme.textoSecundario} />
        <ThemedText type="cuerpoFuerte" style={{ flex: 1 }}>
          Precios que viste publicados
        </ThemedText>
      </View>
      {precios.length ? (
        <>
          <ThemedText type="subtitulo">{pesos(precios[Math.floor(precios.length / 2)])}</ThemedText>
          <ThemedText type="chico" themeColor="textoTenue">
            {precios.length} {precios.length === 1 ? 'precio' : 'precios'}
            {precios.length > 1 ? ` · ${pesos(precios[0])} – ${pesos(precios[precios.length - 1])}` : ''} · anotados por ti
          </ThemedText>
          {capturas.slice(0, 4).map((c) => (
            <View key={c.id} style={styles.filaCaptura}>
              <ThemedText type="chico" themeColor="textoSecundario" style={{ flex: 1 }}>
                {[nombreFuente(c.fuente), c.condicion ? NOMBRE_CONDICION[c.condicion as Condicion] : null, fechaCorta(c.fecha)]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
              <ThemedText type="cuerpoFuerte">{pesos(c.precio)}</ThemedText>
            </View>
          ))}
        </>
      ) : (
        <ThemedText type="chico" themeColor="textoSecundario">
          ¿Lo viste en Marketplace? Anota el precio: es la mejor referencia de lo que piden en tu ciudad.
        </ThemedText>
      )}
      <Boton texto="Anotar un precio que viste" variante="secundario" onPress={() => setAbierta(true)} />

      <Hoja visible={abierta} titulo="Precio que viste" onCerrar={() => setAbierta(false)}>
        <CampoPesos etiqueta="¿En cuánto lo tienen publicado?" valor={precio} onCambio={setPrecio} autoFocus />
        <View style={{ gap: Spacing.xs }}>
          <ThemedText type="chico" themeColor="textoSecundario">
            Dónde lo viste
          </ThemedText>
          <View style={styles.pildoras}>
            {FUENTES.map((f) => (
              <Pildora key={f.valor} texto={f.texto} activa={fuente === f.valor} onPress={() => setFuente(f.valor)} />
            ))}
          </View>
        </View>
        <View style={{ gap: Spacing.xs }}>
          <ThemedText type="chico" themeColor="textoSecundario">
            Condición (opcional)
          </ThemedText>
          <View style={styles.pildoras}>
            {CONDICIONES.map((c) => (
              <Pildora key={c} texto={NOMBRE_CONDICION[c]} activa={condicion === c} onPress={() => setCondicion(condicion === c ? null : c)} />
            ))}
          </View>
        </View>
        {error ? (
          <ThemedText type="chico" accessibilityRole="alert" style={{ color: theme.peligro }}>
            {error}
          </ThemedText>
        ) : null}
        <Boton texto={guardando ? 'Guardando…' : 'Guardar'} onPress={guardar} />
      </Hoja>
    </Tarjeta>
  );
}

/** Cómo ha cambiado el precio en búsquedas anteriores (Google Shopping, una por día). */
function SeccionHistorial({ historial }: { historial: api.PrecioVisto[] }) {
  const theme = useTheme();
  const [actual, ...antes] = historial;
  const anterior = antes.find((h) => (actual.usado && h.usado) || (actual.nuevo && h.nuevo)) ?? antes[0];
  const cambio = (hoy: number | null, antes: number | null) => (hoy && antes ? hoy - antes : null);
  const usado = cambio(actual.usado, anterior.usado);
  const nuevo = cambio(actual.nuevo, anterior.nuevo);
  const principal = usado ?? nuevo;
  const Icono = (principal ?? 0) < 0 ? TrendingDown : TrendingUp;
  const texto = (titulo: string, d: number | null) =>
    d == null ? null : `${titulo} ${d === 0 ? 'igual' : `${d > 0 ? 'subió' : 'bajó'} ${pesos(Math.abs(d))}`}`;

  return (
    <Tarjeta style={{ gap: Spacing.xs }}>
      <View style={styles.tituloSeccion}>
        <Icono size={IconSize.sm} color={theme.textoSecundario} />
        <ThemedText type="cuerpoFuerte">Cómo ha cambiado el precio</ThemedText>
      </View>
      <ThemedText>
        {[texto('Usado', usado), texto('Nuevo', nuevo)].filter(Boolean).join(' · ') || 'Sin datos para comparar'}
      </ThemedText>
      <ThemedText type="chico" themeColor="textoTenue">
        Desde el {fechaCorta(anterior.fecha)}. Mediana de Google Shopping en tus búsquedas ({historial.length}{' '}
        {historial.length === 1 ? 'día' : 'días'}).
      </ThemedText>
    </Tarjeta>
  );
}

/** Referencia internacional: aparte, abajo, y fuera de la calculadora. */
function SeccionEbay({ ebay }: { ebay: NonNullable<DatosResultado['ebay']> }) {
  const theme = useTheme();
  const [abierta, setAbierta] = useState(false);
  const visibles = abierta ? ebay.ofertas : ebay.ofertas.slice(0, 4);
  return (
    <Tarjeta style={{ gap: Spacing.sm }}>
      <View style={styles.tituloSeccion}>
        <Globe size={IconSize.sm} color={theme.textoSecundario} />
        <ThemedText type="cuerpoFuerte" style={{ flex: 1 }}>
          Referencia internacional (eBay)
        </ThemedText>
      </View>
      {ebay.rango ? (
        <>
          <ThemedText type="subtitulo">{pesos(ebay.rango.mediana)}</ThemedText>
          <ThemedText type="chico" themeColor="textoTenue">
            Usados, {pesos(ebay.rango.min)} – {pesos(ebay.rango.max)} · {ebay.total.toLocaleString('es-MX')} publicaciones con envío a México
          </ThemedText>
        </>
      ) : null}
      {visibles.map((o, i) => (
        <Pressable
          key={`${o.link}-${i}`}
          accessibilityRole="link"
          accessibilityLabel={`${o.titulo}, ${pesos(o.precio)}${o.aviso ? `, ${o.aviso}` : ''}`}
          onPress={() => Linking.openURL(o.link)}
          style={({ pressed }) => [styles.ofertaEbay, { opacity: pressed ? 0.7 : o.aviso ? 0.55 : 1 }]}>
          {o.imagen ? <Image source={{ uri: o.imagen }} style={styles.imagenEbay} contentFit="cover" /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText type="chico" numberOfLines={2}>
              {o.titulo}
            </ThemedText>
            <ThemedText type="etiqueta" themeColor="textoTenue">
              {[o.dolares ? `${o.dolares} USD` : null, o.pais ? `desde ${o.pais}` : null, o.aviso].filter(Boolean).join(' · ')}
            </ThemedText>
          </View>
          <ThemedText type="cuerpoFuerte">{pesos(o.precio)}</ThemedText>
        </Pressable>
      ))}
      {ebay.ofertas.length > 4 ? (
        <Boton texto={abierta ? 'Ver menos' : `Ver las ${ebay.ofertas.length}`} variante="secundario" onPress={() => setAbierta((v) => !v)} />
      ) : null}
      <ThemedText type="etiqueta" themeColor="textoTenue">
        Es lo que piden en eBay, no lo que se vendió. Precio en pesos convertido por eBay
        {ebay.tipoCambio ? ` (≈ $${ebay.tipoCambio} por dólar)` : ''}; no cuenta para la calculadora.
      </ThemedText>
    </Tarjeta>
  );
}

function origenTexto(origen: DatosResultado['origen']) {
  if (origen === 'etiqueta') return 'LEÍDO EN LA ETIQUETA';
  if (origen === 'codigo') return 'POR CÓDIGO DE BARRAS';
  if (origen === 'lens') return 'SUGERIDO POR LA FOTO';
  if (origen === 'ejemplo') return 'SUGERIDO';
  return 'BUSCADO';
}

function Rango({ titulo, rango, fuente }: { titulo: string; rango: { min: number; mediana: number; max: number } | null; fuente: string }) {
  const theme = useTheme();
  return (
    <Tarjeta style={{ flex: 1, gap: 2 }}>
      <ThemedText type="chico" themeColor="textoSecundario">
        {titulo}, precio típico
      </ThemedText>
      {rango ? (
        <>
          <ThemedText type="subtitulo" style={{ color: theme.dinero }}>
            {pesos(Math.round(rango.mediana))}
          </ThemedText>
          <ThemedText type="chico" themeColor="textoTenue">
            {pesos(rango.min)} – {pesos(rango.max)}
          </ThemedText>
        </>
      ) : (
        <ThemedText type="cuerpoFuerte" themeColor="textoTenue">
          Sin datos
        </ThemedText>
      )}
      <ThemedText type="etiqueta" themeColor="textoTenue">
        {fuente}
      </ThemedText>
    </Tarjeta>
  );
}

function Campo({ etiqueta, valor, onCambio, ayuda }: { etiqueta: string; valor: string; onCambio: (v: string) => void; ayuda?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.xs }}>
      <ThemedText type="chico" themeColor="textoSecundario">
        {etiqueta}
      </ThemedText>
      <View style={[styles.campo, { borderColor: theme.borde, backgroundColor: theme.fondo }]}>
        <ThemedText themeColor="textoTenue">$</ThemedText>
        <TextInput
          accessibilityLabel={etiqueta}
          value={valor}
          onChangeText={(t) => onCambio(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          inputMode="numeric"
          style={[styles.entrada, { color: theme.texto }]}
        />
      </View>
      {ayuda ? (
        <ThemedText type="etiqueta" themeColor="textoTenue">
          {ayuda}
        </ThemedText>
      ) : null}
    </View>
  );
}

function ListaOfertas({ titulo, ofertas }: { titulo: string; ofertas: OfertaApi[] }) {
  const theme = useTheme();
  const [todas, setTodas] = useState(false);
  if (!ofertas.length) return null;
  const visibles = todas ? ofertas : ofertas.slice(0, VISIBLES);

  return (
    <View style={{ gap: Spacing.sm }}>
      <ThemedText type="cuerpoFuerte">
        {titulo} ({ofertas.length})
      </ThemedText>
      {visibles.map((o, i) => (
        <Pressable
          key={`${o.link}-${i}`}
          accessibilityRole="link"
          accessibilityLabel={`${o.titulo}, ${o.tienda}, ${pesos(o.precio)}${o.aviso ? `, ${o.aviso}` : ''}`}
          onPress={() => Linking.openURL(o.link)}
          style={({ pressed }) => [styles.oferta, { backgroundColor: theme.superficie, opacity: pressed ? 0.7 : o.aviso ? 0.55 : 1 }]}>
          {o.miniatura ? (
            <Image source={{ uri: o.miniatura }} style={[styles.miniaturaOferta, { backgroundColor: theme.superficieAlta }]} contentFit="cover" />
          ) : null}
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText numberOfLines={1}>{o.titulo}</ThemedText>
            <View style={styles.tienda}>
              <ThemedText type="chico" themeColor="textoTenue" numberOfLines={1} style={{ flexShrink: 1 }}>
                {o.tienda}
                {o.aviso ? ` · ${o.aviso}` : ''}
              </ThemedText>
              <ExternalLink size={14} color={theme.textoTenue} />
            </View>
          </View>
          <ThemedText type="precio">{pesos(o.precio)}</ThemedText>
        </Pressable>
      ))}
      {ofertas.length > VISIBLES ? (
        <Boton texto={todas ? 'Ver menos' : `Ver los ${ofertas.length}`} variante="secundario" onPress={() => setTodas((v) => !v)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  centrado: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
  },
  procesandoFoto: {
    width: 180,
    height: 180,
    borderRadius: Radius.lg,
  },
  pasos: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
    maxWidth: 320,
  },
  segmento: {
    flex: 1,
    height: 6,
    borderRadius: Radius.pildora,
  },
  falla: {
    padding: Spacing.lg,
  },
  barraSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  cerrar: {
    width: TocableMinimo,
    height: TocableMinimo,
    borderRadius: Radius.pildora,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contenido: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  sugerencia: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  fotoChica: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
  },
  pildoras: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  dosColumnas: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  calculadora: {
    gap: Spacing.md,
  },
  tituloSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: TocableMinimo,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  entrada: {
    flex: 1,
    fontFamily: Fonts.seminegrita,
    fontSize: 16,
    minHeight: TocableMinimo,
  },
  maximo: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 2,
  },
  oferta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: TocableMinimo + 16,
  },
  miniaturaOferta: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
  },
  filaCaptura: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  ofertaEbay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: TocableMinimo,
  },
  imagenEbay: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
  },
  tienda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  acciones: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
