import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import {
  FIN_MOVIMIENTO_INGRESO_TIPOS,
  type FinMovimientoStock,
  type FinMovimientoStockInput,
  type FinMovimientoStockTipo,
  type FinStockCategoria,
  type FinStockCategoriaInput,
  type FinStockProducto,
  type FinStockProductoInput,
  type FinStockResumen,
  type FinStockRubro,
} from '@/types/fin-stock';

function nowIso(): string {
  return new Date().toISOString();
}

function mapDoc<T>(
  doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot
): T | null {
  if (!doc.exists) {
    return null;
  }

  return doc.data() as T;
}

async function getCategoriaOrThrow(
  orgId: string,
  categoriaId: string
): Promise<FinStockCategoria> {
  const db = getAdminFirestore();
  const snap = await db.doc(FIN_COLLECTIONS.stockCategoria(orgId, categoriaId)).get();

  if (!snap.exists) {
    throw new Error('Categoria no encontrada');
  }

  return snap.data() as FinStockCategoria;
}

export class StockService {
  static async getCategorias(orgId: string): Promise<FinStockCategoria[]> {
    const db = getAdminFirestore();
    const snap = await db
      .collection(FIN_COLLECTIONS.stockCategorias(orgId))
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs
      .map(doc => mapDoc<FinStockCategoria>(doc))
      .filter((item): item is FinStockCategoria => Boolean(item));
  }

  static async getCategoria(
    orgId: string,
    id: string
  ): Promise<FinStockCategoria | null> {
    const db = getAdminFirestore();
    const snap = await db.doc(FIN_COLLECTIONS.stockCategoria(orgId, id)).get();
    return mapDoc<FinStockCategoria>(snap);
  }

  static async createCategoria(
    orgId: string,
    data: FinStockCategoriaInput,
    userId: string
  ): Promise<FinStockCategoria> {
    const db = getAdminFirestore();
    const ref = db.collection(FIN_COLLECTIONS.stockCategorias(orgId)).doc();
    const now = nowIso();

    const categoria: FinStockCategoria = {
      ...data,
      id: ref.id,
      organization_id: orgId,
      createdAt: now,
      createdBy: userId,
    };

    await ref.set(categoria);

    return categoria;
  }

  static async updateCategoria(
    orgId: string,
    id: string,
    data: Partial<FinStockCategoriaInput>
  ): Promise<void> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.stockCategoria(orgId, id));
    const updates: Partial<FinStockCategoriaInput> = {};

    if (typeof data.nombre === 'string') {
      updates.nombre = data.nombre;
    }

    if ('descripcion' in data) {
      updates.descripcion = data.descripcion;
    }

    if (typeof data.rubro === 'string') {
      updates.rubro = data.rubro;
    }

    if (typeof data.activa === 'boolean') {
      updates.activa = data.activa;
    }

    await ref.update(updates);
  }

  static async desactivarCategoria(orgId: string, id: string): Promise<void> {
    const db = getAdminFirestore();
    await db.doc(FIN_COLLECTIONS.stockCategoria(orgId, id)).update({
      activa: false,
    });
  }

  static async getProductos(
    orgId: string,
    filtros?: {
      categoriaId?: string;
      activo?: boolean;
      soloConStock?: boolean;
    }
  ): Promise<FinStockProducto[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(
      FIN_COLLECTIONS.stockProductos(orgId)
    );

    if (filtros?.categoriaId) {
      query = query.where('categoria_id', '==', filtros.categoriaId);
    }

    if (typeof filtros?.activo === 'boolean') {
      query = query.where('activo', '==', filtros.activo);
    }

    if (filtros?.soloConStock) {
      query = query.where('stock_actual', '>', 0);
    }

    const snap = await query.get();

    return snap.docs
      .map(doc => mapDoc<FinStockProducto>(doc))
      .filter((item): item is FinStockProducto => Boolean(item));
  }

  static async getProducto(
    orgId: string,
    id: string
  ): Promise<FinStockProducto | null> {
    const db = getAdminFirestore();
    const snap = await db.doc(FIN_COLLECTIONS.stockProducto(orgId, id)).get();
    return mapDoc<FinStockProducto>(snap);
  }

  static async createProducto(
    orgId: string,
    data: FinStockProductoInput,
    userId: string
  ): Promise<FinStockProducto> {
    const db = getAdminFirestore();
    const ref = db.collection(FIN_COLLECTIONS.stockProductos(orgId)).doc();
    const now = nowIso();
    const categoria = await getCategoriaOrThrow(orgId, data.categoria_id);

    const producto: FinStockProducto = {
      ...data,
      id: ref.id,
      organization_id: orgId,
      categoria_nombre: categoria.nombre,
      stock_actual: 0,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
    };

    await ref.set(producto);

    return producto;
  }

  static async updateProducto(
    orgId: string,
    id: string,
    data: Partial<FinStockProductoInput>
  ): Promise<void> {
    const db = getAdminFirestore();
    const ref = db.doc(FIN_COLLECTIONS.stockProducto(orgId, id));
    const updates: Record<string, unknown> = {
      updatedAt: nowIso(),
    };

    if (typeof data.categoria_id === 'string') {
      const categoria = await getCategoriaOrThrow(orgId, data.categoria_id);
      updates.categoria_id = data.categoria_id;
      updates.categoria_nombre = categoria.nombre;
    }

    const directKeys: Array<keyof FinStockProductoInput> = [
      'codigo',
      'nombre',
      'descripcion',
      'marca',
      'modelo',
      'unidad_medida',
      'precio_costo',
      'precio_venta_contado',
      'activo',
      'stock_minimo',
      'requiere_serie',
    ];

    for (const key of directKeys) {
      if (key in data) {
        updates[key] = data[key];
      }
    }

    await ref.update(updates);
  }

  static async desactivarProducto(orgId: string, id: string): Promise<void> {
    const db = getAdminFirestore();
    await db.doc(FIN_COLLECTIONS.stockProducto(orgId, id)).update({
      activo: false,
      updatedAt: nowIso(),
    });
  }

  static async getMovimientos(
    orgId: string,
    filtros?: {
      productoId?: string;
      tipo?: FinMovimientoStockTipo;
      desde?: string;
      hasta?: string;
    }
  ): Promise<FinMovimientoStock[]> {
    const db = getAdminFirestore();
    let query: FirebaseFirestore.Query = db.collection(
      FIN_COLLECTIONS.stockMovimientos(orgId)
    );

    if (filtros?.productoId) {
      query = query.where('producto_id', '==', filtros.productoId);
    }

    if (filtros?.tipo) {
      query = query.where('tipo', '==', filtros.tipo);
    }

    if (filtros?.desde) {
      query = query.where('createdAt', '>=', filtros.desde);
    }

    if (filtros?.hasta) {
      query = query.where('createdAt', '<=', filtros.hasta);
    }

    const snap = await query.orderBy('createdAt', 'desc').get();

    return snap.docs
      .map(doc => mapDoc<FinMovimientoStock>(doc))
      .filter((item): item is FinMovimientoStock => Boolean(item));
  }

  static async registrarMovimiento(
    orgId: string,
    data: FinMovimientoStockInput,
    userId: string
  ): Promise<FinMovimientoStock> {
    if (!Number.isFinite(data.cantidad) || data.cantidad <= 0) {
      throw new Error('La cantidad debe ser mayor a cero');
    }

    const db = getAdminFirestore();
    const productoRef = db.doc(FIN_COLLECTIONS.stockProducto(orgId, data.producto_id));
    const movimientoRef = db.collection(FIN_COLLECTIONS.stockMovimientos(orgId)).doc();
    const createdAt = nowIso();

    const movimiento = await db.runTransaction(async transaction => {
      const productoSnap = await transaction.get(productoRef);

      if (!productoSnap.exists) {
        throw new Error('Producto no encontrado');
      }

      const producto = productoSnap.data() as FinStockProducto;

      if (producto.organization_id !== orgId) {
        throw new Error('El producto no pertenece a la organizacion');
      }

      if (!producto.activo) {
        throw new Error('El producto esta inactivo');
      }

      if (producto.requiere_serie && !data.numero_serie) {
        throw new Error('El producto requiere numero de serie');
      }

      const stockAnterior = Number(producto.stock_actual || 0);
      const esIngreso = FIN_MOVIMIENTO_INGRESO_TIPOS.includes(data.tipo);
      const stockNuevo = esIngreso
        ? stockAnterior + data.cantidad
        : stockAnterior - data.cantidad;

      if (stockNuevo < 0) {
        throw new Error('Stock insuficiente');
      }

      const payload: FinMovimientoStock = {
        ...data,
        id: movimientoRef.id,
        organization_id: orgId,
        producto_nombre: producto.nombre,
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        createdAt,
        createdBy: userId,
      };

      transaction.update(productoRef, {
        stock_actual: stockNuevo,
        updatedAt: createdAt,
      });
      transaction.set(movimientoRef, payload);

      return payload;
    });

    return movimiento;
  }

  static async getResumenStock(orgId: string): Promise<FinStockResumen[]> {
    const db = getAdminFirestore();
    const [productosSnap, categoriasSnap, movimientosSnap] = await Promise.all([
      db
        .collection(FIN_COLLECTIONS.stockProductos(orgId))
        .where('activo', '==', true)
        .get(),
      db.collection(FIN_COLLECTIONS.stockCategorias(orgId)).get(),
      db
        .collection(FIN_COLLECTIONS.stockMovimientos(orgId))
        .orderBy('createdAt', 'desc')
        .get(),
    ]);

    const categorias = new Map<string, FinStockCategoria>();
    for (const doc of categoriasSnap.docs) {
      const categoria = mapDoc<FinStockCategoria>(doc);
      if (categoria) {
        categorias.set(categoria.id, categoria);
      }
    }

    const ultimoMovimientoPorProducto = new Map<string, string>();
    for (const doc of movimientosSnap.docs) {
      const movimiento = mapDoc<FinMovimientoStock>(doc);
      if (
        movimiento &&
        !ultimoMovimientoPorProducto.has(movimiento.producto_id)
      ) {
        ultimoMovimientoPorProducto.set(
          movimiento.producto_id,
          movimiento.createdAt
        );
      }
    }

    return productosSnap.docs
      .map(doc => mapDoc<FinStockProducto>(doc))
      .filter((item): item is FinStockProducto => Boolean(item))
      .map(producto => {
        const categoria = categorias.get(producto.categoria_id);
        const rubro: FinStockRubro = categoria?.rubro ?? 'otro';

        return {
          producto_id: producto.id,
          producto_nombre: producto.nombre,
          categoria_nombre: producto.categoria_nombre,
          rubro,
          stock_actual: producto.stock_actual,
          stock_minimo: producto.stock_minimo,
          alerta_stock_bajo: producto.stock_actual <= producto.stock_minimo,
          precio_venta_contado: producto.precio_venta_contado,
          ultimo_movimiento: ultimoMovimientoPorProducto.get(producto.id),
        };
      });
  }
}
