import { expect, test, describe } from 'bun:test';
import { RelationType } from '../../core/metadata/metadata';
import { Database } from '../../core/database/database';
import { Entity } from '../entity/entity';
import { PrimaryColumn } from '../column/column';
import { Nullable, NotNullable } from '../nullable/nullable';
import { MissingNullabilityDecoratorError } from '../nullable/nullable.errors';
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
      @Nullable
      profile?: Profile;
    }

    @Entity(db)
    class Profile {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @ToOne({ target: () => User })
      @NotNullable
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
        columns: [{ name: 'user_id', type: COLUMN_TYPE.INTEGER, referencedProperty: 'id' }],
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
      @NotNullable
      author!: Author;
    }

    const metadata = db.getMetadata().get(Book)!;
    const relation = metadata.relations[0]!;
    expect(relation.columns).toEqual([{ name: 'author_id', type: COLUMN_TYPE.INTEGER, referencedProperty: 'id' }]);
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
      @NotNullable
      category!: Category;
    }

    const metadata = db.getMetadata().get(Article);
    const relation = metadata!.relations[0]!;
    expect(relation.columns).toEqual([{ name: 'category_id', type: COLUMN_TYPE.INTEGER, referencedProperty: 'id' }]);
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
      @NotNullable
      tag!: Tag;
    }

    const metadata = db.getMetadata().get(Post)!;
    const relation = metadata.relations[0]!;
    expect(relation.columns).toEqual([{ name: 'tag_tagId', type: COLUMN_TYPE.INTEGER, referencedProperty: 'tagId' }]);
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
      @NotNullable
      orderItem!: OrderItem;
    }

    const metadata = db.getMetadata().get(OrderDetail)!;
    const relation = metadata.relations[0]!;
    expect(relation.columns).toEqual([
      { name: 'orderItem_orderId', type: COLUMN_TYPE.INTEGER, referencedProperty: 'orderId' },
      { name: 'orderItem_productId', type: COLUMN_TYPE.INTEGER, referencedProperty: 'productId' },
    ]);
  });
});

describe('@ToOne with nullability guard', () => {
  test('@ToOne without @Nullable or @NotNullable throws MissingNullabilityDecoratorError', () => {
    const guardDb = new Database();

    @Entity(guardDb)
    class Target {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;
    }

    let caught: unknown;
    try {
      @Entity(guardDb)
      class Owner {
        @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
        id!: number;

        @ToOne({ target: () => Target })
        target!: Target;
      }
      void Owner;
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(MissingNullabilityDecoratorError);
    if (!(caught instanceof MissingNullabilityDecoratorError)) throw caught;
    expect(caught.propertyName).toBe('target');
  });

  test('@ToOne with @Nullable does not throw', () => {
    const guardDb = new Database();

    @Entity(guardDb)
    class Target {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;
    }

    expect(() => {
      @Entity(guardDb)
      class Owner {
        @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
        id!: number;

        @ToOne({ target: () => Target })
        @Nullable
        target?: Target;
      }
      void Owner;
    }).not.toThrow();
  });

  test('@ToOne with @NotNullable does not throw', () => {
    const guardDb = new Database();

    @Entity(guardDb)
    class Target {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;
    }

    expect(() => {
      @Entity(guardDb)
      class Owner {
        @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
        id!: number;

        @ToOne({ target: () => Target })
        @NotNullable
        target!: Target;
      }
      void Owner;
    }).not.toThrow();
  });
});
