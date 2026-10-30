import assert from "node:assert/strict";
import { test } from "node:test";

import { columnsFromTable } from "./introspect.js";

const staleMetadata = (basetype) => [
  { key: "KBC.datatype.basetype", value: basetype, provider: "storage" },
  { key: "KBC.datatype.type", value: "VARCHAR", provider: "storage" },
  { key: "KBC.description", value: "stale row", provider: "user" },
];

test("a typed table takes types and descriptions from the definition", () => {
  const columns = columnsFromTable({
    isTyped: true,
    columns: ["id", "note"],
    definition: {
      columns: [
        {
          name: "id",
          basetype: "INTEGER",
          definition: { type: "NUMBER", description: "Row id" },
        },
        { name: "note", basetype: "STRING", definition: [] },
      ],
    },
    columnMetadata: { id: staleMetadata("STRING"), note: staleMetadata("DATE") },
  });

  assert.deepEqual(columns, [
    { name: "id", description: "Row id", nativeType: "NUMBER", baseType: "INTEGER" },
    { name: "note", baseType: "STRING" },
  ]);
});

test("a non-typed table keeps types from columnMetadata, descriptions from the definition", () => {
  const columns = columnsFromTable({
    isTyped: false,
    columns: ["id"],
    definition: { columns: [{ name: "id", definition: { description: "Row id" } }] },
    columnMetadata: { id: staleMetadata("INTEGER") },
  });

  assert.deepEqual(columns, [
    { name: "id", description: "Row id", nativeType: "VARCHAR", baseType: "INTEGER" },
  ]);
});

test("a stale KBC.description row is not a description and odd definitions do not throw", () => {
  const columns = columnsFromTable({
    isTyped: false,
    columns: ["id"],
    definition: [],
    columnMetadata: { id: staleMetadata("INTEGER") },
  });

  assert.deepEqual(columns, [{ name: "id", nativeType: "VARCHAR", baseType: "INTEGER" }]);
});
