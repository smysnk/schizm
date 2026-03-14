import { GraphQLScalarType, Kind, type ValueNode } from "graphql";

const parseLiteral = (ast: ValueNode): unknown => {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.NULL:
      return null;
    case Kind.OBJECT:
      return ast.fields.reduce<Record<string, unknown>>((value, field) => {
        value[field.name.value] = parseLiteral(field.value);
        return value;
      }, {});
    case Kind.LIST:
      return ast.values.map((value) => parseLiteral(value));
    default:
      return null;
  }
};

export const jsonScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value",
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral
});
