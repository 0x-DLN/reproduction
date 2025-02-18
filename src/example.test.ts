import {
  Entity,
  ManyToOne,
  MikroORM,
  PrimaryKey,
  PrimaryKeyProp,
  Property
} from "@mikro-orm/sqlite";

@Entity()
export class A {
  @PrimaryKey({ type: "integer", autoincrement: true })
  public id!: number;

  @Property({ type: "integer" })
  number!: number;
}

@Entity()
export class B {
  @PrimaryKey({ type: "integer", autoincrement: true })
  public id!: number;

  @Property({ type: "integer" })
  number!: number;
}

@Entity()
export class Composite {
  @ManyToOne(() => A, { fieldName: "a_id", primary: true })
  entityA!: A;

  @ManyToOne(() => B, { fieldName: "b_id", primary: true })
  entityB!: B;

  [PrimaryKeyProp]?: ["a_id", "b_id"];
}

@Entity()
export class Dependent {
  @ManyToOne(() => Composite, { fieldNames: ["a_id", "b_id"], primary: true })
  composite!: Composite;

  @PrimaryKey()
  anotherId!: number;

  [PrimaryKeyProp]?: ["composite", "anotherId"];
}

@Entity()
export class Dependent2 {
  @ManyToOne(() => Composite, { fieldNames: ["a_id", "b_id"], primary: true })
  composite!: Composite;

  [PrimaryKeyProp]?: ["composite"];
}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ":memory:",
    entities: [A, B, Composite, Dependent, Dependent2],
    debug: ["query", "query-params"],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

test("#1. Creating an M:1 with underlying M:1 and another ID tries to insert a null value into underlying M:1", async () => {
  // These have to be created without an ID directly. If created with an ID the test passes.
  const a = orm.em.create(A, { number: 1 });
  const b = orm.em.create(B, { number: 2 });

  const composite = orm.em.create(Composite, { entityA: a, entityB: b }); // Create a M:1 composite of a and b

  // Issue #1: When we try to create a M:1 from composite with an extra PK field, `a_id` is filled, while `b_id` is null
  orm.em.create(Dependent, { composite, anotherId: 3 });
  await orm.em.flush();
  orm.em.clear();
});

test("#2. 'Nested' M:1 relations created without ID causes their composite to be null", async () => {
  // These have to be created without an ID directly. If created with an ID the test passes.
  const a = orm.em.create(A, { id: 1, number: 1 });
  const b = orm.em.create(B, { id: 2, number: 2 });

  const composite = orm.em.create(Composite, { entityA: a, entityB: b }); // Create a M:1 composite of a and b

  // Issue #2: When we try to create a M:1 from composite without the extra PK field, composite appears to be null and we cannot read `entityA`
  orm.em.create(Dependent2, { composite });
  await orm.em.flush();
  orm.em.clear();
});


test("#3. 'Nested' M:1 relations created with an id causes foreign key constraints, ", async () => {
  // These have to be created without an ID directly. If created with an ID the test passes.
  const a = orm.em.create(A, { id: 1, number: 1 });
  const b = orm.em.create(B, { id: 2, number: 2 });

  // Issue #3: When we try to create a M:1 from A and B with ID's, the flush causes a FK constraint.
  // Possibly entities are being created in the wrong order? Not 100% sure
  orm.em.create(Composite, { entityA: a, entityB: b }); // Create a M:1 composite of a and b

  await orm.em.flush();
  orm.em.clear();
});