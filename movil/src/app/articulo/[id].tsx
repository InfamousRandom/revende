import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArchiveX,
  Camera,
  ChevronLeft,
  CircleCheck,
  Clock,
  EllipsisVertical,
  Megaphone,
  Pencil,
  ImagePlus,
  Images,
  RotateCcw,
  Star,
  Tag,
  Trash2,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FotosOrdenables } from '@/components/fotos-ordenables';
import { CampoPesos, Hoja, OpcionMenu } from '@/components/hoja';
import { ThemedText } from '@/components/themed-text';
import { AvisoEjemplo, Boton, EtiquetaEstado, Miniatura, Pildora, Tarjeta } from '@/components/ui';
import { Fonts, IconSize, Radius, Spacing, TocableMinimo } from '@/constants/theme';
import * as api from '@/datos/api';
import { hoy, useArticulo, useArticulos } from '@/datos/articulos';
import { useEmparejado } from '@/datos/emparejado';
import { descargarFoto } from '@/datos/editor';
import { prepararParaGuardar } from '@/datos/escaneo';
import { diasEntre, fechaCorta, pesos, pesosConSigno } from '@/datos/formato';
import { borradorAnuncio, diasSinVender, diasTipicosDeVenta, umbralEstancado, useValorInventario } from '@/datos/inventario';
import {
  NOMBRE_CANAL,
  NOMBRE_CONDICION,
  estadoDe,
  gananciaDe,
  nombreCategoria,
  type Canal,
  type Foto,
} from '@/datos/tipos';
import { useTheme } from '@/hooks/use-theme';

type HojaAbierta = null | 'publicar' | 'vender' | 'menu' | 'borrar' | 'agregarFoto' | 'anuncio' | { foto: Foto };
const CANALES: Canal[] = ['en_persona', 'marketplace', 'otro'];

export default function FichaArticulo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const articulo = useArticulo(Number(id));
  const { articulos, sonDeEjemplo, actualizar, borrar, refrescar } = useArticulos();
  const valores = useValorInventario();
  const { codigo } = useEmparejado();
  const theme = useTheme();
  const [hoja, setHoja] = useState<HojaAbierta>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [precio, setPrecio] = useState('');
  const [canal, setCanal] = useState<Canal>('en_persona');
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [anuncio, setAnuncio] = useState({ titulo: '', descripcion: '' });
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (sonDeEjemplo || !articulo) return;
    let vigente = true;
    void api.listarFotos(articulo.id).then((r) => {
      if (vigente && r.ok) setFotos(r.datos.fotos);
    });
    return () => {
      vigente = false;
    };
  }, [sonDeEjemplo, articulo?.id, articulo?.portadaId, articulo?.fotos]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!articulo) {
    return (
      <SafeAreaView style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
        <BotonCircular etiqueta="Regresar" Icono={ChevronLeft} onPress={regresar} />
        <ThemedText style={styles.margen}>No encontramos este artículo.</ThemedText>
      </SafeAreaView>
    );
  }

  const estado = estadoDe(articulo);
  const ganancia = gananciaDe(articulo);
  const valorHoy = valores.get(articulo.id);
  const dias = diasSinVender(articulo);
  const estancado = dias != null && dias > umbralEstancado(articulos);
  const tipico = diasTipicosDeVenta(articulos);

  const abrirAnuncio = () => {
    setAnuncio(borradorAnuncio(articulo, articulo.precioPublicado ?? valorHoy?.precio ?? null));
    setCopiado(false);
    setHoja('anuncio');
  };
  const textoAnuncio = `${anuncio.titulo}\n\n${anuncio.descripcion}`;
  const compartirTexto = async () => {
    try {
      await Share.share({ title: anuncio.titulo, message: textoAnuncio });
    } catch {
      setError('No se pudo abrir el menú para compartir.');
    }
  };
  // Android solo comparte un archivo a la vez: va la foto de portada y el texto queda copiado
  // para pegarlo en la descripción.
  const compartirConFoto = async () => {
    const portada = fotos[0];
    if (!portada) return compartirTexto();
    setGuardando(true);
    setError(null);
    try {
      await Clipboard.setStringAsync(textoAnuncio);
      const extension = portada.tipo === 'image/png' ? '.png' : portada.tipo === 'image/webp' ? '.webp' : '.jpg';
      const archivo = await descargarFoto(portada.id, codigo, extension);
      if (!(await Sharing.isAvailableAsync())) throw new Error('sin compartir');
      setCopiado(true);
      await Sharing.shareAsync(archivo, { mimeType: portada.tipo, dialogTitle: anuncio.titulo });
    } catch {
      setError('No se pudo compartir la foto. Prueba con «Solo el texto».');
    } finally {
      setGuardando(false);
    }
  };
  const cerrar = () => {
    setHoja(null);
    setError(null);
  };

  const guardar = async (cambios: api.CambiosOperacion) => {
    setGuardando(true);
    const r = await actualizar(articulo.id, cambios);
    setGuardando(false);
    if (r.ok) cerrar();
    else setError(r.error);
  };

  const abrirPublicar = () => {
    setPrecio(articulo.precioPublicado ? String(articulo.precioPublicado) : '');
    setHoja('publicar');
  };
  const abrirVender = () => {
    setPrecio(articulo.precioPublicado ? String(articulo.precioPublicado) : '');
    setCanal('en_persona');
    setHoja('vender');
  };

  const elegirFoto = async (origen: 'camara' | 'galeria') => {
    setHoja(null);
    if (origen === 'camara') {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) {
        setError('Para tomar fotos, permite el uso de la cámara en los ajustes del celular.');
        return;
      }
    }
    const r =
      origen === 'camara'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsMultipleSelection: true,
            selectionLimit: 10,
          });
    if (r.canceled || !r.assets.length) return;
    // Una foto: se abre en el editor (recortar, girar, quitar fondo). Varias: se guardan todas.
    if (r.assets.length === 1) {
      router.push({ pathname: '/editor', params: { operacion: String(articulo.id), uri: r.assets[0].uri } });
      return;
    }
    setSubiendo(true);
    for (const a of r.assets) {
      const subida = await api.subirFoto(articulo.id, await prepararParaGuardar(a.uri), 'image/jpeg');
      if (!subida.ok) {
        setError(subida.error);
        break;
      }
    }
    setSubiendo(false);
    await refrescar(articulo.id);
  };

  // Se ve el orden nuevo al instante; si el Worker falla, se regresa al anterior.
  const reordenar = async (ids: number[]) => {
    const antes = fotos;
    setFotos(ids.map((id) => fotos.find((f) => f.id === id)).filter((f): f is Foto => Boolean(f)));
    const r = await api.ordenarFotos(articulo.id, ids);
    if (!r.ok) {
      setFotos(antes);
      setError(r.error);
      return;
    }
    setFotos(r.datos.fotos);
    await refrescar(articulo.id);
  };

  const accionFoto = async (accion: 'portada' | 'borrar', foto: Foto) => {
    setHoja(null);
    const r = accion === 'portada' ? await api.hacerPortada(foto.id) : await api.borrarFoto(foto.id);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setFotos(r.datos.fotos);
    await refrescar(articulo.id);
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.contenedor, { backgroundColor: theme.fondo }]}>
      <View style={styles.barraSuperior}>
        <BotonCircular etiqueta="Regresar" Icono={ChevronLeft} onPress={regresar} />
        <BotonCircular etiqueta="Más opciones" Icono={EllipsisVertical} onPress={() => setHoja('menu')} />
      </View>

      <ScrollView contentContainerStyle={styles.contenido}>
        {sonDeEjemplo ? <AvisoEjemplo /> : null}

        <View style={styles.margen}>
          <Miniatura categoria={articulo.categoria} portadaId={articulo.portadaId} />
        </View>

        {!sonDeEjemplo ? (
          <FotosOrdenables fotos={fotos} codigo={codigo} onTocar={(f) => setHoja({ foto: f })} onReordenar={reordenar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Agregar foto"
              disabled={subiendo}
              onPress={() => setHoja('agregarFoto')}
              style={[styles.foto, styles.agregarFoto, { borderColor: theme.borde }]}>
              {subiendo ? <ActivityIndicator color={theme.primario} /> : <ImagePlus size={IconSize.md} color={theme.textoSecundario} />}
            </Pressable>
          </FotosOrdenables>
        ) : null}

        <View style={[styles.margen, styles.encabezado]}>
          <EtiquetaEstado estado={estado} />
          <ThemedText type="titulo" accessibilityRole="header">
            {articulo.nombre}
          </ThemedText>
          <ThemedText themeColor="textoSecundario">
            {[articulo.marca, nombreCategoria(articulo.categoria), articulo.condicion && NOMBRE_CONDICION[articulo.condicion]]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        </View>

        {error && !hoja ? (
          <ThemedText type="chico" accessibilityRole="alert" style={[styles.margen, { color: theme.peligro }]}>
            {error}
          </ThemedText>
        ) : null}

        {estancado ? (
          <Tarjeta style={[styles.margen, styles.aviso, { borderColor: theme.destacado }]}>
            <Clock size={IconSize.sm} color={theme.texto} />
            <ThemedText style={{ flex: 1 }}>
              Lleva {dias} días sin venderse
              {tipico != null ? `; normalmente vendes en ~${tipico}` : ''}. Considera bajarle el precio o publicarlo en otro lado.
            </ThemedText>
          </Tarjeta>
        ) : null}

        {valorHoy && estado !== 'vendido' && estado !== 'descartado' ? (
          <Tarjeta style={[styles.margen, { gap: 2 }]}>
            <ThemedText themeColor="textoSecundario">Vale hoy</ThemedText>
            <ThemedText type="subtitulo">{pesos(valorHoy.precio)}</ThemedText>
            <ThemedText type="chico" themeColor="textoTenue">
              {valorHoy.fuente === 'publicado'
                ? 'Precio en que lo publicaste'
                : `Mediana de usados en Google Shopping${valorHoy.fecha ? ` (${fechaCorta(valorHoy.fecha)})` : ''}`}
              {articulo.precioCompra != null ? ` · pagaste ${pesos(articulo.precioCompra)}` : ''}
            </ThemedText>
          </Tarjeta>
        ) : null}

        {estado === 'inventario' || estado === 'publicado' ? (
          <View style={styles.margen}>
            <Boton texto="Crear anuncio" variante="secundario" Icono={Megaphone} onPress={abrirAnuncio} />
          </View>
        ) : null}

        {ganancia != null ? (
          <Tarjeta style={styles.margen}>
            <ThemedText themeColor="textoSecundario">Ganancia</ThemedText>
            <ThemedText type="titulo" style={{ color: ganancia >= 0 ? theme.dinero : theme.peligro }}>
              {pesosConSigno(ganancia)}
            </ThemedText>
            {articulo.fechaVenta && articulo.fechaCompra ? (
              <ThemedText type="chico" themeColor="textoTenue">
                Vendido en {diasEntre(articulo.fechaCompra, articulo.fechaVenta)} días
              </ThemedText>
            ) : null}
          </Tarjeta>
        ) : null}

        <Tarjeta style={[styles.margen, styles.filas]}>
          {articulo.precioCompra != null && articulo.fechaCompra ? (
            <Fila
              titulo="Compra"
              valor={pesos(articulo.precioCompra)}
              detalle={[fechaCorta(articulo.fechaCompra), articulo.lugarCompra].filter(Boolean).join(' · ')}
            />
          ) : null}
          {articulo.precioPublicado && articulo.fechaPublicado ? (
            <Fila titulo="Publicado" valor={pesos(articulo.precioPublicado)} detalle={fechaCorta(articulo.fechaPublicado)} />
          ) : null}
          {articulo.precioVenta != null && articulo.fechaVenta ? (
            <Fila
              titulo="Venta"
              valor={pesos(articulo.precioVenta)}
              detalle={[fechaCorta(articulo.fechaVenta), articulo.canal && NOMBRE_CANAL[articulo.canal]].filter(Boolean).join(' · ')}
            />
          ) : null}
          {articulo.fechaDescartado ? <Fila titulo="Descartado" valor="—" detalle={fechaCorta(articulo.fechaDescartado)} /> : null}
        </Tarjeta>

        {articulo.notas ? (
          <Tarjeta style={styles.margen}>
            <ThemedText type="chico" themeColor="textoTenue">
              Notas
            </ThemedText>
            <ThemedText>{articulo.notas}</ThemedText>
          </Tarjeta>
        ) : null}
      </ScrollView>

      {estado === 'inventario' || estado === 'publicado' ? (
        <SafeAreaView edges={['bottom']} style={[styles.acciones, { borderTopColor: theme.borde, backgroundColor: theme.fondo }]}>
          <View style={{ flex: 1 }}>
            <Boton
              texto={estado === 'publicado' ? 'Cambiar precio' : 'Publicado'}
              variante="secundario"
              Icono={Tag}
              onPress={abrirPublicar}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Boton texto="Lo vendí" Icono={CircleCheck} onPress={abrirVender} />
          </View>
        </SafeAreaView>
      ) : null}

      <Hoja visible={hoja === 'publicar'} titulo="¿En cuánto lo publicaste?" onCerrar={cerrar}>
        <CampoPesos etiqueta="Precio publicado" valor={precio} onCambio={setPrecio} autoFocus />
        <ErrorHoja error={error} />
        <Boton
          texto={guardando ? 'Guardando…' : 'Guardar'}
          onPress={() => (Number(precio) > 0 ? guardar({ precio_publicado: Number(precio) }) : setError('Escribe el precio.'))}
        />
      </Hoja>

      <Hoja visible={hoja === 'vender'} titulo="¿En cuánto lo vendiste?" onCerrar={cerrar}>
        <CampoPesos etiqueta="Precio de venta" valor={precio} onCambio={setPrecio} autoFocus />
        <View style={{ gap: Spacing.xs }}>
          <ThemedText type="chico" themeColor="textoSecundario">
            Dónde se vendió
          </ThemedText>
          <View style={styles.pildoras}>
            {CANALES.map((c) => (
              <Pildora key={c} texto={NOMBRE_CANAL[c]} activa={canal === c} onPress={() => setCanal(c)} />
            ))}
          </View>
        </View>
        <ErrorHoja error={error} />
        <Boton
          texto={guardando ? 'Guardando…' : 'Guardar venta'}
          onPress={() =>
            Number(precio) > 0 ? guardar({ precio_venta: Number(precio), canal, fecha_descartado: null }) : setError('Escribe el precio.')
          }
        />
      </Hoja>

      <Hoja visible={hoja === 'anuncio'} titulo="Anuncio" onCerrar={cerrar}>
        <EntradaAnuncio etiqueta="Título" valor={anuncio.titulo} onCambio={(titulo) => setAnuncio((a) => ({ ...a, titulo }))} />
        <EntradaAnuncio
          etiqueta="Descripción"
          valor={anuncio.descripcion}
          onCambio={(descripcion) => setAnuncio((a) => ({ ...a, descripcion }))}
          multilinea
        />
        {copiado ? (
          <ThemedText type="chico" style={{ color: theme.dinero }}>
            El texto quedó copiado: pégalo en la descripción del anuncio.
          </ThemedText>
        ) : (
          <ThemedText type="chico" themeColor="textoTenue">
            {fotos.length
              ? 'Se comparte la foto de portada y el texto queda copiado para pegarlo.'
              : 'Este artículo no tiene fotos; se comparte solo el texto.'}
          </ThemedText>
        )}
        <ErrorHoja error={error} />
        {fotos.length ? (
          <>
            <Boton texto={guardando ? 'Preparando…' : 'Compartir con foto'} Icono={Megaphone} onPress={compartirConFoto} />
            <Boton texto="Solo el texto" variante="secundario" onPress={compartirTexto} />
          </>
        ) : (
          <Boton texto="Compartir" Icono={Megaphone} onPress={compartirTexto} />
        )}
      </Hoja>

      <Hoja visible={hoja === 'menu'} titulo="Opciones" onCerrar={cerrar}>
        {estado === 'publicado' ? (
          <OpcionMenu texto="Quitar de publicado" Icono={RotateCcw} onPress={() => guardar({ precio_publicado: null, fecha_publicado: null })} />
        ) : null}
        {estado === 'vendido' ? (
          <OpcionMenu texto="Quitar la venta" Icono={RotateCcw} onPress={() => guardar({ precio_venta: null, fecha_venta: null, canal: null })} />
        ) : null}
        {estado === 'descartado' ? (
          <OpcionMenu texto="Regresar a inventario" Icono={RotateCcw} onPress={() => guardar({ fecha_descartado: null })} />
        ) : null}
        {estado === 'inventario' || estado === 'publicado' ? (
          <OpcionMenu texto="Descartar (perdido o para piezas)" Icono={ArchiveX} onPress={() => guardar({ fecha_descartado: hoy() })} />
        ) : null}
        <OpcionMenu texto="Borrar del historial" Icono={Trash2} peligro onPress={() => setHoja('borrar')} />
        <ErrorHoja error={error} />
      </Hoja>

      <Hoja visible={hoja === 'borrar'} titulo="¿Borrar este artículo?" onCerrar={cerrar}>
        <ThemedText themeColor="textoSecundario">
          Se borra del historial con sus fotos y no se puede deshacer. Si solo ya no lo tienes, mejor usa «Descartar».
        </ThemedText>
        <ErrorHoja error={error} />
        <OpcionMenu
          texto="Sí, borrar"
          Icono={Trash2}
          peligro
          onPress={async () => {
            const r = await borrar(articulo.id);
            if (r.ok) {
              setHoja(null);
              regresar();
            } else setError(r.error);
          }}
        />
        <Boton texto="Cancelar" variante="secundario" onPress={cerrar} />
      </Hoja>

      <Hoja visible={hoja === 'agregarFoto'} titulo="Agregar foto" onCerrar={cerrar}>
        <OpcionMenu texto="Tomar foto" Icono={Camera} onPress={() => elegirFoto('camara')} />
        <OpcionMenu texto="Elegir de la galería (una o varias)" Icono={Images} onPress={() => elegirFoto('galeria')} />
      </Hoja>

      <Hoja visible={typeof hoja === 'object' && hoja !== null} titulo="Foto" onCerrar={cerrar}>
        {typeof hoja === 'object' && hoja !== null ? (
          <>
            <OpcionMenu
              texto="Editar foto"
              Icono={Pencil}
              onPress={() => {
                const foto = hoja.foto;
                setHoja(null);
                router.push({
                  pathname: '/editor',
                  params: { operacion: String(articulo.id), foto: String(foto.id), portada: fotos[0]?.id === foto.id ? '1' : '0' },
                });
              }}
            />
            {fotos[0]?.id !== hoja.foto.id ? (
              <OpcionMenu texto="Usar como portada" Icono={Star} onPress={() => accionFoto('portada', hoja.foto)} />
            ) : null}
            <OpcionMenu texto="Borrar foto" Icono={Trash2} peligro onPress={() => accionFoto('borrar', hoja.foto)} />
          </>
        ) : null}
      </Hoja>
    </SafeAreaView>
  );
}

function regresar() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function ErrorHoja({ error }: { error: string | null }) {
  const theme = useTheme();
  if (!error) return null;
  return (
    <ThemedText type="chico" accessibilityRole="alert" style={{ color: theme.peligro }}>
      {error}
    </ThemedText>
  );
}

function EntradaAnuncio({
  etiqueta,
  valor,
  onCambio,
  multilinea,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  multilinea?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.xs }}>
      <ThemedText type="chico" themeColor="textoSecundario">
        {etiqueta}
      </ThemedText>
      <TextInput
        accessibilityLabel={etiqueta}
        value={valor}
        onChangeText={onCambio}
        multiline={multilinea}
        style={[
          styles.entradaAnuncio,
          multilinea && styles.entradaLarga,
          { color: theme.texto, borderColor: theme.borde, backgroundColor: theme.superficie },
        ]}
      />
    </View>
  );
}

function Fila({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <View style={styles.fila}>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="cuerpoFuerte">{titulo}</ThemedText>
        <ThemedText type="chico" themeColor="textoTenue">
          {detalle}
        </ThemedText>
      </View>
      <ThemedText type="precio">{valor}</ThemedText>
    </View>
  );
}

function BotonCircular({
  etiqueta,
  Icono,
  onPress,
}: {
  etiqueta: string;
  Icono: React.ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      style={({ pressed }) => [styles.circular, { backgroundColor: theme.superficie, opacity: pressed ? 0.6 : 1 }]}>
      <Icono size={IconSize.md} color={theme.texto} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  barraSuperior: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  contenido: {
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  margen: {
    marginHorizontal: Spacing.lg,
  },
  fotos: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  foto: {
    width: 72,
    height: 72,
    borderRadius: Radius.md,
  },
  agregarFoto: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portada: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
  },
  encabezado: {
    gap: Spacing.sm,
  },
  filas: {
    gap: Spacing.lg,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  pildoras: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  circular: {
    width: TocableMinimo,
    height: TocableMinimo,
    borderRadius: Radius.pildora,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
  },
  entradaAnuncio: {
    minHeight: TocableMinimo,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: Fonts.regular,
    fontSize: 16,
  },
  entradaLarga: {
    minHeight: 120,
    textAlignVertical: 'top',
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
