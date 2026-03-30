import { test, expect, describe } from 'bun:test';
import {
  Entity,
  Column,
  PrimaryColumn,
  ToOne,
  Service,
  Inject,
  InjectRepository,
  Database,
  Repository,
  Container,
  OrmError,
  DatabaseError,
  DatabaseNotConnectedError,
  MetadataError,
  RelationTargetNotFoundError,
  MissingPrimaryColumnError,
  SchemaError,
  UnsupportedColumnTypeError,
  QueryError,
  UndefinedWhereConditionError,
} from './index';

describe('public API exports', () => {
  test('all core exports are defined', () => {
    expect(Entity).toBeFunction();
    expect(Column).toBeFunction();
    expect(PrimaryColumn).toBeFunction();
    expect(ToOne).toBeFunction();
    expect(Service).toBeFunction();
    expect(Inject).toBeFunction();
    expect(InjectRepository).toBeFunction();
    expect(Database).toBeDefined();
    expect(Repository).toBeFunction();
    expect(Container).toBeDefined();
  });

  test('all error classes are exported', () => {
    expect(OrmError).toBeFunction();
    expect(DatabaseError).toBeFunction();
    expect(DatabaseNotConnectedError).toBeFunction();
    expect(MetadataError).toBeFunction();
    expect(RelationTargetNotFoundError).toBeFunction();
    expect(MissingPrimaryColumnError).toBeFunction();
    expect(SchemaError).toBeFunction();
    expect(UnsupportedColumnTypeError).toBeFunction();
    expect(QueryError).toBeFunction();
    expect(UndefinedWhereConditionError).toBeFunction();
  });
});
