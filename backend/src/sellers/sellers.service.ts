import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { Timestamp } from 'firebase-admin/firestore';
import { FirebaseService } from '../firebase/firebase.service';

interface SellerDoc {
  _id: string;
  name: string;
  active: boolean;
  uid?: string | null;
  createdAt?: Timestamp;
}

export interface SellerInput {
  name?: unknown;
  active?: unknown;
  uid?: unknown;
}

// Vendedores del stand (lr_sellers). Cada uno puede estar vinculado a una
// cuenta de Firebase Auth (campo `uid`, una cuenta por vendedor): así la
// Reserva Asistida sabe quién vende sin que lo elija a mano. Las cuentas se
// crean/editan con /api/users; acá solo se guarda el vínculo.
@Injectable()
export class SellersService {
  constructor(private firebase: FirebaseService) {}

  private readDocs(snapshot: FirebaseFirestore.QuerySnapshot): SellerDoc[] {
    return snapshot.docs.map(
      (doc) => ({ _id: doc.id, ...doc.data() }) as SellerDoc,
    );
  }

  // Lista pública (formulario del stand): solo id y nombre, sin el uid.
  async findAll(): Promise<{ _id: string; name: string }[]> {
    const db = this.firebase.getFirestore();
    if (!db) return [];

    const snapshot = await db
      .collection('lr_sellers')
      .where('active', '==', true)
      .get();

    const createdMs = (s: SellerDoc) => s.createdAt?.toMillis?.() ?? 0;
    return this.readDocs(snapshot)
      .sort((a, b) => createdMs(b) - createdMs(a))
      .map((s) => ({ _id: s._id, name: s.name }));
  }

  // Lista del admin, con los datos de la cuenta vinculada (si la hay).
  async findAllAdmin() {
    const db = this.firebase.getFirestore();
    if (!db) return [];

    const snapshot = await db
      .collection('lr_sellers')
      .orderBy('createdAt', 'desc')
      .get();
    const sellers = this.readDocs(snapshot);

    const accounts = new Map<
      string,
      { email: string; role: string | null; disabled: boolean }
    >();
    const uids = sellers.flatMap((s) => (s.uid ? [s.uid] : []));
    const auth = this.firebase.getAuth();
    // getUsers acepta hasta 100 identificadores por llamada.
    for (let i = 0; auth && i < uids.length; i += 100) {
      const result = await auth.getUsers(
        uids.slice(i, i + 100).map((uid) => ({ uid })),
      );
      for (const u of result.users) {
        accounts.set(u.uid, {
          email: u.email ?? '',
          role: (u.customClaims?.role as string | undefined) ?? null,
          disabled: u.disabled,
        });
      }
    }

    return sellers.map((s) => ({
      ...s,
      uid: s.uid ?? null,
      // null también si la cuenta vinculada se borró desde Firebase.
      account: s.uid ? (accounts.get(s.uid) ?? null) : null,
    }));
  }

  // Vendedor vinculado a una cuenta (el que inició sesión en el stand).
  async findByUid(uid: string): Promise<{ _id: string; name: string } | null> {
    const db = this.firebase.getFirestore();
    if (!db || !uid) return null;
    const snapshot = await db
      .collection('lr_sellers')
      .where('uid', '==', uid)
      .where('active', '==', true)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const [seller] = this.readDocs(snapshot);
    return { _id: seller._id, name: seller.name };
  }

  // Valida el uid a vincular: la cuenta debe existir y no estar ya vinculada
  // a otro vendedor. null/'' = desvincular.
  private async checkUid(
    uid: unknown,
    sellerId: string | null,
  ): Promise<string | null> {
    if (uid === null || uid === '') return null;
    if (typeof uid !== 'string') {
      throw new BadRequestException('Cuenta no válida');
    }
    try {
      await this.firebase.getAuth()!.getUser(uid);
    } catch {
      throw new BadRequestException('La cuenta seleccionada no existe');
    }
    const snapshot = await this.firebase
      .getFirestore()
      .collection('lr_sellers')
      .where('uid', '==', uid)
      .get();
    const other = this.readDocs(snapshot).find((s) => s._id !== sellerId);
    if (other) {
      throw new ConflictException(
        `Esa cuenta ya está vinculada al vendedor «${other.name}»`,
      );
    }
    return uid;
  }

  private checkName(name: unknown): string {
    const value = typeof name === 'string' ? name.trim() : '';
    if (!value) throw new BadRequestException('El nombre es obligatorio');
    return value;
  }

  async create(data: SellerInput) {
    const db = this.firebase.getFirestore();
    const docRef = db.collection('lr_sellers').doc();
    const sellerData = {
      name: this.checkName(data.name),
      uid: await this.checkUid(data.uid ?? null, null),
      active: true,
      createdAt: new Date(),
    };
    await docRef.set(sellerData);
    return { _id: docRef.id, ...sellerData };
  }

  async update(id: string, data: SellerInput) {
    const db = this.firebase.getFirestore();
    const changes: Record<string, unknown> = {};
    if (data.name !== undefined) changes.name = this.checkName(data.name);
    if (typeof data.active === 'boolean') changes.active = data.active;
    if (data.uid !== undefined) changes.uid = await this.checkUid(data.uid, id);
    if (Object.keys(changes).length) {
      await db.collection('lr_sellers').doc(id).update(changes);
    }
    return { success: true };
  }
}
