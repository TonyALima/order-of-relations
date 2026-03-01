import { Entity } from "../../../src/decorators/entity"
import { Column, PrimaryColumn } from "../../../src/decorators/column"

@Entity("user")
export class User {
  @PrimaryColumn()
  id!: number

  @Column()
  name!: string

  @Column()
  email!: string
}
