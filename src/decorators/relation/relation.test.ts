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
        columnName: 'user_id',
        columnType: COLUMN_TYPE.SERIAL,
        target: User,
      },
    ]);
  });

  test('uses foreignKey option as column name when provided', () => {
    @Entity(db)
    class Author {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;
    }

    @Entity(db)
    class Book {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @ToOne({ target: () => Author, foreignKey: 'author_id' })
      author!: Author;
    }

    const metadata = db.getMetadata().get(Book)!;
    const relation = metadata.relations[0]!;
    expect(relation.columnName).toBe('author_id');
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
    expect(relation.columnName).toBe('category_id');
    expect(relation.columnType).toBe(COLUMN_TYPE.SERIAL);
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
    expect(relation.columnName).toBe('tag_tagId');
  });
});
