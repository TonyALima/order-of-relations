import {
  COLUMN_TYPE,
  Column,
  Database,
  Entity,
  NotNullable,
  Nullable,
  PrimaryColumn,
  type PrimaryKey,
  Repository,
  ToOne,
} from 'order-of-relations';

const db = new Database();

@Entity(db, 'relation_profiles')
class Profile {
  @PrimaryColumn({
    type: COLUMN_TYPE.SERIAL,
    autogeneration: { dbSide: () => undefined },
  })
  id?: PrimaryKey<number>;

  @Column({ type: COLUMN_TYPE.TEXT })
  @NotNullable
  bio!: string;
}

@Entity(db, 'relation_users')
class User {
  @PrimaryColumn({
    type: COLUMN_TYPE.SERIAL,
    autogeneration: { dbSide: () => undefined },
  })
  id?: PrimaryKey<number>;

  @ToOne({ target: () => Profile })
  @Nullable
  profile?: Profile;
}

@Entity(db, 'relation_order_items')
class OrderItem {
  @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
  orderId!: PrimaryKey<number>;

  @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
  productId!: PrimaryKey<number>;
}

@Entity(db, 'relation_order_details')
class OrderDetail {
  @PrimaryColumn({
    type: COLUMN_TYPE.SERIAL,
    autogeneration: { dbSide: () => undefined },
  })
  id?: PrimaryKey<number>;

  @ToOne({ target: () => OrderItem })
  @NotNullable
  orderItem!: OrderItem;
}

async function main() {
  db.connect();
  await db.drop();

  try {
    await db.create();

    const profiles = new Repository(Profile, db);
    const users = new Repository(User, db);
    const orderItems = new Repository(OrderItem, db);
    const orderDetails = new Repository(OrderDetail, db);

    const profileKey = await profiles.create({ bio: 'Maintainer' });
    const profile = await profiles.findById(profileKey);
    if (!profile) throw new Error('Profile not found');
    await users.create({ profile });

    await orderItems.create({ orderId: 1, productId: 2 });
    const orderItem = await orderItems.findById({ orderId: 1, productId: 2 });
    if (!orderItem) throw new Error('Order item not found');
    await orderDetails.create({ orderItem });

    console.log(await users.findMany());
    console.log(await orderDetails.findMany());
  } finally {
    await db.drop();
  }
}

await main();
