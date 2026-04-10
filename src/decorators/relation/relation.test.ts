import { expect, test, describe } from 'bun:test';
import { RelationType } from '../../core/metadata/metadata';
import { Database } from '../../core/database/database';
import { Entity } from '../entity/entity';
import { PrimaryColumn } from '../column/column';
import { COLUMN_TYPE } from '../../core/sql-types/sql-types';
import { ToOne } from './relation';

const db = new Database();

describe('@ToOne decorator', () => {
  test('stores relation metadata with auto-derived FK column name', () => {
    @Entity(db)
    class User {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @ToOne({ target: () => Profile })
      profile?: Profile;
    }

    @Entity(db)
    class Profile {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @ToOne({ target: () => User })
      user!: User;
    }

    const metadata = db.getMetadata().get(Profile);
    expect(metadata).toBeDefined();
    const relations = metadata!.relations;
    expect(relations).toBeDefined();
    const resolvedRelations = relations.map((relation) => {
      const { getTarget, ...r } = relation;
      return {
        ...r,
        target: getTarget(),
      };
    });
    expect(resolvedRelations).toEqual([
      {
        propertyName: 'user',
        relationType: RelationType.TO_ONE,
        columns: [{ name: 'user_id', type: COLUMN_TYPE.INTEGER }],
        target: User,
      },
    ]);
  });

  test('uses foreignKeys option as column names when provided', () => {
    @Entity(db)
    class Author {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;
    }

    @Entity(db)
    class Book {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @ToOne({ target: () => Author, foreignKeys: ['author_id'] })
      author!: Author;
    }

    const metadata = db.getMetadata().get(Book)!;
    const relation = metadata.relations[0]!;
    expect(relation.columns).toEqual([{ name: 'author_id', type: COLUMN_TYPE.INTEGER }]);
  });

  test('resolves columnType from target primary column', () => {
    @Entity(db)
    class Category {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;
    }

    @Entity(db)
    class Article {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @ToOne({ target: () => Category })
      category!: Category;
    }

    const metadata = db.getMetadata().get(Article);
    const relation = metadata!.relations[0]!;
    expect(relation.columns).toEqual([{ name: 'category_id', type: COLUMN_TYPE.INTEGER }]);
  });

  test('derives FK column name from target PK property name', () => {
    @Entity(db)
    class Tag {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      tagId!: number;
    }

    @Entity(db)
    class Post {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @ToOne({ target: () => Tag })
      tag!: Tag;
    }

    const metadata = db.getMetadata().get(Post)!;
    const relation = metadata.relations[0]!;
    expect(relation.columns).toEqual([{ name: 'tag_tagId', type: COLUMN_TYPE.INTEGER }]);
  });

  test('derives FK column names from target composite PK property names', () => {
    @Entity(db)
    class OrderItem {
      @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
      orderId!: number;

      @PrimaryColumn({ type: COLUMN_TYPE.INTEGER })
      productId!: number;
    }

    @Entity(db)
    class OrderDetail {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @ToOne({ target: () => OrderItem })
      orderItem!: OrderItem;
    }

    const metadata = db.getMetadata().get(OrderDetail)!;
    const relation = metadata.relations[0]!;
    expect(relation.columns).toEqual([
      { name: 'orderItem_orderId', type: COLUMN_TYPE.INTEGER },
      { name: 'orderItem_productId', type: COLUMN_TYPE.INTEGER },
    ]);
  });
});
